import {
  Controller,
  Get,
  Headers,
  HttpStatus,
  Inject,
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
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { type AuthenticatedUser } from '../../domain/auth/authenticated-user';
import { PublicacaoEntity } from '../../domain/pub/publicacao.entity';
import { CurrentUser } from './decorators/current-user.decorator';
import { RequiredScopes } from './decorators/require-scope.decorator';
import { PublicacaoHistoryItemDto } from './dto/publicacao-history-item.dto';
import { PublicacaoStatusDto } from './dto/publicacao-status.dto';
import { PublicationStatsDto } from './dto/publication-stats.dto';
import { DownloadUrlDto } from './dto/download-url.dto';
import { ValidationMessageItemDto } from './dto/validation-message-item.dto';
import {
  GENERATE_PUBLICATION_USE_CASE,
  GET_PUBLICATION_HISTORY_USE_CASE,
  GET_PUBLICATION_STATS_USE_CASE,
  GET_PUBLICATION_STATUS_USE_CASE,
  GET_SIGNED_DOWNLOAD_URL_USE_CASE,
  LIST_VALIDATION_MESSAGES_USE_CASE,
} from './pub.tokens';
import { type GeneratePublicationUseCase } from './use-cases/generate-publication.use-case';
import { type GetPublicationHistoryUseCase } from './use-cases/get-publication-history.use-case';
import { type GetPublicationStatsUseCase } from './use-cases/get-publication-stats.use-case';
import { type GetPublicationStatusUseCase } from './use-cases/get-publication-status.use-case';
import { type GetSignedDownloadUrlUseCase } from './use-cases/get-signed-download-url.use-case';
import { type ListValidationMessagesUseCase } from './use-cases/list-validation-messages.use-case';

/**
 * HTTP adapter for the PUB (Publicação) bounded context (api-contract.md §4).
 *
 * P2: the five routes are wired to the real use cases (PUB-003..006). No
 * infra behind the outbound ports yet (P3 persistence, P4 adapters) — this
 * controller and its use cases are unit-tested with mocked ports; the app
 * boots end-to-end once those bindings land.
 *
 * `JwtAuthGuard` is registered globally via `APP_GUARD` in `app.module.ts`
 * (mirroring imp-service/proj-service), so it protects every route below
 * without this file importing anything from `infrastructure/`.
 *
 * RULE-04: this file is in modules/ and does NOT import from infrastructure/.
 */
@ApiTags('pub')
@ApiBearerAuth('bearer')
@Controller({ path: 'pub', version: '1' })
export class PubController {
  constructor(
    @Inject(GENERATE_PUBLICATION_USE_CASE)
    private readonly generateUseCase: GeneratePublicationUseCase,
    @Inject(GET_PUBLICATION_STATUS_USE_CASE)
    private readonly statusUseCase: GetPublicationStatusUseCase,
    @Inject(GET_PUBLICATION_HISTORY_USE_CASE)
    private readonly historyUseCase: GetPublicationHistoryUseCase,
    @Inject(GET_SIGNED_DOWNLOAD_URL_USE_CASE)
    private readonly downloadUrlUseCase: GetSignedDownloadUrlUseCase,
    @Inject(GET_PUBLICATION_STATS_USE_CASE)
    private readonly statsUseCase: GetPublicationStatsUseCase,
    @Inject(LIST_VALIDATION_MESSAGES_USE_CASE)
    private readonly listValidationMessagesUseCase: ListValidationMessagesUseCase,
  ) {}

  // ---------------------------------------------------------------------
  // 4.1 POST /api/v1/pub/projetos/:projetoId/publicacoes — trigger export (T07)
  // ---------------------------------------------------------------------
  @Post('projetos/:projetoId/publicacoes')
  @RequiredScopes('pub:write')
  @ApiOperation({ summary: 'Trigger an ePub 3 export for a project (T07)' })
  @ApiCreatedResponse({
    type: PublicacaoStatusDto,
    description: 'Build enqueued (202), or the in-flight build returned (200, D-R).',
  })
  async trigger(
    @Param('projetoId', ParseUUIDPipe) projetoId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Headers('authorization') authHeader: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicacaoStatusDto> {
    // Strip "Bearer " prefix to obtain the raw JWT for downstream propagation
    // (INT-PUB-001, INT-PUB-003): the token is passed explicitly through
    // GeneratePublicationInput so the async PublicationBuildJob can forward it
    // to IMP and PROJ HTTP adapters after the request context is gone.
    const bearerToken = authHeader?.replace(/^Bearer\s+/i, '') ?? '';
    const { publicacao, isNew } = await this.generateUseCase.execute({ projetoId, bearerToken }, user);
    res.status(isNew ? HttpStatus.ACCEPTED : HttpStatus.OK);
    res.setHeader(
      'Location',
      `/api/v1/pub/projetos/${projetoId}/publicacoes/${publicacao.id}`,
    );
    return this.toStatusDto(publicacao);
  }

  // ---------------------------------------------------------------------
  // 4.2 GET .../publicacoes/:publicacaoId/status — poll build status (T07)
  // ---------------------------------------------------------------------
  @Get('projetos/:projetoId/publicacoes/:publicacaoId/status')
  @RequiredScopes('pub:read')
  @ApiOperation({ summary: 'Poll the build status of a publication (T07)' })
  @ApiOkResponse({ type: PublicacaoStatusDto })
  @ApiNotFoundResponse({ description: 'publicacaoId not found in this project/empresa.' })
  async status(
    @Param('projetoId', ParseUUIDPipe) projetoId: string,
    @Param('publicacaoId', ParseUUIDPipe) publicacaoId: string,
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicacaoStatusDto> {
    const publicacao = await this.statusUseCase.execute({ projetoId, publicacaoId }, user);
    if (!publicacao.isTerminal()) {
      res.setHeader('Retry-After', '2');
    }
    return this.toStatusDto(publicacao);
  }

  // ---------------------------------------------------------------------
  // 4.3 GET .../publicacoes — publication history (T08)
  // ---------------------------------------------------------------------
  @Get('projetos/:projetoId/publicacoes')
  @RequiredScopes('pub:read')
  @ApiOperation({ summary: 'List the publication history of a project (T08)' })
  @ApiOkResponse({ type: [PublicacaoHistoryItemDto] })
  async history(
    @Param('projetoId', ParseUUIDPipe) projetoId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PublicacaoHistoryItemDto[]> {
    const publicacoes = await this.historyUseCase.execute({ projetoId }, user);
    return publicacoes.map((publicacao) => this.toHistoryItemDto(publicacao));
  }

  // ---------------------------------------------------------------------
  // 4.4 GET .../publicacoes/:publicacaoId/download — signed download URL (T08)
  // ---------------------------------------------------------------------
  @Get('projetos/:projetoId/publicacoes/:publicacaoId/download')
  @RequiredScopes('pub:read')
  @ApiOperation({ summary: 'Mint a short-TTL signed download URL (T08, D-F/D-R)' })
  @ApiOkResponse({ type: DownloadUrlDto })
  @ApiConflictResponse({ description: 'Artifact not available (erros_criticos or pendente).' })
  @ApiNotFoundResponse({ description: 'publicacaoId not found in this project/empresa.' })
  async downloadUrl(
    @Param('projetoId', ParseUUIDPipe) projetoId: string,
    @Param('publicacaoId', ParseUUIDPipe) publicacaoId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DownloadUrlDto> {
    return this.downloadUrlUseCase.execute({ projetoId, publicacaoId }, user);
  }

  // ---------------------------------------------------------------------
  // 4.5 GET .../publicacoes/stats — publication KPIs (T07/T08, D-O)
  // ---------------------------------------------------------------------
  @Get('projetos/:projetoId/publicacoes/stats')
  @RequiredScopes('pub:read')
  @ApiOperation({ summary: 'Get publication KPIs for a project (D-O)' })
  @ApiOkResponse({ type: PublicationStatsDto })
  async stats(
    @Param('projetoId', ParseUUIDPipe) projetoId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<PublicationStatsDto> {
    return this.statsUseCase.execute({ projetoId }, user);
  }

  // ---------------------------------------------------------------------
  // 4.6 GET .../publicacoes/:publicacaoId/validation-messages — detailed list (PUB-016)
  // ---------------------------------------------------------------------
  @Get('projetos/:projetoId/publicacoes/:publicacaoId/validation-messages')
  @RequiredScopes('pub:read')
  @ApiOperation({
    summary: 'List detailed epubcheck validation messages for a publication (PUB-016)',
  })
  @ApiOkResponse({
    type: [ValidationMessageItemDto],
    description: 'Validation messages ordered by ordem ASC.',
  })
  @ApiNotFoundResponse({ description: 'publicacaoId not found in this project/empresa.' })
  @ApiQuery({
    name: 'severity',
    required: false,
    enum: ['error', 'warning', 'info'],
    description: 'Filter by severity. When omitted, all severities are returned.',
  })
  async listValidationMessages(
    @Param('projetoId', ParseUUIDPipe) projetoId: string,
    @Param('publicacaoId', ParseUUIDPipe) publicacaoId: string,
    @Query('severity') severity: string | undefined,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ValidationMessageItemDto[]> {
    const messages = await this.listValidationMessagesUseCase.execute(
      { projetoId, publicacaoId, severity },
      user,
    );
    return messages.map((msg) => ({
      id: msg.id,
      severity: msg.severity,
      code: msg.code,
      message: msg.message,
      location: msg.location ?? null,
      ordem: msg.ordem,
    }));
  }

  // ---------------------------------------------------------------------
  // DTO mapping (RULE: Prisma/domain models never returned from a controller)
  // ---------------------------------------------------------------------

  private toStatusDto(publicacao: PublicacaoEntity): PublicacaoStatusDto {
    return {
      publicacaoId: publicacao.id,
      projetoId: publicacao.projetoId,
      status: publicacao.status,
      epubcheckStatus: publicacao.epubcheckStatus,
      sequencia: publicacao.sequencia,
      totalErros: publicacao.totalErros,
      totalAvisos: publicacao.totalAvisos,
      resumoErro: publicacao.resumoErro ?? null,
      arquivoDisponivel: publicacao.arquivoDisponivel(),
      iniciadaEm: publicacao.iniciadaEm.toISOString(),
      concluidaEm: publicacao.concluidaEm?.toISOString() ?? null,
      // ADR-004: KPIs de resumo — nulos enquanto build em andamento ou com_erros
      tamanhoBytes: publicacao.tamanhoBytes ?? null,
      totalCapitulos: publicacao.totalCapitulos ?? null,
      totalImagens: publicacao.totalImagens ?? null,
    };
  }

  private toHistoryItemDto(publicacao: PublicacaoEntity): PublicacaoHistoryItemDto {
    return {
      publicacaoId: publicacao.id,
      projetoId: publicacao.projetoId,
      epubcheckStatus: publicacao.epubcheckStatus,
      totalErros: publicacao.totalErros,
      totalAvisos: publicacao.totalAvisos,
      erros: publicacao.resumoErro ?? null,
      arquivoUrl: null,
      criadoEm: publicacao.iniciadaEm.toISOString(),
    };
  }
}
