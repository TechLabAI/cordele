import { Test, TestingModule } from '@nestjs/testing';

import { ProjController } from './proj.controller';
import { REQUIRED_SCOPES_KEY } from './decorators/require-scope.decorator';
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
import { ProjetoStatus } from '../../domain/proj/value-objects/project-status.vo';

/**
 * Unit tests for ProjController (P5 update + §4.8 advance-status).
 *
 * The controller now has use case dependencies injected via DI tokens.
 * This spec mocks all use cases so the controller can be tested in isolation.
 * `@CurrentUser()` is not exercised at the decorator level here (Nest resolves
 * it via `JwtAuthGuard` + Passport at the HTTP layer, covered by
 * `jwt-auth.guard.spec.ts`); every handler call below passes a plain
 * `UsuarioContext` object to simulate what the decorator would inject.
 *
 * Route coverage (8 handlers from api-contract.md §4):
 *   POST   /projetos                                              → 201 ProjetoDetailDto
 *   GET    /projetos                                              → 200 ProjetoCardDto[]
 *   GET    /projetos/:projetoId                                   → 200 ProjetoDetailDto
 *   GET    /projetos/:projetoId/publicacoes                       → 200 PublicacaoHistoryItemDto[]
 *   GET    /projetos/:projetoId/publicacoes/:id/download          → 200 SignedDownloadUrlDto
 *   DELETE /projetos/:projetoId                                   → 204 (void)
 *   POST   /projetos/:projetoId/reopen                            → 200 ProjetoDetailDto
 *   POST   /projetos/:projetoId/advance-status                    → 200 AdvanceProjetoStatusResult
 */
describe('ProjController', () => {
  let controller: ProjController;

  const NOW = new Date('2026-08-25T10:00:00Z');
  const user = { id: 'user-1', empresaId: 'emp_aetos', scopes: ['proj:read', 'proj:write'] };

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

  const mockDeleteUseCase = {
    execute: jest.fn().mockResolvedValue(undefined),
  };

  const mockAdvanceStatusUseCase = {
    advanceTo: jest.fn().mockResolvedValue({
      projetoId: 'proj-id-1',
      newStatus: ProjetoStatus.publicado,
      changed: true,
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
        { provide: DELETE_PROJETO_USE_CASE, useValue: mockDeleteUseCase },
        { provide: ADVANCE_PROJETO_STATUS_USE_CASE, useValue: mockAdvanceStatusUseCase },
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
      const result = await controller.create({ nome: 'Romance das Cidades' }, user);

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
      const result = await controller.findAll(user);

      expect(Array.isArray(result)).toBe(true);
      expect(mockLibraryUseCase.execute).toHaveBeenCalledTimes(1);
    });

    it('accepts optional status, limit and cursor query params without throwing', async () => {
      await expect(
        controller.findAll(user, 'rascunho', 10, 'cursor-abc'),
      ).resolves.toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 4.3 GET /projetos/:projetoId — findOne()
  // ---------------------------------------------------------------------------

  describe('findOne() — GET /projetos/:projetoId', () => {
    it('returns a ProjetoDetailDto from detail use case', async () => {
      const projetoId = '11111111-1111-1111-1111-111111111111';
      const result = await controller.findOne(projetoId, user);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.status).toBeDefined();
    });

    it('throws NotFoundException when detail use case returns null', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      mockDetailUseCase.execute.mockResolvedValueOnce(null);

      await expect(
        controller.findOne('11111111-1111-1111-1111-111111111111', user),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // 4.4 GET /projetos/:projetoId/publicacoes — findPublicacoes()
  // ---------------------------------------------------------------------------

  describe('findPublicacoes() — GET /projetos/:projetoId/publicacoes', () => {
    it('returns a PublicacaoHistoryItemDto array from history use case', async () => {
      const result = await controller.findPublicacoes(
        '11111111-1111-1111-1111-111111111111',
        user,
      );

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

      const result = await controller.getDownloadUrl(projetoId, publicacaoId, user);

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
    it('delegates to DeleteProjetoUseCase and returns undefined (no body for 204)', async () => {
      const projetoId = '11111111-1111-1111-1111-111111111111';

      const result = await controller.remove(projetoId, user);

      expect(mockDeleteUseCase.execute).toHaveBeenCalledWith({ projetoId }, user);
      expect(result).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 4.7 POST /projetos/:projetoId/reopen — reopen()
  // ---------------------------------------------------------------------------

  describe('reopen() — POST /projetos/:projetoId/reopen', () => {
    it('returns a ProjetoDetailDto with the new status', async () => {
      const result = await controller.reopen('11111111-1111-1111-1111-111111111111', user);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.status).toBe('em_composicao');
    });
  });

  // ---------------------------------------------------------------------------
  // 4.8 POST /projetos/:projetoId/advance-status — advanceStatus()
  // ---------------------------------------------------------------------------

  describe('advanceStatus() — POST /projetos/:projetoId/advance-status', () => {
    const projetoId = '11111111-1111-1111-1111-111111111111';

    it('returns projetoId, newStatus and changed=true on successful advance', async () => {
      const result = await controller.advanceStatus(
        projetoId,
        { targetStatus: ProjetoStatus.publicado },
        user,
      );

      expect(result).toEqual({
        projetoId: 'proj-id-1',
        newStatus: ProjetoStatus.publicado,
        changed: true,
      });
      expect(mockAdvanceStatusUseCase.advanceTo).toHaveBeenCalledWith(
        { projetoId, targetStatus: ProjetoStatus.publicado },
        user,
      );
    });

    it('returns changed=false for idempotent no-op', async () => {
      mockAdvanceStatusUseCase.advanceTo.mockResolvedValueOnce({
        projetoId,
        newStatus: ProjetoStatus.publicado,
        changed: false,
      });

      const result = await controller.advanceStatus(
        projetoId,
        { targetStatus: ProjetoStatus.publicado },
        user,
      );

      expect(result.changed).toBe(false);
    });

    it('maps IllegalStatusTransitionError to ConflictException (409)', async () => {
      const { ConflictException } = await import('@nestjs/common');
      const { IllegalStatusTransitionError } = await import(
        '../../domain/proj/errors/illegal-status-transition.error'
      );

      mockAdvanceStatusUseCase.advanceTo.mockRejectedValueOnce(
        new IllegalStatusTransitionError(
          ProjetoStatus.rascunho,
          ProjetoStatus.publicado,
          'rascunho cannot advance directly to publicado',
        ),
      );

      await expect(
        controller.advanceStatus(
          projetoId,
          { targetStatus: ProjetoStatus.publicado },
          user,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('propagates NotFoundException when project is not found', async () => {
      const { NotFoundException } = await import('@nestjs/common');
      mockAdvanceStatusUseCase.advanceTo.mockRejectedValueOnce(
        new NotFoundException(`ProjetoEditorial ${projetoId} not found in this empresa`),
      );

      await expect(
        controller.advanceStatus(
          projetoId,
          { targetStatus: ProjetoStatus.com_erros },
          user,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ---------------------------------------------------------------------------
  // Route metadata verification
  // ---------------------------------------------------------------------------

  describe('Route metadata (8 handlers registered)', () => {
    it('ProjController prototype has all 8 handler methods', () => {
      const proto = Object.getOwnPropertyNames(ProjController.prototype).filter(
        (m) => m !== 'constructor',
      );

      const handlers = [
        'create',
        'findAll',
        'findOne',
        'findPublicacoes',
        'getDownloadUrl',
        'remove',
        'reopen',
        'advanceStatus',
      ];
      for (const handler of handlers) {
        expect(proto).toContain(handler);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // P5 (PROJ-014): @RequiredScopes metadata — enforced by JwtAuthGuard (403)
  // ---------------------------------------------------------------------------

  describe('@RequiredScopes metadata', () => {
    const scopesOf = (handler: keyof ProjController): string[] =>
      Reflect.getMetadata(REQUIRED_SCOPES_KEY, ProjController.prototype[handler]);

    it('requires proj:write for mutating routes', () => {
      expect(scopesOf('create')).toEqual(['proj:write']);
      expect(scopesOf('remove')).toEqual(['proj:write']);
      expect(scopesOf('reopen')).toEqual(['proj:write']);
      expect(scopesOf('advanceStatus')).toEqual(['proj:write']);
    });

    it('requires proj:read for read routes', () => {
      expect(scopesOf('findAll')).toEqual(['proj:read']);
      expect(scopesOf('findOne')).toEqual(['proj:read']);
      expect(scopesOf('findPublicacoes')).toEqual(['proj:read']);
      expect(scopesOf('getDownloadUrl')).toEqual(['proj:read']);
    });
  });
});
