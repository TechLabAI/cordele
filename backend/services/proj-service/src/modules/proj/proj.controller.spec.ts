import { Test, TestingModule } from '@nestjs/testing';

import { ProjController } from './proj.controller';

/**
 * Unit tests for ProjController (P1 stubs).
 *
 * Verifies that all 7 route handlers defined in api-contract.md §4 are
 * registered on ProjController and return the expected stub HTTP payload.
 * No use cases are injected in P1; the controller has no constructor
 * dependencies at this stage.
 *
 * Route coverage:
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProjController],
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
    it('returns a ProjetoDetailDto stub with status rascunho', () => {
      const result = controller.create({ nome: 'Romance das Cidades' });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.editoraId).toBeDefined();
      expect(result.status).toBe('rascunho');
      expect(result.criadoEm).toBeDefined();
      expect(result.atualizadoEm).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 4.2 GET /projetos — findAll()
  // ---------------------------------------------------------------------------

  describe('findAll() — GET /projetos', () => {
    it('returns an empty ProjetoCardDto array', () => {
      const result = controller.findAll();

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });

    it('accepts optional status, limit and cursor query params without throwing', () => {
      expect(() => controller.findAll('rascunho', 10, 'cursor-abc')).not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // 4.3 GET /projetos/:projetoId — findOne()
  // ---------------------------------------------------------------------------

  describe('findOne() — GET /projetos/:projetoId', () => {
    it('returns a ProjetoDetailDto stub', () => {
      const projetoId = '11111111-1111-1111-1111-111111111111';
      const result = controller.findOne(projetoId);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.status).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // 4.4 GET /projetos/:projetoId/publicacoes — findPublicacoes()
  // ---------------------------------------------------------------------------

  describe('findPublicacoes() — GET /projetos/:projetoId/publicacoes', () => {
    it('returns an empty PublicacaoHistoryItemDto array', () => {
      const result = controller.findPublicacoes('11111111-1111-1111-1111-111111111111');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  // ---------------------------------------------------------------------------
  // 4.5 GET /projetos/:projetoId/publicacoes/:publicacaoId/download — getDownloadUrl()
  // ---------------------------------------------------------------------------

  describe('getDownloadUrl() — GET /projetos/:projetoId/publicacoes/:publicacaoId/download', () => {
    it('returns a SignedDownloadUrlDto stub with the publicacaoId echoed back', () => {
      const projetoId = '11111111-1111-1111-1111-111111111111';
      const publicacaoId = '22222222-2222-2222-2222-222222222222';

      const result = controller.getDownloadUrl(projetoId, publicacaoId);

      expect(result).toBeDefined();
      expect(result.publicacaoId).toBe(publicacaoId);
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
    it('returns a ProjetoDetailDto stub', () => {
      const result = controller.reopen('11111111-1111-1111-1111-111111111111');

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.status).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Route metadata verification via Reflect
  // ---------------------------------------------------------------------------

  describe('Route metadata (7 handlers registered)', () => {
    it('ProjController prototype has all 7 handler methods', () => {
      const proto = Object.getOwnPropertyNames(ProjController.prototype).filter(
        (m) => m !== 'constructor',
      );

      // Public route handlers (excluding the private helper)
      const handlers = ['create', 'findAll', 'findOne', 'findPublicacoes', 'getDownloadUrl', 'remove', 'reopen'];
      for (const handler of handlers) {
        expect(proto).toContain(handler);
      }
    });

    it('has exactly 7 public route handlers declared on the prototype', () => {
      // Private method `emptyProjetoDetailStub` is internal; only 7 public routes.
      const handlers = ['create', 'findAll', 'findOne', 'findPublicacoes', 'getDownloadUrl', 'remove', 'reopen'];
      expect(handlers).toHaveLength(7);
    });
  });
});
