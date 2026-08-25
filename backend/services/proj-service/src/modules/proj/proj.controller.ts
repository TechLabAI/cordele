import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiCreatedResponse,
  ApiTags,
} from '@nestjs/swagger';

import { CreateProjetoDto } from './dto/create-projeto.dto';
import { ProjetoDetailDto } from './dto/projeto-detail.dto';
import { ProjetoCardDto } from './dto/projeto-card.dto';
import { PublicacaoHistoryItemDto } from './dto/publicacao-history-item.dto';
import { SignedDownloadUrlDto } from './dto/signed-download-url.dto';

/**
 * HTTP adapter for the PROJ (Projetos Editoriais) bounded context.
 *
 * P1 stubs: all 7 routes are registered with correct paths, HTTP verbs and
 * response types (aligned with api-contract.md §4). Handlers return typed
 * empty stubs; real use cases are wired in P2-P4. JWT guards are intentionally
 * absent in P1 — @UseGuards and @CurrentUser are added in P5 (PROJ-014) after
 * security infrastructure is stable.
 *
 * RULE-04: this file must NOT import from src/infrastructure/.
 */
@ApiTags('projetos')
@ApiBearerAuth('bearer')
@Controller({ path: 'proj', version: '1' })
export class ProjController {
  // P2 will inject the use-case services here via DI tokens from proj.tokens.ts.

  // ---------------------------------------------------------------------------
  // 4.1  POST /api/v1/proj/projetos — create an editorial project
  // ---------------------------------------------------------------------------

  @Post('projetos')
  @ApiOperation({ summary: 'Create a new editorial project' })
  @ApiCreatedResponse({
    type: ProjetoDetailDto,
    description: 'Project created (status = rascunho).',
  })
  create(@Body() _dto: CreateProjetoDto): ProjetoDetailDto {
    // P1 stub — real implementation in P2 (PROJ-003: CreateProjetoUseCase).
    return this.emptyProjetoDetailStub();
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
  findAll(
    @Query('status') _status?: string,
    @Query('limit') _limit?: number,
    @Query('cursor') _cursor?: string,
  ): ProjetoCardDto[] {
    // P1 stub — real implementation in P4 (PROJ-010: GetProjetoLibraryUseCase).
    return [];
  }

  // ---------------------------------------------------------------------------
  // 4.3  GET /api/v1/proj/projetos/:projetoId — project detail
  // ---------------------------------------------------------------------------

  @Get('projetos/:projetoId')
  @ApiOperation({ summary: 'Get an editorial project by id' })
  @ApiOkResponse({ type: ProjetoDetailDto, description: 'Project detail.' })
  findOne(@Param('projetoId', ParseUUIDPipe) _id: string): ProjetoDetailDto {
    // P1 stub — real implementation in P4 (PROJ-011: GetProjetoDetailUseCase).
    return this.emptyProjetoDetailStub();
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
  findPublicacoes(
    @Param('projetoId', ParseUUIDPipe) _projetoId: string,
  ): PublicacaoHistoryItemDto[] {
    // P1 stub — real implementation in P4 (PROJ-012: GetPublicationHistoryUseCase).
    return [];
  }

  // ---------------------------------------------------------------------------
  // 4.5  GET /api/v1/proj/projetos/:projetoId/publicacoes/:publicacaoId/download
  //      — signed ePub download URL (D-F)
  // ---------------------------------------------------------------------------

  @Get('projetos/:projetoId/publicacoes/:publicacaoId/download')
  @ApiOperation({
    summary: 'Get a short-TTL signed URL for downloading the ePub artifact',
  })
  @ApiOkResponse({
    type: SignedDownloadUrlDto,
    description: 'Signed download URL. Only available for valido/avisos publications.',
  })
  getDownloadUrl(
    @Param('projetoId', ParseUUIDPipe) _projetoId: string,
    @Param('publicacaoId', ParseUUIDPipe) publicacaoId: string,
  ): SignedDownloadUrlDto {
    // P1 stub — real implementation in P4 (PROJ-013: GetSignedDownloadUrlUseCase).
    return {
      publicacaoId,
      arquivoUrl: '',
      expiresAt: new Date().toISOString(),
    };
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
    // P1 stub — real implementation in P6 (PROJ-016: DeleteProjetoUseCase).
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
  reopen(@Param('projetoId', ParseUUIDPipe) _projetoId: string): ProjetoDetailDto {
    // P1 stub — real implementation in P2 (PROJ-005: ReopenProjectUseCase).
    return this.emptyProjetoDetailStub();
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private emptyProjetoDetailStub(): ProjetoDetailDto {
    const now = new Date().toISOString();
    return {
      id: '00000000-0000-0000-0000-000000000000',
      editoraId: '00000000-0000-0000-0000-000000000000',
      nome: '',
      descricao: null,
      status: 'rascunho',
      criadoEm: now,
      atualizadoEm: now,
      manuscriptSummary: null,
      metadata: null,
      publicationHistory: null,
      degraded: false,
    };
  }
}
