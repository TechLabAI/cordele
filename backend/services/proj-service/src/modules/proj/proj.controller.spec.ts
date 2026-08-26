import { Test, TestingModule } from '@nestjs/testing';

import { ProjController } from './proj.controller';
import {
  CREATE_PROJETO_USE_CASE,
  REOPEN_PROJECT_USE_CASE,
  GET_PROJETO_LIBRARY_USE_CASE,
  GET_PROJETO_DETAIL_USE_CASE,
  GET_PUBLICATION_HISTORY_USE_CASE,
  GET_SIGNED_DOWNLOAD_URL_USE_CASE,
} from './proj.tokens';

/**
 * Unit tests for ProjController (P4 update).
 *
 * The controller now has use case dependencies injected via DI tokens.
 * This spec mocks all use cases so the controller can be tested in isolation.
 *
 * Route coverage (7 handlers from api-contract.md §4):
 *   POST   /projetos                                         → 201 ProjetoDetailDto
 *   GET    /projetos                                         → 200 ProjetoCardDto[]
 *   GET    /projetos/:projetoId                              → 200 ProjetoDetailDto
 *   GET    /projetos/:projetoId/publicacoes                  → 200 PublicacaoHistoryItemDto[]
 *   GET    /projetos/:projetoId/publicacoes/:id/download     → 200 SignedDownloadUrlDto
 *   DELETE /projetos/:projetoId                              → 204 (void)
 *   POST   /projetos/:projetoId/reopen                       → 200 ProjetoDetailDto
 */
describe('ProjController', () => {
  let controller: ProjController;

  const NOW = new Date('2026-08-25T10:00:00Z');

  const mockCreateUseCase = {
    execute: jest.fn().mockResolvedValue({
      id: 'proj-id-1',
      nome: 'Romance das Cidades',
      descricao: null,
      editoraId: 'emp_aetos',
      status: 'rascunho',
      criadoEm: NOW,
      atualizadoEm: NOW,
    }),
  };

  const mockReopenUseCase = {
    reopen: jest.fn().mockResolvedValue({
      projetoId: 'proj-id-1',
      newStatus: 'em_composicao',
      changed: true,
    }),
  };

  const mockLibraryUseCase = {
    execute: jest.fn().mockResolvedValue({ cards: [], degraded: false }),
  };

  const mockDetailUseCase = {
    execute: jest.fn().mockResolvedValue({
      id: 'proj-id-1',
      editoraId: 'emp_aetos',
      nome: 'Romance das Cidades',
      descricao: null,
      status: 'rascunho',
      criadoEm: NOW.toISOString(),
      atualizadoEm: NOW.toISOString(),
      manuscriptSummary: null,
      metadata: null,
      publicationHistory: null,
      degraded: false,
    }),
  };

  const mockHistoryUseCase = {
    execute: jest.fn().mockResolvedValue([]),
  };

  const mockDownloadUrlUseCase = {
    execute: jest.fn().mockResolvedValue({
      publicacaoId: 'pub-id-1',
      arquivoUrl: 'https://storage.example.com/epub.epub?sig=abc',
      expiresAt: NOW.toISOString(),
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjController],
      providers: [
        { provide: CREATE_PROJETO_USE_CASE, useValue: mockCreateUseCase },
        { provide: REOPEN_PROJECT_USE_CASE, useValue: mockReopenUseCase },
        { provide: GET_PROJETO_LIBRARY_USE_CASE, useValue: mockLibraryUseCase },
        { provide: GET_PROJETO_DETAIL_USE_CASE, useValue: mockDetailUseCase },
        { provide: GET_PUBLICATION_HISTORY_USE_CASE, useValue: mockHistoryUseCase },
        { provide: GET_SIGNED_DOWNLOAD_URL_USE_CASE, useValue: mockDownloadUrlUseCase },
      ],
    }).compile();

    controller = module.get<ProjController>(ProjController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // 4.1 POST /projetos — create()
  // ---------------------------------------------------------------------------

  describe('create() — POST /projetos', () => {
    it('returns a ProjetoDetailDto with status rascunho', async () => {
      const result = await controller.create({ nome: 'Romance das Cidades' });

      expect(result).toBeDefined();
      expect(result.id).toBe('proj-id-1');
      expect(result.status).toBe('rascunho');
      expect(result.criadoEm).toBeDefined();
      expect(result.atualizadoEm).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 4.2 GET /projetos — findAll()
  // ---------------------------------------------------------------------------

  describe('findAll() — GET /projetos', () => {
    it('returns a ProjetoCardDto array from library use case', async () => {
      const result = await controller.findAll();

      expect(Array.isArray(result)).toBe(true);
      expect(mockLibraryUseCase.execute).toHaveBeenCalledTimes(1);
    });

    it('accepts optional status, limit and cursor query params without throwing', async () => {
      await expect(controller.findAll('rascunho', 10, 'cursor-abc')).resolves.toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 4.3 GET /projetos/:projetoId — findOne()
  // ---------------------------------------------------------------------------

  describe('findOne() — GET /projetos/:projetoId', () => {
    it('returns a ProjetoDetailDto from detail use case', async () => {
      const projetoId = '11111111-1111-1111-1111-111111111111';
      const result = await controller.findOne(projetoId);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.status).toBeDefined();
    });

    it('throws NotFoundException when detail use case returns null', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      mockDetailUseCase.execute.mockResolvedValueOnce(null);

      await expect(
        controller.findOne('11111111-1111-1111-1111-111111111111'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // 4.4 GET /projetos/:projetoId/publicacoes — findPublicacoes()
  // ---------------------------------------------------------------------------

  describe('findPublicacoes() — GET /projetos/:projetoId/publicacoes', () => {
    it('returns a PublicacaoHistoryItemDto array from history use case', async () => {
      const result = await controller.findPublicacoes('11111111-1111-1111-1111-111111111111');

      expect(Array.isArray(result)).toBe(true);
      expect(mockHistoryUseCase.execute).toHaveBeenCalledTimes(1);
    });
  });

  // ---------------------------------------------------------------------------
  // 4.5 GET /projetos/:projetoId/publicacoes/:publicacaoId/download — getDownloadUrl()
  // ---------------------------------------------------------------------------

  describe('getDownloadUrl() — GET .../download', () => {
    it('returns a SignedDownloadUrlDto from download URL use case', async () => {
      const projetoId = '11111111-1111-1111-1111-111111111111';
      const publicacaoId = '22222222-2222-2222-2222-222222222222';

      const result = await controller.getDownloadUrl(projetoId, publicacaoId);

      expect(result).toBeDefined();
      expect(result.publicacaoId).toBeDefined();
      expect(result.arquivoUrl).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 4.6 DELETE /projetos/:projetoId — remove()
  // ---------------------------------------------------------------------------

  describe('remove() — DELETE /projetos/:projetoId', () => {
    it('returns void without throwing (204 stub)', () => {
      expect(() =>
        controller.remove('11111111-1111-1111-1111-111111111111'),
      ).not.toThrow();
    });

    it('returns undefined (no body for 204)', () => {
      const result = controller.remove('11111111-1111-1111-1111-111111111111');
      expect(result).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 4.7 POST /projetos/:projetoId/reopen — reopen()
  // ---------------------------------------------------------------------------

  describe('reopen() — POST /projetos/:projetoId/reopen', () => {
    it('returns a ProjetoDetailDto with the new status', async () => {
      const result = await controller.reopen('11111111-1111-1111-1111-111111111111');

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.status).toBe('em_composicao');
    });
  });

  // ---------------------------------------------------------------------------
  // Route metadata verification
  // ---------------------------------------------------------------------------

  describe('Route metadata (7 handlers registered)', () => {
    it('ProjController prototype has all 7 handler methods', () => {
      const proto = Object.getOwnPropertyNames(ProjController.prototype).filter(
        (m) => m !== 'constructor',
      );

      const handlers = ['create', 'findAll', 'findOne', 'findPublicacoes', 'getDownloadUrl', 'remove', 'reopen'];
      for (const handler of handlers) {
        expect(proto).toContain(handler);
      }
    });
  });
});
