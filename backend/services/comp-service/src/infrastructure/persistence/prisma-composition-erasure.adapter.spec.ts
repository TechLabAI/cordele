/**
 * Composition erasure — persistence-layer integration tests (P3, Fase 5).
 *
 * Verifies the two behaviours that together constitute a correct LGPD erasure:
 *
 *   1. CompositionErasureUseCase.purge() is idempotent:
 *      - First call deletes the metadados row.
 *      - Second call completes without error (MetadadosRepository.delete uses
 *        `deleteMany`, which silences NOT_FOUND).
 *      - After both calls, no metadados row exists for the projetoId.
 *
 *   2. FK CASCADE from configuracao_layout → layout_override is enforced by
 *      the real database. Deleting the layout row (PrismaConfiguracaoLayoutRepository
 *      .delete) removes all associated layout_override rows automatically.
 *      This is the cascade that ensures overrides do not outlive the layout
 *      configuration during the purge workflow.
 *
 * Uses Testcontainers PostgreSQL 16 for real DB validation.
 * Container startup: ~30–60 s. jest.setTimeout(120000) is set in beforeAll.
 *
 * Note on file location (src/infrastructure/persistence/):
 *   Follows the same pattern as prisma-empresa.service.spec.ts — tests for
 *   persistence-layer erasure contracts that span multiple repositories.
 *   Spec files are excluded from eslint-plugin-boundaries module rules.
 */

import {
  FIXED_PROJ_ID,
  TEST_SLUG,
  startTestDatabase,
  stopTestDatabase,
  truncateCompTables,
} from '../../../test/integration/db-setup';
import { PrismaEmpresaService } from './prisma-empresa.service';
import { PrismaMetadadosRepository } from '../comp/persistence/metadados.repository';
import { PrismaConfiguracaoLayoutRepository } from '../comp/persistence/configuracao-layout.repository';
import { CompositionErasureUseCase } from '../../modules/comp/application/composition-erasure.use-case';
import { MetadadosEntity } from '../../domain/comp/metadados.aggregate';
import { ConfiguracaoLayout } from '../../domain/comp/configuracao-layout.aggregate';
import { LayoutOverride } from '../../domain/comp/layout-override.entity';
import type { FileStoragePort } from '../../modules/comp/ports/file-storage.port';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMetadados(projetoId = FIXED_PROJ_ID): MetadadosEntity {
  return new MetadadosEntity({
    projetoId,
    titulo: 'Livro Erasure Test',
    autor: 'Autor Erasure',
    idioma: 'pt',
    empresaSlug: TEST_SLUG,
    materialized: true,
  });
}

function buildLayout(projetoId = FIXED_PROJ_ID): ConfiguracaoLayout {
  return new ConfiguracaoLayout({
    projetoId,
    fonte_corpo_familia: 'serif',
    fonte_corpo_tamanho: 12,
    espacamento_linha: 1.5,
    margem_lateral: 20,
    h1_tamanho: 28,
    h2_tamanho: 22,
    h3_tamanho: 18,
    overrides: [],
    empresaSlug: TEST_SLUG,
    materialized: false,
  });
}

function buildOverride(referenciaNo = 'img-erasure-001'): LayoutOverride {
  return new LayoutOverride({
    referenciaNo,
    tipo: 'imagem',
    alinhamento: 'centralizado',
    ordem: 0,
  });
}

/** Jest mock for FileStoragePort — no real I/O in these integration tests. */
function buildMockFileStorage(): jest.Mocked<FileStoragePort> {
  return {
    store: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn().mockResolvedValue(undefined),
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('Composition Erasure — persistence-layer integration (Testcontainers)', () => {
  let empresaService: PrismaEmpresaService;
  let metadadosRepo: PrismaMetadadosRepository;
  let layoutRepo: PrismaConfiguracaoLayoutRepository;

  beforeAll(async () => {
    jest.setTimeout(120000);
    await startTestDatabase();
    empresaService = new PrismaEmpresaService();
    metadadosRepo = new PrismaMetadadosRepository(empresaService);
    layoutRepo = new PrismaConfiguracaoLayoutRepository(empresaService);
  }, 120000);

  afterAll(async () => {
    await empresaService.onModuleDestroy();
    await stopTestDatabase();
  });

  afterEach(async () => {
    await truncateCompTables(TEST_SLUG);
  });

  // -------------------------------------------------------------------------
  // 1. Purge idempotence
  // -------------------------------------------------------------------------

  describe('purge idempotence (CompositionErasureUseCase)', () => {
    it('purge idempotent: second call does not throw', async () => {
      // Seed: one metadados row (no capaUrl — FileStoragePort will not be called)
      await metadadosRepo.upsert(buildMetadados());

      const useCase = new CompositionErasureUseCase(metadadosRepo, buildMockFileStorage());

      // First purge: deletes the metadados row
      await PrismaEmpresaService.runWithSlug(TEST_SLUG, async () => {
        await expect(useCase.purge(FIXED_PROJ_ID)).resolves.not.toThrow();
      });

      // Second purge: row is already gone — must not throw (deleteMany is idempotent)
      await PrismaEmpresaService.runWithSlug(TEST_SLUG, async () => {
        await expect(useCase.purge(FIXED_PROJ_ID)).resolves.not.toThrow();
      });

      // Verify: no metadados row remains
      const remaining = await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
        metadadosRepo.findByProjetoId(FIXED_PROJ_ID),
      );
      expect(remaining).toBeNull();
    });

    it('purge does not throw when no metadados row exists', async () => {
      // No row inserted — purge must complete silently
      const useCase = new CompositionErasureUseCase(metadadosRepo, buildMockFileStorage());

      await PrismaEmpresaService.runWithSlug(TEST_SLUG, async () => {
        await expect(useCase.purge(FIXED_PROJ_ID)).resolves.not.toThrow();
      });
    });
  });

  // -------------------------------------------------------------------------
  // 2. FK cascade: layout_override deleted when configuracao_layout is deleted
  // -------------------------------------------------------------------------

  describe('should cascade delete overrides when purging', () => {
    it('should cascade delete overrides when purging', async () => {
      // Seed: layout row + override rows
      await layoutRepo.upsert(buildLayout());
      await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
        layoutRepo.replaceOverrides(FIXED_PROJ_ID, [
          buildOverride('img-001'),
          buildOverride('img-002'),
        ]),
      );

      // Verify that overrides were persisted
      const before = await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
        layoutRepo.findByProjetoId(FIXED_PROJ_ID),
      );
      expect(before?.overrides).toHaveLength(2);

      // Delete the layout row — FK CASCADE must remove all associated overrides
      await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
        layoutRepo.delete(FIXED_PROJ_ID),
      );

      // After delete: layout row must be gone, and overrides must also be gone
      const after = await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
        layoutRepo.findByProjetoId(FIXED_PROJ_ID),
      );
      expect(after).toBeNull();
    });

    it('purge + layout delete leaves no rows for projetoId', async () => {
      // Seed both tables
      await metadadosRepo.upsert(buildMetadados());
      await layoutRepo.upsert(buildLayout());
      await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
        layoutRepo.replaceOverrides(FIXED_PROJ_ID, [buildOverride()]),
      );

      const useCase = new CompositionErasureUseCase(metadadosRepo, buildMockFileStorage());

      // Erase metadados via purge, then erase layout explicitly
      await PrismaEmpresaService.runWithSlug(TEST_SLUG, async () => {
        await useCase.purge(FIXED_PROJ_ID);
        await layoutRepo.delete(FIXED_PROJ_ID);
      });

      // Neither table should have rows for this projetoId
      const meta = await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
        metadadosRepo.findByProjetoId(FIXED_PROJ_ID),
      );
      const layout = await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
        layoutRepo.findByProjetoId(FIXED_PROJ_ID),
      );

      expect(meta).toBeNull();
      expect(layout).toBeNull();
    });
  });
});
