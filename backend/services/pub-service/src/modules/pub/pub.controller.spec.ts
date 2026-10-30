/**
 * Unit spec for PubController (PUB-001).
 *
 * Covers all seven route handlers:
 *   4.1 POST  projetos/:projetoId/publicacoes           → trigger()
 *   4.2 GET   .../publicacoes/:publicacaoId/status       → status()
 *   4.3 GET   .../publicacoes                            → history()
 *   4.4 GET   .../publicacoes/:publicacaoId/download     → downloadUrl()
 *   4.5 GET   .../publicacoes/stats                      → stats()
 *   4.6 GET   .../publicacoes/:publicacaoId/validation-messages → listValidationMessages()
 *   4.7 POST  publications/latest-batch                  → latestBatch()
 *
 * Use cases are mocked via the token Symbols from pub.tokens.ts and injected
 * through @nestjs/testing Test.createTestingModule — the standard pattern for
 * NestJS controller unit tests.
 *
 * RULE-04 compliance is structural: the spec lives in modules/ and does NOT
 * import anything from infrastructure/.
 */

import { HttpStatus } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { EpubcheckStatus } from '../../domain/pub/epubcheck-status.enum';
import { PublicacaoEntity } from '../../domain/pub/publicacao.entity';
import { PublicacaoStatus } from '../../domain/pub/publicacao-status.enum';
import { ValidationMessageEntity } from '../../domain/pub/validation-message.entity';
import { ValidationSeverity } from '../../domain/pub/validation-severity.enum';
import { type AuthenticatedUser } from '../../domain/auth/authenticated-user';
import {
  GENERATE_PUBLICATION_USE_CASE,
  GET_LATEST_BATCH_USE_CASE,
  GET_PUBLICATION_HISTORY_USE_CASE,
  GET_PUBLICATION_STATS_USE_CASE,
  GET_PUBLICATION_STATUS_USE_CASE,
  GET_SIGNED_DOWNLOAD_URL_USE_CASE,
  LIST_VALIDATION_MESSAGES_USE_CASE,
} from './pub.tokens';
import { type GetLatestBatchUseCase } from './use-cases/get-latest-batch.use-case';
import { type LatestBatchResponseItemDto } from './dto/latest-batch-response-item.dto';
import { type GeneratePublicationUseCase } from './use-cases/generate-publication.use-case';
import { type GetPublicationHistoryUseCase } from './use-cases/get-publication-history.use-case';
import { type GetPublicationStatsUseCase } from './use-cases/get-publication-stats.use-case';
import { type GetPublicationStatusUseCase } from './use-cases/get-publication-status.use-case';
import { type GetSignedDownloadUrlUseCase } from './use-cases/get-signed-download-url.use-case';
import { type ListValidationMessagesUseCase } from './use-cases/list-validation-messages.use-case';
import { PubController } from './pub.controller';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const PROJETO_ID = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const PUBLICACAO_ID = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

const makeUser = (): AuthenticatedUser => ({
  userId: 'user-001',
  username: 'editor',
  roles: ['pub-user'],
  scopes: ['pub:read', 'pub:write'],
  empresaId: 'aetos',
});

/** Factory for a non-terminal `gerando` publication. */
const makeGerando = (): PublicacaoEntity =>
  PublicacaoEntity.iniciar({
    id: PUBLICACAO_ID,
    projetoId: PROJETO_ID,
    sequencia: 1,
    iniciadaEm: new Date('2026-01-01T10:00:00.000Z'),
  });

/** Factory for a terminal `publicado` publication. */
const makePublicado = (): PublicacaoEntity =>
  makeGerando()
    .iniciarValidacao()
    .concluirPublicado({
      artefatoRef: `publicacoes/${PUBLICACAO_ID}/output.epub`,
      epubcheckStatus: EpubcheckStatus.VALIDO,
      totalErros: 0,
      totalAvisos: 0,
      concluidaEm: new Date('2026-01-01T10:05:00.000Z'),
    });

/** Minimal mock of a Response object (passthrough mode — NestJS manages the status). */
const makeRes = (): {
  status: jest.Mock;
  setHeader: jest.Mock;
} => ({
  status: jest.fn(),
  setHeader: jest.fn(),
});

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

describe('PubController', () => {
  let controller: PubController;

  let generateUseCase: jest.Mocked<GeneratePublicationUseCase>;
  let statusUseCase: jest.Mocked<GetPublicationStatusUseCase>;
  let historyUseCase: jest.Mocked<GetPublicationHistoryUseCase>;
  let downloadUrlUseCase: jest.Mocked<GetSignedDownloadUrlUseCase>;
  let statsUseCase: jest.Mocked<GetPublicationStatsUseCase>;
  let listValidationMessagesUseCase: jest.Mocked<ListValidationMessagesUseCase>;
  let latestBatchUseCase: jest.Mocked<GetLatestBatchUseCase>;

  beforeEach(async () => {
    generateUseCase = { execute: jest.fn() } as unknown as jest.Mocked<GeneratePublicationUseCase>;
    statusUseCase = { execute: jest.fn() } as unknown as jest.Mocked<GetPublicationStatusUseCase>;
    historyUseCase = { execute: jest.fn() } as unknown as jest.Mocked<GetPublicationHistoryUseCase>;
    downloadUrlUseCase = { execute: jest.fn() } as unknown as jest.Mocked<GetSignedDownloadUrlUseCase>;
    statsUseCase = { execute: jest.fn() } as unknown as jest.Mocked<GetPublicationStatsUseCase>;
    listValidationMessagesUseCase = { execute: jest.fn() } as unknown as jest.Mocked<ListValidationMessagesUseCase>;
    latestBatchUseCase = { execute: jest.fn() } as unknown as jest.Mocked<GetLatestBatchUseCase>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PubController],
      providers: [
        { provide: GENERATE_PUBLICATION_USE_CASE, useValue: generateUseCase },
        { provide: GET_PUBLICATION_STATUS_USE_CASE, useValue: statusUseCase },
        { provide: GET_PUBLICATION_HISTORY_USE_CASE, useValue: historyUseCase },
        { provide: GET_SIGNED_DOWNLOAD_URL_USE_CASE, useValue: downloadUrlUseCase },
        { provide: GET_PUBLICATION_STATS_USE_CASE, useValue: statsUseCase },
        { provide: LIST_VALIDATION_MESSAGES_USE_CASE, useValue: listValidationMessagesUseCase },
        { provide: GET_LATEST_BATCH_USE_CASE, useValue: latestBatchUseCase },
      ],
    }).compile();

    controller = module.get<PubController>(PubController);
  });

  // -------------------------------------------------------------------------
  // 4.1 trigger() — POST projetos/:projetoId/publicacoes
  // -------------------------------------------------------------------------

  describe('trigger()', () => {
    it('returns 202 Accepted and Location header when a new build is enqueued (D-N)', async () => {
      const publicacao = makeGerando();
      generateUseCase.execute.mockResolvedValue({ publicacao, isNew: true });
      const res = makeRes();

      const dto = await controller.trigger(PROJETO_ID, makeUser(), 'Bearer tok123', res as never);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.ACCEPTED);
      expect(res.setHeader).toHaveBeenCalledWith(
        'Location',
        `/api/v1/pub/projetos/${PROJETO_ID}/publicacoes/${PUBLICACAO_ID}`,
      );
      expect(dto.publicacaoId).toBe(PUBLICACAO_ID);
      expect(dto.status).toBe(PublicacaoStatus.GERANDO);
      expect(dto.arquivoDisponivel).toBe(false);
    });

    it('returns 200 OK when an in-flight build already exists (D-R idempotent)', async () => {
      const publicacao = makeGerando();
      generateUseCase.execute.mockResolvedValue({ publicacao, isNew: false });
      const res = makeRes();

      const dto = await controller.trigger(PROJETO_ID, makeUser(), 'Bearer tok123', res as never);

      expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(dto.publicacaoId).toBe(PUBLICACAO_ID);
    });

    it('strips the Bearer prefix before forwarding the token to the use case', async () => {
      const publicacao = makeGerando();
      generateUseCase.execute.mockResolvedValue({ publicacao, isNew: true });
      const user = makeUser();
      const res = makeRes();

      await controller.trigger(PROJETO_ID, user, 'Bearer rawtoken', res as never);

      expect(generateUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ bearerToken: 'rawtoken' }),
        user,
      );
    });

    it('forwards an empty string when the authorization header is absent', async () => {
      const publicacao = makeGerando();
      generateUseCase.execute.mockResolvedValue({ publicacao, isNew: true });
      const res = makeRes();

      await controller.trigger(PROJETO_ID, makeUser(), undefined, res as never);

      expect(generateUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({ bearerToken: '' }),
        makeUser(),
      );
    });
  });

  // -------------------------------------------------------------------------
  // 4.2 status() — GET .../publicacoes/:publicacaoId/status
  // -------------------------------------------------------------------------

  describe('status()', () => {
    it('adds Retry-After header and returns the DTO when the build is non-terminal (D-P)', async () => {
      const publicacao = makeGerando();
      statusUseCase.execute.mockResolvedValue(publicacao);
      const res = makeRes();

      const dto = await controller.status(PROJETO_ID, PUBLICACAO_ID, makeUser(), res as never);

      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '2');
      expect(dto.publicacaoId).toBe(PUBLICACAO_ID);
      expect(dto.status).toBe(PublicacaoStatus.GERANDO);
    });

    it('does NOT add Retry-After header when the build has reached a terminal state', async () => {
      const publicacao = makePublicado();
      statusUseCase.execute.mockResolvedValue(publicacao);
      const res = makeRes();

      const dto = await controller.status(PROJETO_ID, PUBLICACAO_ID, makeUser(), res as never);

      expect(res.setHeader).not.toHaveBeenCalled();
      expect(dto.status).toBe(PublicacaoStatus.PUBLICADO);
      expect(dto.arquivoDisponivel).toBe(true);
    });

    it('delegates with the correct input to the use case', async () => {
      const publicacao = makeGerando();
      statusUseCase.execute.mockResolvedValue(publicacao);
      const user = makeUser();
      const res = makeRes();

      await controller.status(PROJETO_ID, PUBLICACAO_ID, user, res as never);

      expect(statusUseCase.execute).toHaveBeenCalledWith(
        { projetoId: PROJETO_ID, publicacaoId: PUBLICACAO_ID },
        user,
      );
    });
  });

  // -------------------------------------------------------------------------
  // 4.3 history() — GET .../publicacoes
  // -------------------------------------------------------------------------

  describe('history()', () => {
    it('returns an empty array when the project has no exports (T08)', async () => {
      historyUseCase.execute.mockResolvedValue([]);

      const result = await controller.history(PROJETO_ID, makeUser());

      expect(result).toEqual([]);
      expect(historyUseCase.execute).toHaveBeenCalledWith({ projetoId: PROJETO_ID }, makeUser());
    });

    it('maps each PublicacaoEntity to a PublicacaoHistoryItemDto', async () => {
      const publicacao = makePublicado();
      historyUseCase.execute.mockResolvedValue([publicacao]);

      const result = await controller.history(PROJETO_ID, makeUser());

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        publicacaoId: PUBLICACAO_ID,
        projetoId: PROJETO_ID,
        epubcheckStatus: EpubcheckStatus.VALIDO,
        totalErros: 0,
        totalAvisos: 0,
        arquivoUrl: null,
        criadoEm: '2026-01-01T10:00:00.000Z',
      });
    });
  });

  // -------------------------------------------------------------------------
  // 4.4 downloadUrl() — GET .../publicacoes/:publicacaoId/download
  // -------------------------------------------------------------------------

  describe('downloadUrl()', () => {
    it('returns a DownloadUrlDto on success (D-F/D-R)', async () => {
      const signed = {
        publicacaoId: PUBLICACAO_ID,
        arquivoUrl: 'https://cdn.example.com/output.epub?token=abc',
        expiresAt: '2026-01-01T10:10:00.000Z',
      };
      downloadUrlUseCase.execute.mockResolvedValue(signed);
      const user = makeUser();

      const result = await controller.downloadUrl(PROJETO_ID, PUBLICACAO_ID, user);

      expect(result).toEqual(signed);
      expect(downloadUrlUseCase.execute).toHaveBeenCalledWith(
        { projetoId: PROJETO_ID, publicacaoId: PUBLICACAO_ID },
        user,
      );
    });
  });

  // -------------------------------------------------------------------------
  // 4.5 stats() — GET .../publicacoes/stats
  // -------------------------------------------------------------------------

  describe('stats()', () => {
    it('delegates to the use case and returns the stats DTO (D-O)', async () => {
      const statsResult = {
        projetoId: PROJETO_ID,
        total: 3,
        publicadas: 2,
        comAvisos: 1,
        comErros: 1,
        emAndamento: 0,
        ultimoStatus: PublicacaoStatus.PUBLICADO,
        ultimoEpubcheckStatus: EpubcheckStatus.AVISOS,
        ultimaPublicacaoEm: '2026-01-01T10:00:00.000Z',
      };
      statsUseCase.execute.mockResolvedValue(statsResult);
      const user = makeUser();

      const result = await controller.stats(PROJETO_ID, user);

      expect(result).toEqual(statsResult);
      expect(statsUseCase.execute).toHaveBeenCalledWith({ projetoId: PROJETO_ID }, user);
    });

    it('returns all-zero stats when the project was never exported', async () => {
      const empty = {
        projetoId: PROJETO_ID,
        total: 0,
        publicadas: 0,
        comAvisos: 0,
        comErros: 0,
        emAndamento: 0,
        ultimoStatus: null,
        ultimoEpubcheckStatus: null,
        ultimaPublicacaoEm: null,
      };
      statsUseCase.execute.mockResolvedValue(empty);

      const result = await controller.stats(PROJETO_ID, makeUser());

      expect(result.total).toBe(0);
      expect(result.ultimoStatus).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // 4.6 listValidationMessages() — GET .../publicacoes/:publicacaoId/validation-messages
  // -------------------------------------------------------------------------

  describe('listValidationMessages()', () => {
    it('returns an empty array when no validation messages exist for the publication', async () => {
      listValidationMessagesUseCase.execute.mockResolvedValue([]);

      const result = await controller.listValidationMessages(
        PROJETO_ID,
        PUBLICACAO_ID,
        undefined,
        makeUser(),
      );

      expect(result).toEqual([]);
      expect(listValidationMessagesUseCase.execute).toHaveBeenCalledWith(
        { projetoId: PROJETO_ID, publicacaoId: PUBLICACAO_ID, severity: undefined },
        makeUser(),
      );
    });

    it('maps ValidationMessageEntity to the flat DTO shape', async () => {
      const entity = new ValidationMessageEntity({
        id: 'msg-001',
        publicacaoId: PUBLICACAO_ID,
        severity: ValidationSeverity.ERROR,
        code: 'RSC-005',
        message: 'Referência de recurso ausente',
        location: 'EPUB/content.opf:42',
        ordem: 0,
        criadoEm: new Date('2026-01-01T10:05:00.000Z'),
      });
      listValidationMessagesUseCase.execute.mockResolvedValue([entity]);

      const result = await controller.listValidationMessages(
        PROJETO_ID,
        PUBLICACAO_ID,
        'error',
        makeUser(),
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        id: 'msg-001',
        severity: ValidationSeverity.ERROR,
        code: 'RSC-005',
        message: 'Referência de recurso ausente',
        location: 'EPUB/content.opf:42',
        ordem: 0,
      });
    });

    it('maps ValidationMessageEntity with no location to location: null', async () => {
      const entity = new ValidationMessageEntity({
        id: 'msg-002',
        publicacaoId: PUBLICACAO_ID,
        severity: ValidationSeverity.WARNING,
        code: 'OPF-003',
        message: 'Campo opcional ausente',
        ordem: 1,
        criadoEm: new Date('2026-01-01T10:05:00.000Z'),
      });
      listValidationMessagesUseCase.execute.mockResolvedValue([entity]);

      const result = await controller.listValidationMessages(
        PROJETO_ID,
        PUBLICACAO_ID,
        'warning',
        makeUser(),
      );

      expect(result[0]?.location).toBeNull();
    });

    it('forwards the severity filter to the use case', async () => {
      listValidationMessagesUseCase.execute.mockResolvedValue([]);
      const user = makeUser();

      await controller.listValidationMessages(PROJETO_ID, PUBLICACAO_ID, 'warning', user);

      expect(listValidationMessagesUseCase.execute).toHaveBeenCalledWith(
        { projetoId: PROJETO_ID, publicacaoId: PUBLICACAO_ID, severity: 'warning' },
        user,
      );
    });
  });

  // -------------------------------------------------------------------------
  // 4.7 latestBatch() — POST publications/latest-batch
  // -------------------------------------------------------------------------

  describe('latestBatch()', () => {
    const PROJETO_B = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
    const PUB_B = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';

    it('returns empty array when projetoIds is empty', async () => {
      latestBatchUseCase.execute.mockResolvedValue([]);
      const result = await controller.latestBatch({ projetoIds: [] }, makeUser());
      expect(result).toEqual([]);
      expect(latestBatchUseCase.execute).toHaveBeenCalledWith({ projetoIds: [] }, makeUser());
    });

    it('delegates to the use case and returns the batch result', async () => {
      const items: LatestBatchResponseItemDto[] = [
        { projetoId: PROJETO_ID, publicacaoId: PUBLICACAO_ID, epubcheckStatus: EpubcheckStatus.VALIDO },
        { projetoId: PROJETO_B, publicacaoId: PUB_B, epubcheckStatus: EpubcheckStatus.PENDENTE },
      ];
      latestBatchUseCase.execute.mockResolvedValue(items);
      const user = makeUser();

      const result = await controller.latestBatch({ projetoIds: [PROJETO_ID, PROJETO_B] }, user);

      expect(result).toHaveLength(2);
      expect(result).toEqual(items);
      expect(latestBatchUseCase.execute).toHaveBeenCalledWith(
        { projetoIds: [PROJETO_ID, PROJETO_B] },
        user,
      );
    });

    it('omits projects with no publications (use case responsibility — controller passes through)', async () => {
      // Only PROJETO_ID has a publication; PROJETO_B absent from result = never published
      const items: LatestBatchResponseItemDto[] = [
        { projetoId: PROJETO_ID, publicacaoId: PUBLICACAO_ID, epubcheckStatus: EpubcheckStatus.VALIDO },
      ];
      latestBatchUseCase.execute.mockResolvedValue(items);

      const result = await controller.latestBatch({ projetoIds: [PROJETO_ID, PROJETO_B] }, makeUser());

      expect(result).toHaveLength(1);
      expect(result[0]!.projetoId).toBe(PROJETO_ID);
    });
  });

  // -------------------------------------------------------------------------
  // DTO shape validation — toStatusDto() private mapping
  // -------------------------------------------------------------------------

  describe('toStatusDto() mapping (via trigger)', () => {
    it('maps a publicado entity to arquivoDisponivel=true and non-null concluidaEm', async () => {
      const publicacao = makePublicado();
      generateUseCase.execute.mockResolvedValue({ publicacao, isNew: true });
      const res = makeRes();

      const dto = await controller.trigger(PROJETO_ID, makeUser(), 'Bearer t', res as never);

      expect(dto.arquivoDisponivel).toBe(true);
      expect(dto.concluidaEm).toBe('2026-01-01T10:05:00.000Z');
      expect(dto.iniciadaEm).toBe('2026-01-01T10:00:00.000Z');
      expect(dto.resumoErro).toBeNull();
    });

    it('maps a gerando entity to arquivoDisponivel=false and null concluidaEm', async () => {
      const publicacao = makeGerando();
      generateUseCase.execute.mockResolvedValue({ publicacao, isNew: true });
      const res = makeRes();

      const dto = await controller.trigger(PROJETO_ID, makeUser(), 'Bearer t', res as never);

      expect(dto.arquivoDisponivel).toBe(false);
      expect(dto.concluidaEm).toBeNull();
    });
  });
});
