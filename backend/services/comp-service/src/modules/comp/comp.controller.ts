import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiOperation,
  ApiTags,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';

import { CurrentUser, type AuthenticatedUser } from './decorators/current-user.decorator';
import { RequiredScopes } from './decorators/require-scope.decorator';
import {
  COMP_GET_METADADOS_UC,
  COMP_UPDATE_METADADOS_UC,
  COMP_UPLOAD_CAPA_UC,
  COMP_REMOVE_CAPA_UC,
  COMP_GET_LAYOUT_UC,
  COMP_UPDATE_LAYOUT_UC,
  COMP_GET_PREVIEW_CONTEXT_UC,
} from './comp.tokens';
import { MetadadosViewDto } from './dto/metadados-view.dto';
import { UpdateMetadadosDto } from './dto/update-metadados.dto';
import { UploadCapaRequestDto } from './dto/upload-capa-request.dto';
import { LayoutViewDto, LayoutOverrideViewDto } from './dto/layout-view.dto';
import { UpdateLayoutDto } from './dto/update-layout.dto';
import { PreviewContextDto, ManuscritoEstrutura } from './dto/preview-context.dto';
import type { GetMetadadosViewUseCase } from './application/get-metadados-view.use-case';
import type { UpdateMetadadosUseCase } from './application/update-metadados.use-case';
import type { UploadCoverUseCase } from './application/upload-cover.use-case';
import type { RemoveCoverUseCase } from './application/remove-cover.use-case';
import type { GetLayoutViewUseCase } from './application/get-layout-view.use-case';
import type { UpdateLayoutUseCase } from './application/update-layout.use-case';
import type { GetLayoutPreviewUseCase, PreviewContextResult } from './application/get-layout-preview.use-case';
import type { Metadados } from '../../domain/comp/metadados.aggregate';
import type { ConfiguracaoLayout } from '../../domain/comp/configuracao-layout.aggregate';
import type { LayoutOverride } from '../../domain/comp/layout-override.entity';

/**
 * Minimal multipart file shape injected by `@UploadedFile()`.
 *
 * Declared locally so this file does not need `@types/multer` (which is a
 * devDependency of `@nestjs/platform-express`).  Keep in sync with
 * `Express.Multer.File` fields used below.
 */
interface UploadedMulterFile {
  buffer: Buffer;
  mimetype: string;
  originalname?: string;
  size?: number;
}

/**
 * HTTP adapter for the COMP bounded context.
 *
 * All 7 routes are nested under `/api/comp/projetos/:projetoId/` (api-contract D-J).
 * Every COMP resource is a singleton child of a project (one Metadados, one
 * ConfiguracaoLayout per projetoId). Routes follow the house style PROJ set for
 * sub-resources.
 *
 * Controllers stay thin: validate (via the global ValidationPipe + DTOs), delegate
 * to use cases (injected by DI token), and shape the HTTP response. No business
 * rule lives here.
 *
 * Security (P5 — COMP-013):
 *   - `JwtAuthGuard` registered as `APP_GUARD` in `app.module.ts` enforces 401
 *     (no/invalid token) and 403 (scope missing) without this file importing
 *     anything from `infrastructure/` (RULE-04 compliance — mirrors proj-service).
 *   - `@RequiredScopes` declares the OAuth2 scope per handler (SPEC-06 §2):
 *       comp:read  → GET endpoints
 *       comp:write → PUT / POST / DELETE endpoints
 *   - `@CurrentUser()` injects the JWT principal; `user.empresaId` is the empresa
 *     slug used for tenant routing (set by EmpresaContextMiddleware before the
 *     handler runs — RULE-07 compliance).
 *   - Cross-tenant isolation: repository queries filter by empresaId extracted
 *     from the JWT principal.
 *
 * RULE-04: this file does NOT import from `infrastructure/`. ✓
 */
@ApiTags('comp')
@ApiBearerAuth('bearer')
@Controller({ path: 'comp/projetos/:projetoId', version: '1' })
export class CompController {
  private readonly logger = new Logger(CompController.name);

  constructor(
    @Inject(COMP_GET_METADADOS_UC)
    private readonly getMetadadosUc: GetMetadadosViewUseCase,
    @Inject(COMP_UPDATE_METADADOS_UC)
    private readonly updateMetadadosUc: UpdateMetadadosUseCase,
    @Inject(COMP_UPLOAD_CAPA_UC)
    private readonly uploadCapaUc: UploadCoverUseCase,
    @Inject(COMP_REMOVE_CAPA_UC)
    private readonly removeCapaUc: RemoveCoverUseCase,
    @Inject(COMP_GET_LAYOUT_UC)
    private readonly getLayoutUc: GetLayoutViewUseCase,
    @Inject(COMP_UPDATE_LAYOUT_UC)
    private readonly updateLayoutUc: UpdateLayoutUseCase,
    @Inject(COMP_GET_PREVIEW_CONTEXT_UC)
    private readonly getPreviewContextUc: GetLayoutPreviewUseCase,
  ) {}

  // -------------------------------------------------------------------------
  // Metadados
  // -------------------------------------------------------------------------

  /**
   * GET /api/comp/projetos/{projetoId}/metadados
   *
   * Returns editorial metadata. Returns a synthesized default (materialized=false)
   * when none exists yet (lazy default — D-M / api-contract §4.1).
   *
   * Scope: comp:read
   */
  @Get('metadados')
  @RequiredScopes('comp:read')
  @ApiOperation({ summary: 'Read editorial metadata (T05)' })
  @ApiOkResponse({ type: MetadadosViewDto, description: 'Metadados or lazy default.' })
  @ApiNotFoundResponse({ description: 'projetoId not found in the active empresa.' })
  async getMetadados(
    @Param('projetoId', ParseUUIDPipe) projetoId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MetadadosViewDto> {
    this.logger.log(`GET metadados projetoId=${projetoId}`);
    const entity = await this.getMetadadosUc.execute({ projetoId, empresaSlug: user.empresaId });
    return CompController.mapMetadados(entity);
  }

  /**
   * PUT /api/comp/projetos/{projetoId}/metadados
   *
   * Idempotent upsert of editorial metadata. Creates the row on first call;
   * re-sending an identical body is a safe no-op (api-contract §4.2).
   *
   * Scope: comp:write
   */
  @Put('metadados')
  @RequiredScopes('comp:write')
  @ApiOperation({ summary: 'Upsert editorial metadata (T05)' })
  @ApiOkResponse({ type: MetadadosViewDto, description: 'Persisted Metadados with materialized=true.' })
  @ApiNotFoundResponse({ description: 'projetoId not found in the active empresa.' })
  async updateMetadados(
    @Param('projetoId', ParseUUIDPipe) projetoId: string,
    @Body() dto: UpdateMetadadosDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<MetadadosViewDto> {
    this.logger.log(`PUT metadados projetoId=${projetoId}`);
    const entity = await this.updateMetadadosUc.execute({
      projetoId,
      empresaSlug: user.empresaId,
      titulo: dto.titulo,
      autor: dto.autor,
      idioma: dto.idioma,
      isbn: dto.isbn,
      categoria: dto.categoria,
    });
    return CompController.mapMetadados(entity);
  }

  // -------------------------------------------------------------------------
  // Capa (cover)
  // -------------------------------------------------------------------------

  /**
   * POST /api/comp/projetos/{projetoId}/capa
   *
   * Upload a cover image (multipart/form-data, field "file").
   * Validates MIME type and size; stores via FileStoragePort; updates capaUrl.
   * Replaces any existing cover (api-contract §4.3, D-L).
   *
   * Scope: comp:write
   */
  @Post('capa')
  @RequiredScopes('comp:write')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload cover image (T05, D-L)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadCapaRequestDto })
  @ApiCreatedResponse({ description: 'Cover stored; capaUrl and atualizadoEm returned.' })
  @ApiNotFoundResponse({ description: 'projetoId not found in the active empresa.' })
  async uploadCapa(
    @Param('projetoId', ParseUUIDPipe) projetoId: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: UploadedMulterFile,
  ): Promise<{ capaUrl: string; atualizadoEm: string }> {
    this.logger.log(`POST capa projetoId=${projetoId}`);
    const buffer = file?.buffer ?? Buffer.alloc(0);
    const mimeType = file?.mimetype ?? 'image/jpeg';
    const result = await this.uploadCapaUc.execute({
      projetoId,
      empresaSlug: user.empresaId,
      buffer,
      mimeType,
    });
    return {
      capaUrl: result.capaUrl,
      atualizadoEm: result.atualizadoEm.toISOString(),
    };
  }

  /**
   * DELETE /api/comp/projetos/{projetoId}/capa
   *
   * Clears capaUrl (sets it null) and schedules cover binary for cleanup.
   * Idempotent: 204 even when no cover exists (api-contract §4.4).
   *
   * Scope: comp:write
   */
  @Delete('capa')
  @RequiredScopes('comp:write')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove cover image (T05)' })
  @ApiNoContentResponse({ description: 'Cover removed (or no cover existed — idempotent).' })
  @ApiNotFoundResponse({ description: 'projetoId not found in the active empresa.' })
  async removeCapa(
    @Param('projetoId', ParseUUIDPipe) projetoId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    this.logger.log(`DELETE capa projetoId=${projetoId}`);
    return this.removeCapaUc.execute({ projetoId, empresaSlug: user.empresaId });
  }

  // -------------------------------------------------------------------------
  // Layout
  // -------------------------------------------------------------------------

  /**
   * GET /api/comp/projetos/{projetoId}/layout
   *
   * Returns layout configuration. Returns a synthesized default (materialized=false)
   * when none exists yet (api-contract §4.5, D-M).
   *
   * Scope: comp:read
   */
  @Get('layout')
  @RequiredScopes('comp:read')
  @ApiOperation({ summary: 'Read layout configuration (T06)' })
  @ApiOkResponse({ type: LayoutViewDto, description: 'ConfiguracaoLayout or lazy default.' })
  @ApiNotFoundResponse({ description: 'projetoId not found in the active empresa.' })
  async getLayout(
    @Param('projetoId', ParseUUIDPipe) projetoId: string,
    @CurrentUser() _user: AuthenticatedUser,
  ): Promise<LayoutViewDto> {
    this.logger.log(`GET layout projetoId=${projetoId}`);
    const entity = await this.getLayoutUc.execute({ projetoId });
    return CompController.mapLayout(entity);
  }

  /**
   * PUT /api/comp/projetos/{projetoId}/layout
   *
   * Idempotent upsert of layout configuration. Validates typography bounds (§7.2),
   * validates override references against the manuscript content tree (D-K),
   * rejects tipo=em-branco (D-H). Emits LayoutUpdated (api-contract §4.6).
   *
   * Scope: comp:write
   */
  @Put('layout')
  @RequiredScopes('comp:write')
  @ApiOperation({ summary: 'Upsert layout configuration (T06, D-H)' })
  @ApiOkResponse({ type: LayoutViewDto, description: 'Persisted ConfiguracaoLayout with materialized=true.' })
  @ApiNotFoundResponse({ description: 'projetoId not found in the active empresa.' })
  async updateLayout(
    @Param('projetoId', ParseUUIDPipe) projetoId: string,
    @Body() dto: UpdateLayoutDto,
    @CurrentUser() _user: AuthenticatedUser,
  ): Promise<LayoutViewDto> {
    this.logger.log(`PUT layout projetoId=${projetoId}`);
    const entity = await this.updateLayoutUc.execute({
      projetoId,
      tipografia: {
        fonte_corpo_familia: dto.fonteCorpoFamilia,
        fonte_corpo_tamanho: dto.fonteCorpoTamanho,
        espacamento_linha: dto.espacamentoLinha,
        margem_lateral: dto.margemLateral,
        h1_tamanho: dto.h1Tamanho,
        h2_tamanho: dto.h2Tamanho,
        h3_tamanho: dto.h3Tamanho,
      },
      overrides: dto.overrides?.map((o) => ({
        referenciaNo: o.referenciaNo,
        tipo: o.tipo,
        alinhamento: o.alinhamento ?? null,
        ordem: o.ordem,
      })),
    });
    return CompController.mapLayout(entity);
  }

  // -------------------------------------------------------------------------
  // Preview context
  // -------------------------------------------------------------------------

  /**
   * GET /api/comp/projetos/{projetoId}/preview-context
   *
   * Assembles read-only manuscript content tree + ConfiguracaoLayout + overrides
   * into a single JSON payload for client-side rendering. Nothing is persisted.
   * Stale overrides (whose referenciaNo no longer resolves) are flagged and
   * returned separately (api-contract §4.7, D-K).
   *
   * Scope: comp:read
   */
  @Get('preview-context')
  @RequiredScopes('comp:read')
  @ApiOperation({ summary: 'Read preview data for client-side renderer (T06, D-K)' })
  @ApiOkResponse({ type: PreviewContextDto, description: 'PreviewContext payload.' })
  @ApiNotFoundResponse({ description: 'projetoId not found in the active empresa.' })
  async getPreviewContext(
    @Param('projetoId', ParseUUIDPipe) projetoId: string,
    @CurrentUser() _user: AuthenticatedUser,
  ): Promise<PreviewContextDto> {
    this.logger.log(`GET preview-context projetoId=${projetoId}`);
    const result = await this.getPreviewContextUc.execute({ projetoId });
    return CompController.mapPreviewContext(result);
  }

  // -------------------------------------------------------------------------
  // Private DTO mappers
  // -------------------------------------------------------------------------

  private static mapMetadados(entity: Metadados): MetadadosViewDto {
    return {
      projetoId: entity.projetoId,
      titulo: entity.titulo,
      autor: entity.autor,
      isbn: entity.isbn,
      idioma: entity.idioma,
      categoria: entity.categoria,
      capaUrl: entity.capaUrl,
      editoraNome: entity.editoraNome,
      atualizadoEm: entity.atualizadoEm.toISOString(),
      materialized: entity.materialized,
    };
  }

  private static mapLayout(entity: ConfiguracaoLayout): LayoutViewDto {
    return {
      projetoId: entity.projetoId,
      fonteCorpoFamilia: entity.fonte_corpo_familia,
      fonteCorpoTamanho: entity.fonte_corpo_tamanho,
      espacamentoLinha: entity.espacamento_linha,
      margemLateral: entity.margem_lateral,
      h1Tamanho: entity.h1_tamanho,
      h2Tamanho: entity.h2_tamanho,
      h3Tamanho: entity.h3_tamanho,
      overrides: [...entity.overrides].map(CompController.mapOverride),
      atualizadoEm: entity.atualizadoEm.toISOString(),
      materialized: entity.materialized,
    };
  }

  private static mapOverride(o: LayoutOverride): LayoutOverrideViewDto {
    return {
      id: o.id,
      referenciaNo: o.referenciaNo,
      tipo: o.tipo,
      alinhamento: o.alinhamento,
      ordem: o.ordem,
      stale: o.stale,
    };
  }

  private static mapPreviewContext(result: PreviewContextResult): PreviewContextDto {
    const manuscrito: ManuscritoEstrutura = {
      manuscritoId: result.manuscrito.manuscritoId,
      estrutura: [...result.manuscrito.estrutura],
    };

    return {
      projetoId: result.projetoId,
      manuscrito,
      layout: CompController.mapLayout(result.layout),
      staleOverrides: [...result.staleOverrides].map(CompController.mapOverride),
    };
  }
}
