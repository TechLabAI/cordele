import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiCreatedResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { CreateProjetoDto } from './dto/create-projeto.dto';
import { ProjetoDetailDto } from './dto/projeto-detail.dto';
import { ProjetoCardDto } from './dto/projeto-card.dto';
import { PublicacaoHistoryItemDto } from './dto/publicacao-history-item.dto';
import { SignedDownloadUrlDto } from './dto/signed-download-url.dto';
import {
  CREATE_PROJETO_USE_CASE,
  REOPEN_PROJECT_USE_CASE,
  GET_PROJETO_LIBRARY_USE_CASE,
  GET_PROJETO_DETAIL_USE_CASE,
  GET_PUBLICATION_HISTORY_USE_CASE,
  GET_SIGNED_DOWNLOAD_URL_USE_CASE,
} from './proj.tokens';
import type { GetProjetoLibraryUseCase } from './use-cases/get-projeto-library.use-case';
import type { GetProjetoDetailUseCase } from './use-cases/get-projeto-detail.use-case';
import type { GetPublicationHistoryUseCase } from './use-cases/get-publication-history.use-case';
import type { GetSignedDownloadUrlUseCase } from './use-cases/get-signed-download-url.use-case';
import type { CreateProjetoEditorialUseCase } from './use-cases/create-projeto-editorial.use-case';
import type { ReopenProjectForRevisionUseCase } from './use-cases/reopen-project-for-revision.use-case';

/**
 * HTTP adapter for the PROJ (Projetos Editoriais) bounded context.
 *
 * P4 update: the four read endpoints (GET /projetos, GET /projetos/:id,
 * GET /projetos/:id/publicacoes, GET /projetos/:id/publicacoes/:pid/download)
 * are now wired to their respective use cases. The PROJ-009 port stubs provide
 * in-memory fallback data; degraded=true is surfaced when any port throws.
 *
 * JWT guards are intentionally absent in P4 — @UseGuards and @CurrentUser
 * are added in P5 (PROJ-014) after security infrastructure is stable.
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
  ) {}

  // ---------------------------------------------------------------------------
  // 4.1  POST /api/v1/proj/projetos — create an editorial project
  // ---------------------------------------------------------------------------

  @Post('projetos')
  @ApiOperation({ summary: 'Create a new editorial project' })
  @ApiCreatedResponse({
    type: ProjetoDetailDto,
    description: 'Project created (status = rascunho).',
  })
  async create(@Body() dto: CreateProjetoDto): Promise<ProjetoDetailDto> {
    // P5 will inject @CurrentUser here and derive empresaId from the JWT claim.
    // For P4 placeholder: empresaId is the default empresa until JWT is wired.
    const user = { id: 'system', empresaId: 'emp_aetos', scopes: [] };
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
  @ApiOperation({ summary: 'List editorial projects of the active empresa' })
  @ApiOkResponse({
    type: [ProjetoCardDto],
    description: 'Paginated project card list.',
  })
  @ApiQuery({ name: 'status', required: false, description: 'Filter by project status' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max items (reserved, not enforced in POC)' })
  @ApiQuery({ name: 'cursor', required: false, description: 'Pagination cursor (reserved, not enforced in POC)' })
  async findAll(
    @Query('status') status?: string,
    @Query('limit') limit?: number,
    @Query('cursor') cursor?: string,
  ): Promise<ProjetoCardDto[]> {
    // P5 will inject @CurrentUser here. For now use a placeholder empresa context.
    const empresaId = 'emp_aetos';
    const result = await this.libraryUseCase.execute({ empresaId, status: status as any, limit, cursor });
    if (result.degraded) {
      this.logger.warn(`GET /projetos degraded=true empresaId=${empresaId}`);
    }
    return result.cards;
  }

  // ---------------------------------------------------------------------------
  // 4.3  GET /api/v1/proj/projetos/:projetoId — project detail
  // ---------------------------------------------------------------------------

  @Get('projetos/:projetoId')
  @ApiOperation({ summary: 'Get an editorial project by id' })
  @ApiOkResponse({ type: ProjetoDetailDto, description: 'Project detail.' })
  @ApiNotFoundResponse({ description: 'Project not found or belongs to a different empresa.' })
  async findOne(
    @Param('projetoId', ParseUUIDPipe) id: string,
  ): Promise<ProjetoDetailDto> {
    const empresaId = 'emp_aetos';
    const result = await this.detailUseCase.execute({ projetoId: id, empresaId });
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
  @ApiOperation({ summary: 'List publications for a project (T08)' })
  @ApiOkResponse({
    type: [PublicacaoHistoryItemDto],
    description: 'Publication history list, newest first.',
  })
  @ApiNotFoundResponse({ description: 'Project not found.' })
  async findPublicacoes(
    @Param('projetoId', ParseUUIDPipe) projetoId: string,
  ): Promise<PublicacaoHistoryItemDto[]> {
    const empresaId = 'emp_aetos';
    return this.historyUseCase.execute({ projetoId, empresaId });
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
  async getDownloadUrl(
    @Param('projetoId', ParseUUIDPipe) projetoId: string,
    @Param('publicacaoId', ParseUUIDPipe) publicacaoId: string,
  ): Promise<SignedDownloadUrlDto> {
    const empresaId = 'emp_aetos';
    return this.downloadUrlUseCase.execute({ projetoId, publicacaoId, empresaId });
  }

  // ---------------------------------------------------------------------------
  // 4.6  DELETE /api/v1/proj/projetos/:projetoId — LGPD erasure (D-G)
  // ---------------------------------------------------------------------------

  @Delete('projetos/:projetoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a project and cascade LGPD erasure across all contexts',
  })
  @ApiNoContentResponse({
    description: 'Project and all associated data deleted (leaf-first cascade).',
  })
  remove(@Param('projetoId', ParseUUIDPipe) _id: string): void {
    // P6 stub — real implementation in P6 (PROJ-016: DeleteProjetoUseCase).
  }

  // ---------------------------------------------------------------------------
  // 4.7  POST /api/v1/proj/projetos/:projetoId/reopen — reopen for a new revision (G6)
  // ---------------------------------------------------------------------------

  @Post('projetos/:projetoId/reopen')
  @ApiOperation({
    summary: 'Reopen a published/com_erros project for a new revision',
  })
  @ApiOkResponse({
    type: ProjetoDetailDto,
    description: 'Project detail after transition to em_composicao.',
  })
  async reopen(
    @Param('projetoId', ParseUUIDPipe) projetoId: string,
  ): Promise<ProjetoDetailDto> {
    const user = { id: 'system', empresaId: 'emp_aetos', scopes: [] };
    const result = await this.reopenUseCase.reopen(projetoId, user);
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
}
