/**
 * PrismaMetadadosRepository — integration tests (Testcontainers, P3).
 *
 * Verifies: upsert, findByProjetoId, delete, empresa context requirement,
 * tenant isolation (emp_test data not visible from emp_test_b).
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
import { MetadadosEntity } from '../../../domain/comp/metadados.aggregate';
import { PrismaEmpresaService } from '../../persistence/prisma-empresa.service';
import { PrismaMetadadosRepository } from './metadados.repository';

// ---------------------------------------------------------------------------
// Shared test helpers
// ---------------------------------------------------------------------------

function buildEntity(overrides: Partial<ConstructorParameters<typeof MetadadosEntity>[0]> = {}): MetadadosEntity {
  return new MetadadosEntity({
    projetoId: FIXED_PROJ_ID,
    titulo: 'Titulo Teste',
    autor: 'Autor Teste',
    idioma: 'pt',
    empresaSlug: TEST_SLUG,
    materialized: false,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('PrismaMetadadosRepository (integration — Testcontainers)', () => {
  let empresaService: PrismaEmpresaService;
  let repo: PrismaMetadadosRepository;

  beforeAll(async () => {
    jest.setTimeout(120000);
    await startTestDatabase();
    empresaService = new PrismaEmpresaService();
    repo = new PrismaMetadadosRepository(empresaService);
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

    it('returns MetadadosEntity with materialized=true when row exists', async () => {
      // Seed via upsert (it uses entity.empresaSlug directly)
      const entity = buildEntity({ materialized: true });
      await repo.upsert(entity);

      const result = await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
        repo.findByProjetoId(FIXED_PROJ_ID),
      );

      expect(result).not.toBeNull();
      expect(result?.projetoId).toBe(FIXED_PROJ_ID);
      expect(result?.titulo).toBe('Titulo Teste');
      expect(result?.materialized).toBe(true);
      expect(result?.empresaSlug).toBe(TEST_SLUG);
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
    it('creates a row and returns entity with materialized=true', async () => {
      const entity = buildEntity({ titulo: 'Dom Casmurro', idioma: 'pt', materialized: true });

      const result = await repo.upsert(entity);

      expect(result.projetoId).toBe(FIXED_PROJ_ID);
      expect(result.titulo).toBe('Dom Casmurro');
      expect(result.materialized).toBe(true);
      expect(result.empresaSlug).toBe(TEST_SLUG);
    });

    it('is idempotent: second upsert updates mutable fields without duplicate row', async () => {
      await repo.upsert(buildEntity({ titulo: 'Primeira Versao' }));
      const updated = await repo.upsert(buildEntity({ titulo: 'Segunda Versao' }));

      expect(updated.titulo).toBe('Segunda Versao');

      // Verify only ONE row in DB (upsert, not insert)
      const found = await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
        repo.findByProjetoId(FIXED_PROJ_ID),
      );
      expect(found?.titulo).toBe('Segunda Versao');
    });

    it('routes to the correct schema using entity.empresaSlug', async () => {
      // Upsert into emp_test
      await repo.upsert(buildEntity({ empresaSlug: TEST_SLUG }));

      // emp_test_b must still be empty
      const inB = await PrismaEmpresaService.runWithSlug(TEST_SLUG_B, () =>
        repo.findByProjetoId(FIXED_PROJ_ID),
      );
      expect(inB).toBeNull();
    });

    it('accepts valid idioma values: en, es, fr', async () => {
      for (const idioma of ['en', 'es', 'fr'] as const) {
        await expect(
          repo.upsert(buildEntity({ idioma, projetoId: FIXED_PROJ_ID })),
        ).resolves.not.toThrow();
        await truncateCompTables(TEST_SLUG);
      }
    });
  });

  // -------------------------------------------------------------------------
  // delete
  // -------------------------------------------------------------------------

  describe('delete()', () => {
    it('removes the row when it exists', async () => {
      await repo.upsert(buildEntity());

      await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
        repo.delete(FIXED_PROJ_ID),
      );

      const result = await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
        repo.findByProjetoId(FIXED_PROJ_ID),
      );
      expect(result).toBeNull();
    });

    it('is idempotent: does not throw when row is absent', async () => {
      // No row inserted — delete should silently succeed
      await expect(
        PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
          repo.delete(FIXED_PROJ_ID),
        ),
      ).resolves.not.toThrow();
    });

    it('throws when empresa context is not set', async () => {
      await expect(repo.delete(FIXED_PROJ_ID)).rejects.toThrow('empresa context not set');
    });
  });

  // -------------------------------------------------------------------------
  // Tenant isolation
  // -------------------------------------------------------------------------

  describe('tenant isolation', () => {
    it('data inserted in emp_test not visible from emp_test_b', async () => {
      // Insert into emp_test
      await repo.upsert(buildEntity({ empresaSlug: TEST_SLUG }));

      // Query from emp_test_b — must return null
      const result = await PrismaEmpresaService.runWithSlug(TEST_SLUG_B, () =>
        repo.findByProjetoId(FIXED_PROJ_ID),
      );

      expect(result).toBeNull();
    });
  });
});
