import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiCreatedResponse,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import type { ProjetoStatus } from '../../domain/proj/value-objects/project-status.vo';
import type { UsuarioContext } from '../../domain/shared/usuario-context.interface';
import { CurrentUser } from './decorators/current-user.decorator';
import { RequiredScopes } from './decorators/require-scope.decorator';
import { CreateProjetoDto } from './dto/create-projeto.dto';
import { ProjetoDetailDto } from './dto/projeto-detail.dto';
import { ProjetoLibraryPageDto } from './dto/projeto-library-page.dto';
import { PublicacaoHistoryItemDto } from './dto/publicacao-history-item.dto';
import { SignedDownloadUrlDto } from './dto/signed-download-url.dto';
import {
  ADVANCE_PROJETO_STATUS_USE_CASE,
  CREATE_PROJETO_USE_CASE,
  REOPEN_PROJECT_USE_CASE,
  GET_PROJETO_LIBRARY_USE_CASE,
  GET_PROJETO_DETAIL_USE_CASE,
  GET_PUBLICATION_HISTORY_USE_CASE,
  GET_SIGNED_DOWNLOAD_URL_USE_CASE,
  DELETE_PROJETO_USE_CASE,
} from './proj.tokens';
import type { GetProjetoLibraryUseCase } from './use-cases/get-projeto-library.use-case';
import { LIBRARY_MAX_PAGE_SIZE } from './use-cases/get-projeto-library.use-case';
import type { GetProjetoDetailUseCase } from './use-cases/get-projeto-detail.use-case';
import type { GetPublicationHistoryUseCase } from './use-cases/get-publication-history.use-case';
import type { GetSignedDownloadUrlUseCase } from './use-cases/get-signed-download-url.use-case';
import type { CreateProjetoEditorialUseCase } from './use-cases/create-projeto-editorial.use-case';
import type { ReopenProjectForRevisionUseCase } from './use-cases/reopen-project-for-revision.use-case';
import type { DeleteProjetoUseCase } from './use-cases/delete-projeto.use-case';
import type {
  AdvanceProjetoStatusUseCase,
  AdvanceProjetoStatusResult,
} from './use-cases/advance-projeto-status.use-case';
import { AdvanceStatusDto } from './dto/advance-status.dto';
import { IllegalStatusTransitionError } from '../../domain/proj/errors/illegal-status-transition.error';

/**
 * HTTP adapter for the PROJ (Projetos Editoriais) bounded context.
 *
 * P4 update: the four read endpoints (GET /projetos, GET /projetos/:id,
 * GET /projetos/:id/publicacoes, GET /projetos/:id/publicacoes/:pid/download)
 * are now wired to their respective use cases. The PROJ-009 port stubs provide
 * in-memory fallback data; degraded=true is surfaced when any port throws.
 *
 * P5 update (PROJ-014): every handler now takes `@CurrentUser()`, resolving
 * `empresaId` exclusively from the JWT claim (never from body/path/query).
 * `JwtAuthGuard` is registered globally via `APP_GUARD` in `app.module.ts`
 * (mirroring imp-service), so it protects every route below without this
 * file importing anything from `infrastructure/`. `@RequiredScopes()` (also
 * declared in `modules/proj/decorators/`) enforces the OAuth2 scope per
 * route: `proj:read` for reads, `proj:write` for mutations.
 *
 * RULE-04: this file is in modules/ and must NOT import from infrastructure/.
 */
@ApiTags('projetos')
@ApiBearerAuth('bearer')
@Controller({ path: 'proj', version: '1' })
export class ProjController {
  private readonly logger = new Logger(ProjController.name);

  constructor(
    @Inject(CREATE_PROJETO_USE_CASE)
    private readonly createUseCase: CreateProjetoEditorialUseCase,

    @Inject(REOPEN_PROJECT_USE_CASE)
    private readonly reopenUseCase: ReopenProjectForRevisionUseCase,

    @Inject(GET_PROJETO_LIBRARY_USE_CASE)
    private readonly libraryUseCase: GetProjetoLibraryUseCase,

    @Inject(GET_PROJETO_DETAIL_USE_CASE)
    private readonly detailUseCase: GetProjetoDetailUseCase,

    @Inject(GET_PUBLICATION_HISTORY_USE_CASE)
    private readonly historyUseCase: GetPublicationHistoryUseCase,

    @Inject(GET_SIGNED_DOWNLOAD_URL_USE_CASE)
    private readonly downloadUrlUseCase: GetSignedDownloadUrlUseCase,

    @Inject(DELETE_PROJETO_USE_CASE)
    private readonly deleteUseCase: DeleteProjetoUseCase,

    @Inject(ADVANCE_PROJETO_STATUS_USE_CASE)
    private readonly advanceStatusUseCase: AdvanceProjetoStatusUseCase,
  ) {}

  // ---------------------------------------------------------------------------
  // 4.1  POST /api/v1/proj/projetos — create an editorial project
  // ---------------------------------------------------------------------------

  @Post('projetos')
  @RequiredScopes('proj:write')
  @ApiOperation({ summary: 'Create a new editorial project' })
  @ApiCreatedResponse({
    type: ProjetoDetailDto,
    description: 'Project created (status = rascunho).',
  })
  async create(
    @Body() dto: CreateProjetoDto,
    @CurrentUser() user: UsuarioContext,
  ): Promise<ProjetoDetailDto> {
    const projeto = await this.createUseCase.execute(
      { nome: dto.nome, descricao: dto.descricao },
      user,
    );
    return {
      id: projeto.id,
      editoraId: projeto.editoraId,
      nome: projeto.nome,
      descricao: projeto.descricao ?? null,
      status: projeto.status,
      criadoEm: projeto.criadoEm.toISOString(),
      atualizadoEm: projeto.atualizadoEm.toISOString(),
      manuscriptSummary: null,
      metadata: null,
      publicationHistory: null,
      degraded: false,
    };
  }

  // ---------------------------------------------------------------------------
  // 4.2  GET /api/v1/proj/projetos — project library (T02)
  // ---------------------------------------------------------------------------

  @Get('projetos')
  @RequiredScopes('proj:read')
  @ApiOperation({ summary: 'List editorial projects of the active empresa (paginated)' })
  @ApiOkResponse({
    type: ProjetoLibraryPageDto,
    description:
      'A page of project cards. Pass `nextCursor` as `?cursor=` on the next request ' +
      'to retrieve the following page. `nextCursor` is null on the last page.',
  })
  @ApiHeader({
    name: 'X-Degraded',
    description:
      'Present and set to "true" when one or more cross-context read ports ' +
      'are operating in stub/fallback mode (SPEC-07). Response body shape is ' +
      'unchanged — cards contain safe defaults (0 counts, null autor).',
    required: false,
    schema: { type: 'string', enum: ['true'] },
  })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by project status' })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: LIBRARY_MAX_PAGE_SIZE, default: 25 },
    description: `Max items per page (1–${LIBRARY_MAX_PAGE_SIZE}). Rejected with 400 if above max.`,
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description:
      'Opaque pagination cursor from the previous response\'s `nextCursor` field. ' +
      'Rejected with 400 if the value cannot be decoded.',
  })
  async findAll(
    @CurrentUser() user: UsuarioContext,
    @Res({ passthrough: true }) res: Response,
    @Headers('authorization') authHeader?: string,
    @Query('status') status?: string,
    @Query('limit') rawLimit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<ProjetoLibraryPageDto> {
    const empresaId = user.empresaId;
    const bearerToken = authHeader?.replace(/^Bearer\s+/i, '') ?? undefined;

    // Validate and parse limit.
    let limit: number | undefined;
    if (rawLimit !== undefined) {
      const parsed = parseInt(rawLimit, 10);
      if (isNaN(parsed) || parsed < 1) {
        throw new BadRequestException('?limit must be a positive integer');
      }
      if (parsed > LIBRARY_MAX_PAGE_SIZE) {
        throw new BadRequestException(
          `?limit=${parsed} exceeds the maximum page size of ${LIBRARY_MAX_PAGE_SIZE}`,
        );
      }
      limit = parsed;
    }

    // Validate cursor (opaque base64 JSON — decode to detect corruption).
    if (cursor) {
      try {
        const raw = JSON.parse(Buffer.from(cursor, 'base64').toString('utf-8')) as unknown;
        if (
          typeof raw !== 'object' ||
          raw === null ||
          typeof (raw as Record<string, unknown>)['atualizadoEm'] !== 'string' ||
          typeof (raw as Record<string, unknown>)['id'] !== 'string'
        ) {
          throw new Error('missing fields');
        }
      } catch {
        throw new BadRequestException(
          '?cursor value is invalid or corrupted — use the nextCursor from a previous response',
        );
      }
    }

    const result = await this.libraryUseCase.execute({
      empresaId,
      bearerToken,
      status: status ? (status as unknown as ProjetoStatus) : undefined,
      limit,
      cursor,
    });

    if (result.degraded) {
      this.logger.warn(`GET /projetos degraded=true empresaId=${empresaId}`);
      res.setHeader('X-Degraded', 'true');
    }

    return { items: result.cards, nextCursor: result.nextCursor };
  }

  // ---------------------------------------------------------------------------
  // 4.3  GET /api/v1/proj/projetos/:projetoId — project detail
  // ---------------------------------------------------------------------------

  @Get('projetos/:projetoId')
  @RequiredScopes('proj:read')
  @ApiOperation({ summary: 'Get an editorial project by id' })
  @ApiOkResponse({ type: ProjetoDetailDto, description: 'Project detail.' })
  @ApiNotFoundResponse({ description: 'Project not found or belongs to a different empresa.' })
  async findOne(
    @Param('projetoId', ParseUUIDPipe) id: string,
    @CurrentUser() user: UsuarioContext,
    @Headers('authorization') authHeader?: string,
  ): Promise<ProjetoDetailDto> {
    const empresaId = user.empresaId;
    const bearerToken = authHeader?.replace(/^Bearer\s+/i, '') ?? undefined;
    const result = await this.detailUseCase.execute({ projetoId: id, empresaId, bearerToken });
    if (!result) {
      throw new NotFoundException(`ProjetoEditorial ${id} not found`);
    }
    if (result.degraded) {
      this.logger.warn(`GET /projetos/${id} degraded=true empresaId=${empresaId}`);
    }
    return result;
  }

  // ---------------------------------------------------------------------------
  // 4.4  GET /api/v1/proj/projetos/:projetoId/publicacoes — publication history (T08)
  // ---------------------------------------------------------------------------

  @Get('projetos/:projetoId/publicacoes')
  @RequiredScopes('proj:read')
  @ApiOperation({ summary: 'List publications for a project (T08)' })
  @ApiOkResponse({
    type: [PublicacaoHistoryItemDto],
    description: 'Publication history list, newest first.',
  })
  @ApiNotFoundResponse({ description: 'Project not found.' })
  async findPublicacoes(
    @Param('projetoId', ParseUUIDPipe) projetoId: string,
    @CurrentUser() user: UsuarioContext,
    @Headers('authorization') authHeader?: string,
  ): Promise<PublicacaoHistoryItemDto[]> {
    const empresaId = user.empresaId;
    const bearerToken = authHeader?.replace(/^Bearer\s+/i, '') ?? undefined;
    return this.historyUseCase.execute({ projetoId, empresaId, bearerToken });
  }

  // ---------------------------------------------------------------------------
  // 4.5  GET /api/v1/proj/projetos/:projetoId/publicacoes/:publicacaoId/download
  // ---------------------------------------------------------------------------

  @Get('projetos/:projetoId/publicacoes/:publicacaoId/download')
  @ApiOperation({
    summary: 'Get a short-TTL signed URL for downloading the ePub artifact',
  })
  @ApiOkResponse({
    type: SignedDownloadUrlDto,
    description: 'Signed download URL. Only available for valido/avisos publications.',
  })
  @ApiConflictResponse({
    description: 'Publication artifact is not available (erros_criticos or pendente).',
  })
  @ApiNotFoundResponse({ description: 'Project or publication not found.' })
  @RequiredScopes('proj:read')
  async getDownloadUrl(
    @Param('projetoId', ParseUUIDPipe) projetoId: string,
    @Param('publicacaoId', ParseUUIDPipe) publicacaoId: string,
    @CurrentUser() user: UsuarioContext,
    @Headers('authorization') authHeader?: string,
  ): Promise<SignedDownloadUrlDto> {
    const empresaId = user.empresaId;
    const bearerToken = authHeader?.replace(/^Bearer\s+/i, '') ?? undefined;
    return this.downloadUrlUseCase.execute({ projetoId, publicacaoId, empresaId, bearerToken });
  }

  // ---------------------------------------------------------------------------
  // 4.6  DELETE /api/v1/proj/projetos/:projetoId — LGPD erasure (D-G)
  // ---------------------------------------------------------------------------

  @Delete('projetos/:projetoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequiredScopes('proj:delete')
  @ApiOperation({
    summary: 'Delete a project and cascade LGPD erasure across all contexts',
  })
  @ApiNoContentResponse({
    description: 'Project and all associated data deleted (leaf-first cascade).',
  })
  @ApiNotFoundResponse({ description: 'Project not found in this empresa.' })
  @ApiResponse({
    status: 502,
    description: 'Erasure cascade aborted: a cross-context port (PUB/COMP/IMP) failed.',
  })
  async remove(
    @Param('projetoId', ParseUUIDPipe) projetoId: string,
    @CurrentUser() user: UsuarioContext,
    @Headers('authorization') authHeader?: string,
  ): Promise<void> {
    const bearerToken = authHeader?.replace(/^Bearer\s+/i, '') ?? undefined;
    await this.deleteUseCase.execute({ projetoId, bearerToken }, user);
  }

  // ---------------------------------------------------------------------------
  // 4.7  POST /api/v1/proj/projetos/:projetoId/reopen — reopen for a new revision (G6)
  // ---------------------------------------------------------------------------

  @Post('projetos/:projetoId/reopen')
  @HttpCode(HttpStatus.OK)
  @RequiredScopes('proj:write')
  @ApiOperation({
    summary: 'Reopen a published/com_erros project for a new revision',
  })
  @ApiOkResponse({
    type: ProjetoDetailDto,
    description: 'Project detail after transition to em_composicao.',
  })
  @ApiResponse({
    status: 409,
    description: 'The project cannot be reopened from its current status (rascunho).',
  })
  async reopen(
    @Param('projetoId', ParseUUIDPipe) projetoId: string,
    @CurrentUser() user: UsuarioContext,
  ): Promise<ProjetoDetailDto> {
    const result = await this.reopenProjeto(projetoId, user);
    return {
      id: result.projetoId,
      editoraId: user.empresaId,
      nome: '',
      descricao: null,
      status: result.newStatus,
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      manuscriptSummary: null,
      metadata: null,
      publicationHistory: null,
      degraded: false,
    };
  }

  /**
   * Maps the domain-level `IllegalStatusTransitionError` (thrown by
   * `ProjectStatusVO.reopen` for a `rascunho` project) onto the HTTP 409
   * documented in api-contract §4.7 / §7. The use case stays framework-free
   * (RULE-01/02); only this HTTP adapter knows about `ConflictException`.
   */
  private async reopenProjeto(
    projetoId: string,
    user: UsuarioContext,
  ): Promise<{ projetoId: string; newStatus: string }> {
    try {
      return await this.reopenUseCase.reopen(projetoId, user);
    } catch (err) {
      if (err instanceof IllegalStatusTransitionError) {
        throw new ConflictException({
          message: err.message,
          type: 'urn:cordele:proj:illegal-status-transition',
          from: err.from,
          to: err.to,
        });
      }
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // 4.8  POST /api/v1/proj/projetos/:projetoId/advance-status — advance status (G4/INT-PUB-003)
  // ---------------------------------------------------------------------------

  @Post('projetos/:projetoId/advance-status')
  @HttpCode(HttpStatus.OK)
  @RequiredScopes('proj:write')
  @ApiOperation({
    summary: 'Advance the status of a project (called by PUB via HTTP after export)',
  })
  @ApiOkResponse({
    description: 'Status advanced (or idempotent no-op). Returns projetoId, newStatus and changed flag.',
  })
  @ApiResponse({
    status: 409,
    description: 'Illegal status transition from the current state to the requested target.',
  })
  @ApiNotFoundResponse({ description: 'Project not found in this empresa.' })
  async advanceStatus(
    @Param('projetoId', ParseUUIDPipe) projetoId: string,
    @Body() dto: AdvanceStatusDto,
    @CurrentUser() user: UsuarioContext,
  ): Promise<AdvanceProjetoStatusResult> {
    return this.callAdvanceStatus(projetoId, dto, user);
  }

  /**
   * Maps `IllegalStatusTransitionError` (domain) onto HTTP 409 for the
   * advance-status route (§4.8 / api-contract §7). Same pattern as
   * `reopenProjeto` above.
   *
   * RULE-04: stays in modules/; only this adapter touches `ConflictException`.
   */
  private async callAdvanceStatus(
    projetoId: string,
    dto: AdvanceStatusDto,
    user: UsuarioContext,
  ): Promise<AdvanceProjetoStatusResult> {
    try {
      return await this.advanceStatusUseCase.advanceTo(
        { projetoId, targetStatus: dto.targetStatus },
        user,
      );
    } catch (err) {
      if (err instanceof IllegalStatusTransitionError) {
        throw new ConflictException({
          message: err.message,
          type: 'urn:cordele:proj:illegal-status-transition',
          from: err.from,
          to: err.to,
        });
      }
      throw err;
    }
  }
}
