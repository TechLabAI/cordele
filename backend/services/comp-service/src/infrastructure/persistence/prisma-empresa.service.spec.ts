/**
 * PrismaEmpresaService — unit + integration tests (P3).
 *
 * Unit tests: slug validation (no DB required).
 * Integration tests: tenant schema routing + isolation (Testcontainers PostgreSQL 16).
 *
 * Required contract specs (plan P3):
 *   - "should reject invalid slug before SET search_path"
 *   - Tenant isolation: data in emp_test not visible from emp_test_b
 */

import {
  FIXED_PROJ_ID,
  TEST_SLUG,
  TEST_SLUG_B,
  startTestDatabase,
  stopTestDatabase,
  truncateCompTables,
} from '../../../test/integration/db-setup';
import { PrismaEmpresaService } from './prisma-empresa.service';

// ---------------------------------------------------------------------------
// Unit tests — slug validation (no DB needed)
// ---------------------------------------------------------------------------

describe('PrismaEmpresaService — slug validation (unit)', () => {
  it('should reject invalid slug before SET search_path', () => {
    // SQL injection attempt must be rejected before any query is issued
    expect(() =>
      PrismaEmpresaService.runWithSlug("'; DROP TABLE metadados; --", () => undefined),
    ).toThrow('invalid empresa slug');
  });

  it('rejects empty string slug', () => {
    expect(() => PrismaEmpresaService.runWithSlug('', () => undefined)).toThrow(
      'invalid empresa slug',
    );
  });

  it('rejects slug starting with a digit', () => {
    expect(() => PrismaEmpresaService.runWithSlug('1empresa', () => undefined)).toThrow(
      'invalid empresa slug',
    );
  });

  it('rejects slug with uppercase letters', () => {
    expect(() => PrismaEmpresaService.runWithSlug('Aetos', () => undefined)).toThrow(
      'invalid empresa slug',
    );
  });

  it('accepts valid slug: lowercase letters only', () => {
    expect(() => PrismaEmpresaService.runWithSlug('aetos', () => undefined)).not.toThrow();
  });

  it('accepts valid slug: lowercase with digits and underscores', () => {
    expect(() => PrismaEmpresaService.runWithSlug('aetos_01', () => undefined)).not.toThrow();
  });

  it('getCurrentSlug returns undefined outside runWithSlug', () => {
    // Must not read a stale slug from a previous test
    expect(PrismaEmpresaService.getCurrentSlug()).toBeUndefined();
  });

  it('getCurrentSlug returns the active slug inside runWithSlug', () => {
    let captured: string | undefined;
    PrismaEmpresaService.runWithSlug('aetos', () => {
      captured = PrismaEmpresaService.getCurrentSlug();
    });
    expect(captured).toBe('aetos');
  });

  it('withCurrentTenant throws when no empresa context is active', async () => {
    const service = new PrismaEmpresaService();
    await expect(service.withCurrentTenant(() => Promise.resolve(null))).rejects.toThrow(
      'empresa context is not set',
    );
  });
});

// ---------------------------------------------------------------------------
// Integration tests — schema routing + tenant isolation (Testcontainers)
// ---------------------------------------------------------------------------

describe('PrismaEmpresaService — tenant routing (integration — Testcontainers)', () => {
  let service: PrismaEmpresaService;

  beforeAll(async () => {
    jest.setTimeout(120000);
    await startTestDatabase();
    service = new PrismaEmpresaService();
  }, 120000);

  afterAll(async () => {
    await service.onModuleDestroy();
    await stopTestDatabase();
  });

  afterEach(async () => {
    await truncateCompTables(TEST_SLUG);
    await truncateCompTables(TEST_SLUG_B);
  });

  it('routes to the correct schema — row inserted in emp_test visible from emp_test', async () => {
    // Insert via emp_test slug
    await PrismaEmpresaService.runWithSlug(TEST_SLUG, async () => {
      await service.withCurrentTenant((client) =>
        client.metadados.upsert({
          where: { projetoId: FIXED_PROJ_ID },
          create: {
            projetoId: FIXED_PROJ_ID,
            titulo: 'Titulo Integração',
            autor: 'Autor Integração',
            idioma: 'pt',
          },
          update: { titulo: 'Titulo Integração' },
        }),
      );
    });

    // Read it back
    const row = await service.withSlug(TEST_SLUG, (client) =>
      client.metadados.findUnique({ where: { projetoId: FIXED_PROJ_ID } }),
    );

    expect(row?.titulo).toBe('Titulo Integração');
  });

  it('tenant isolation: data in emp_test not visible from emp_test_b', async () => {
    // Insert in emp_test
    await service.withSlug(TEST_SLUG, (client) =>
      client.metadados.upsert({
        where: { projetoId: FIXED_PROJ_ID },
        create: {
          projetoId: FIXED_PROJ_ID,
          titulo: 'Tenant A Only',
          autor: 'Autor A',
          idioma: 'pt',
        },
        update: { titulo: 'Tenant A Only' },
      }),
    );

    // Query from emp_test_b — must return null
    const rowInB = await service.withSlug(TEST_SLUG_B, (client) =>
      client.metadados.findUnique({ where: { projetoId: FIXED_PROJ_ID } }),
    );

    expect(rowInB).toBeNull();
  });
});
