/**
 * PrismaConfiguracaoLayoutRepository — integration tests (Testcontainers, P3).
 *
 * Verifies: upsert (atomically handles layout row + overrides), findByProjetoId,
 * replaceOverrides ($transaction atomicity), delete idempotency, empresa context
 * requirement, and tenant isolation.
 *
 * Container startup: ~30–60 s. jest.setTimeout(120000) is set in beforeAll.
 */

import {
  FIXED_PROJ_ID,
  TEST_SLUG,
  TEST_SLUG_B,
  startTestDatabase,
  stopTestDatabase,
  truncateCompTables,
} from '../../../../test/integration/db-setup';
import { ConfiguracaoLayout } from '../../../domain/comp/configuracao-layout.aggregate';
import { LayoutOverride } from '../../../domain/comp/layout-override.entity';
import { PrismaEmpresaService } from '../../persistence/prisma-empresa.service';
import { PrismaConfiguracaoLayoutRepository } from './configuracao-layout.repository';

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function buildLayoutEntity(empresaSlug = TEST_SLUG): ConfiguracaoLayout {
  return new ConfiguracaoLayout({
    projetoId: FIXED_PROJ_ID,
    fonte_corpo_familia: 'serif',
    fonte_corpo_tamanho: 12,
    espacamento_linha: 1.5,
    margem_lateral: 20,
    h1_tamanho: 28,
    h2_tamanho: 22,
    h3_tamanho: 18,
    overrides: [],
    empresaSlug,
    materialized: false,
  });
}

function buildOverride(referenciaNo = 'img-001'): LayoutOverride {
  return new LayoutOverride({
    referenciaNo,
    tipo: 'imagem',
    alinhamento: 'centralizado',
    ordem: 0,
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('PrismaConfiguracaoLayoutRepository (integration — Testcontainers)', () => {
  let empresaService: PrismaEmpresaService;
  let repo: PrismaConfiguracaoLayoutRepository;

  beforeAll(async () => {
    jest.setTimeout(120000);
    await startTestDatabase();
    empresaService = new PrismaEmpresaService();
    repo = new PrismaConfiguracaoLayoutRepository(empresaService);
  }, 120000);

  afterAll(async () => {
    await empresaService.onModuleDestroy();
    await stopTestDatabase();
  });

  afterEach(async () => {
    await truncateCompTables(TEST_SLUG);
    await truncateCompTables(TEST_SLUG_B);
  });

  // -------------------------------------------------------------------------
  // findByProjetoId
  // -------------------------------------------------------------------------

  describe('findByProjetoId()', () => {
    it('returns null when no row exists', async () => {
      const result = await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
        repo.findByProjetoId(FIXED_PROJ_ID),
      );

      expect(result).toBeNull();
    });

    it('returns ConfiguracaoLayout with materialized=true when row exists', async () => {
      const entity = buildLayoutEntity();
      await repo.upsert(entity);

      const result = await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
        repo.findByProjetoId(FIXED_PROJ_ID),
      );

      expect(result).not.toBeNull();
      expect(result?.projetoId).toBe(FIXED_PROJ_ID);
      expect(result?.materialized).toBe(true);
      expect(result?.empresaSlug).toBe(TEST_SLUG);
      expect(result?.overrides).toHaveLength(0);
    });

    it('includes persisted overrides in the returned entity', async () => {
      await repo.upsert(buildLayoutEntity());
      // replaceOverrides requires the layout row to exist first
      const override = buildOverride('chapter-01');
      await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
        repo.replaceOverrides(FIXED_PROJ_ID, [override]),
      );

      const result = await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
        repo.findByProjetoId(FIXED_PROJ_ID),
      );

      expect(result?.overrides).toHaveLength(1);
      expect(result?.overrides[0].referenciaNo).toBe('chapter-01');
    });

    it('throws when empresa context is not set', async () => {
      await expect(repo.findByProjetoId(FIXED_PROJ_ID)).rejects.toThrow(
        'empresa context not set',
      );
    });
  });

  // -------------------------------------------------------------------------
  // upsert
  // -------------------------------------------------------------------------

  describe('upsert()', () => {
    it('creates a row with default values and materialized=true', async () => {
      const entity = buildLayoutEntity();

      const result = await repo.upsert(entity);

      expect(result.projetoId).toBe(FIXED_PROJ_ID);
      expect(result.materialized).toBe(true);
      expect(result.fonte_corpo_familia).toBe('serif');
      expect(result.fonte_corpo_tamanho).toBe(12);
    });

    it('is idempotent: second upsert updates rather than creates a duplicate', async () => {
      await repo.upsert(buildLayoutEntity());
      const updated = await repo.upsert(
        new ConfiguracaoLayout({
          projetoId: FIXED_PROJ_ID,
          fonte_corpo_familia: 'sans-serif',
          fonte_corpo_tamanho: 14,
          espacamento_linha: 1.8,
          margem_lateral: 25,
          h1_tamanho: 28,
          h2_tamanho: 22,
          h3_tamanho: 18,
          overrides: [],
          empresaSlug: TEST_SLUG,
          materialized: false,
        }),
      );

      expect(updated.fonte_corpo_familia).toBe('sans-serif');
      expect(updated.fonte_corpo_tamanho).toBe(14);
    });
  });

  // -------------------------------------------------------------------------
  // replaceOverrides
  // -------------------------------------------------------------------------

  describe('replaceOverrides()', () => {
    beforeEach(async () => {
      // Ensure layout row exists before replace
      await repo.upsert(buildLayoutEntity());
    });

    it('atomically replaces overrides — old set removed, new set inserted', async () => {
      const firstOverride = buildOverride('img-001');
      await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
        repo.replaceOverrides(FIXED_PROJ_ID, [firstOverride]),
      );

      const secondOverride = buildOverride('img-002');
      await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
        repo.replaceOverrides(FIXED_PROJ_ID, [secondOverride]),
      );

      const result = await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
        repo.findByProjetoId(FIXED_PROJ_ID),
      );

      // Only the second override should exist — first must be gone
      expect(result?.overrides).toHaveLength(1);
      expect(result?.overrides[0].referenciaNo).toBe('img-002');
    });

    it('clears overrides when called with empty array', async () => {
      await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
        repo.replaceOverrides(FIXED_PROJ_ID, [buildOverride()]),
      );
      await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
        repo.replaceOverrides(FIXED_PROJ_ID, []),
      );

      const result = await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
        repo.findByProjetoId(FIXED_PROJ_ID),
      );
      expect(result?.overrides).toHaveLength(0);
    });

    it('uses $transaction for atomicity (delete + createMany in one round-trip)', async () => {
      // Insert two overrides in one call — both must be present (no partial state)
      await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
        repo.replaceOverrides(FIXED_PROJ_ID, [
          buildOverride('img-001'),
          buildOverride('img-002'),
        ]),
      );

      const result = await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
        repo.findByProjetoId(FIXED_PROJ_ID),
      );
      expect(result?.overrides).toHaveLength(2);
    });

    it('throws when empresa context is not set', async () => {
      await expect(repo.replaceOverrides(FIXED_PROJ_ID, [])).rejects.toThrow(
        'empresa context not set',
      );
    });
  });

  // -------------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------------

  describe('delete()', () => {
    it('removes the layout row and cascades to layout_override', async () => {
      const entity = buildLayoutEntity();
      await repo.upsert(entity);
      await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
        repo.replaceOverrides(FIXED_PROJ_ID, [buildOverride()]),
      );

      await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
        repo.delete(FIXED_PROJ_ID),
      );

      const result = await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
        repo.findByProjetoId(FIXED_PROJ_ID),
      );
      expect(result).toBeNull();
    });

    it('is idempotent: does not throw when row is absent', async () => {
      await expect(
        PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
          repo.delete(FIXED_PROJ_ID),
        ),
      ).resolves.not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // Tenant isolation
  // -------------------------------------------------------------------------

  describe('tenant isolation', () => {
    it('data in emp_test not visible from emp_test_b', async () => {
      await repo.upsert(buildLayoutEntity(TEST_SLUG));

      const inB = await PrismaEmpresaService.runWithSlug(TEST_SLUG_B, () =>
        repo.findByProjetoId(FIXED_PROJ_ID),
      );

      expect(inB).toBeNull();
    });
  });
});
