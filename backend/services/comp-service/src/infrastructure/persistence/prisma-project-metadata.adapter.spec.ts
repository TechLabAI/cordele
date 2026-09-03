/**
 * PrismaMetadadosRepository — project-metadata port contract tests (P3, Fase 5).
 *
 * Verifies that `findManyByProjetoIds` satisfies the `ProjectMetadataPort` contract:
 *   - ONE `findMany` query regardless of list size (no N+1 loop of findUnique)
 *   - Unknown ids return empty array without error
 *
 * Uses Testcontainers PostgreSQL 16 for real DB validation.
 * Container startup: ~30–60 s. jest.setTimeout(120000) is set in beforeAll.
 *
 * Why this file lives in src/infrastructure/persistence/:
 *   It tests the persistence adapter that backs COMP_PROJECT_METADATA_PORT.
 *   Spec files are excluded from eslint-plugin-boundaries module rules.
 */

import {
  FIXED_PROJ_ID,
  TEST_SLUG,
  startTestDatabase,
  stopTestDatabase,
  truncateCompTables,
  insertProjetoRefs,
} from '../../../test/integration/db-setup';
import { PrismaClient } from '../prisma-client';
import { PrismaEmpresaService } from './prisma-empresa.service';
import { PrismaMetadadosRepository } from '../comp/persistence/metadados.repository';
import { MetadadosEntity } from '../../domain/comp/metadados.aggregate';

// ---------------------------------------------------------------------------
// Extra project UUIDs used to build the batch fixture
// ---------------------------------------------------------------------------

const PROJ_ID_2 = '22222222-2222-2222-2222-222222222222';
const PROJ_ID_3 = '33333333-3333-3333-3333-333333333333';
const UNKNOWN_ID = 'ffffffff-ffff-ffff-ffff-ffffffffffff';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEntity(projetoId: string, titulo: string): MetadadosEntity {
  return new MetadadosEntity({
    projetoId,
    titulo,
    autor: 'Autor Teste',
    idioma: 'pt',
    empresaSlug: TEST_SLUG,
    materialized: true,
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('PrismaMetadadosRepository — project-metadata port contract (Testcontainers)', () => {
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
  });

  // -------------------------------------------------------------------------
  // should use findMany with in clause, not loop of findUnique
  // -------------------------------------------------------------------------

  it('should use findMany with in clause, not loop of findUnique', async () => {
    // Insert FK reference rows for PROJ_ID_2 and PROJ_ID_3 so the upsert FK
    // constraint is satisfied (FIXED_PROJ_ID row already exists from db-setup).
    await insertProjetoRefs(TEST_SLUG, [PROJ_ID_2, PROJ_ID_3]);

    // Seed three metadados rows
    await repo.upsert(buildEntity(FIXED_PROJ_ID, 'Livro Um'));
    await repo.upsert(buildEntity(PROJ_ID_2, 'Livro Dois'));
    await repo.upsert(buildEntity(PROJ_ID_3, 'Livro Tres'));

    // Capture the PrismaClient that will be used for the query.
    // PrismaEmpresaService caches clients by schema, so after `upsert` above,
    // the client for `emp_test` is already cached and reused by `findManyByProjetoIds`.
    let capturedClient: PrismaClient | undefined;
    await empresaService.withSlug(TEST_SLUG, async (client) => {
      capturedClient = client;
    });

    const findManySpy = jest.spyOn(capturedClient!.metadados, 'findMany');

    // Single batch call
    const results = await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
      repo.findManyByProjetoIds([FIXED_PROJ_ID, PROJ_ID_2, PROJ_ID_3]),
    );

    // Verify ONE findMany call, not 3 findUnique calls
    expect(findManySpy).toHaveBeenCalledTimes(1);
    expect(results).toHaveLength(3);
    expect(results.map((e) => e.projetoId).sort()).toEqual(
      [FIXED_PROJ_ID, PROJ_ID_2, PROJ_ID_3].sort(),
    );

    findManySpy.mockRestore();
  });

  // -------------------------------------------------------------------------
  // should return empty array for unknown ids
  // -------------------------------------------------------------------------

  it('should return empty array for unknown ids', async () => {
    const results = await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
      repo.findManyByProjetoIds([UNKNOWN_ID]),
    );

    expect(results).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // should return empty array when called with empty list
  // -------------------------------------------------------------------------

  it('should return empty array when called with empty list', async () => {
    const results = await PrismaEmpresaService.runWithSlug(TEST_SLUG, () =>
      repo.findManyByProjetoIds([]),
    );

    expect(results).toHaveLength(0);
  });
});
