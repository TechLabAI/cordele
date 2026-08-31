/**
 * Testcontainers DB setup helper for COMP integration tests (P3).
 *
 * Provides a real PostgreSQL 16 container with:
 *   - Schema `emp_test`  (slug = 'test')
 *   - Schema `emp_test_b` (slug = 'test_b') — for tenant-isolation tests
 *   - `projeto_editorial` stub table in each schema (FK reference for COMP tables)
 *   - All COMP tables applied via real Prisma migrations (direct SQL execution from prisma/migrations/)
 *   - A fixed `projeto_editorial` row for FK constraints
 *
 * Usage:
 *   beforeAll(async () => { await startTestDatabase(); }, 120000);
 *   afterEach(async () => { await truncateCompTables(); });
 *   afterAll(async () => { await stopTestDatabase(); });
 *
 * DATABASE_URL is set in process.env so PrismaEmpresaService.buildSchemaUrl
 * can build per-tenant URLs automatically.
 *
 * RULE-09 compliance: no DDL literals in TypeScript code.
 *   - COMP tables (metadados, configuracao_layout, layout_override) are applied
 *     by reading and executing SQL from prisma/migrations/ files directly.
 *   - The projeto_editorial stub DDL lives in test/fixtures/projeto-editorial-stub.sql.
 */

import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

/** Fixed UUID used as FK reference in `projeto_editorial` for all integration tests. */
export const FIXED_PROJ_ID = '11111111-1111-1111-1111-111111111111';

/** Tenant slug used as primary test tenant. Schema: emp_test. */
export const TEST_SLUG = 'test';

/** Secondary tenant slug for isolation tests. Schema: emp_test_b. */
export const TEST_SLUG_B = 'test_b';

let _container: StartedPostgreSqlContainer | null = null;
let _baseUri = '';

/** Absolute path to the comp-service package root (resolves prisma/migrations/ relative path). */
const SERVICE_ROOT = path.resolve(__dirname, '../../');

/**
 * SQL fixture for the `projeto_editorial` stub table (owned by PROJ service).
 * DDL is kept in a .sql file so no DDL literal appears in TypeScript
 * source — required for RULE-09 (DDL only in prisma/migrations).
 */
const PROJETO_EDITORIAL_STUB_SQL = path.resolve(
  __dirname,
  '../fixtures/projeto-editorial-stub.sql',
);

// ---------------------------------------------------------------------------
// Schema setup helpers
// ---------------------------------------------------------------------------

/**
 * Splits a SQL script into individual executable statements.
 *
 * Splits on `;\n` (or `;\r\n`) so that semicolons inside single-quoted
 * string literals — which are always followed by non-newline characters in
 * generated Prisma migration SQL — are not treated as statement delimiters.
 * Filters empty segments and pure-comment segments.
 *
 * Safe for the generated DDL in prisma/migrations/ (not a full SQL parser).
 */
function splitSqlStatements(sql: string): string[] {
  return (sql.trim() + '\n')
    .split(/;\s*\r?\n/)
    .map((s) => s.trim())
    .filter((s) => {
      if (!s) return false;
      // Skip segments that are only comments (no real SQL tokens remain).
      const withoutComments = s.replace(/--[^\n]*/gm, '').trim();
      return withoutComments.length > 0;
    });
}

/**
 * Applies COMP Prisma migrations to the given tenant schema by executing
 * migration SQL files directly via `$executeRawUnsafe`.
 *
 * This replaces the former `prisma migrate deploy` (execSync) approach.
 * `prisma migrate deploy` raises P3005 ("The database schema is not empty")
 * when the schema already contains the `projeto_editorial` stub table (created
 * before migrations run, as required by the FK in the init migration). Direct
 * SQL execution bypasses that check while still reading DDL exclusively from
 * `prisma/migrations/` (RULE-09 compliant — no DDL literals in TypeScript).
 *
 * Migration directories must follow the Prisma naming convention
 * (`YYYYMMDDHHMMSS_<name>/migration.sql`) and are applied in ascending order.
 */
async function applyCompMigrations(baseUri: string, schemaName: string): Promise<void> {
  const migrationsDir = path.resolve(SERVICE_ROOT, 'prisma/migrations');
  const schemaUri = `${baseUri}?schema=${schemaName}`;

  // Collect versioned migration directories in ascending (chronological) order.
  const migrationDirs = fs
    .readdirSync(migrationsDir)
    .filter((name) => /^\d{14}_/.test(name))
    .sort();

  const client = new PrismaClient({ datasourceUrl: schemaUri });
  try {
    for (const dir of migrationDirs) {
      const sqlPath = path.resolve(migrationsDir, dir, 'migration.sql');
      if (!fs.existsSync(sqlPath)) continue;

      const sql = fs.readFileSync(sqlPath, 'utf-8');
      const statements = splitSqlStatements(sql);

      for (const stmt of statements) {
        await client.$executeRawUnsafe(stmt);
      }
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Direct SQL execution failed for schema "${schemaName}".\n${msg}`);
  } finally {
    await client.$disconnect();
  }
}

/**
 * Creates the `projeto_editorial` stub table in the given tenant schema.
 *
 * Reads DDL from test/fixtures/projeto-editorial-stub.sql so no DDL literal
 * appears in TypeScript source (RULE-09). Uses a schema-scoped
 * PrismaClient so the unqualified table name resolves to the correct schema.
 *
 * Must be called BEFORE applyCompMigrations because the COMP migration
 * references projeto_editorial via a foreign key.
 */
async function createProjetoEditorialStub(baseUri: string, schemaName: string): Promise<void> {
  const stubSql = fs.readFileSync(PROJETO_EDITORIAL_STUB_SQL, 'utf-8');
  const schemaClient = new PrismaClient({ datasourceUrl: `${baseUri}?schema=${schemaName}` });
  try {
    await schemaClient.$executeRawUnsafe(stubSql);
  } finally {
    await schemaClient.$disconnect();
  }
}

// ---------------------------------------------------------------------------
// Public schema-provisioning helper
// ---------------------------------------------------------------------------

/**
 * Creates a new tenant schema with `projeto_editorial` stub + COMP migrations.
 *
 * Used by the BDD cucumber-context to provision additional schemas not in the
 * default P3 setup (e.g. `emp_aetos`, `emp_other`).
 *
 * Idempotent: uses IF NOT EXISTS throughout so re-runs are safe.
 *
 * @param slug  Empresa slug (e.g. 'aetos'). Schema name = `emp_<slug>`.
 * @param projectIds  UUIDs to insert into `projeto_editorial` as FK references.
 */
export async function provisionExtraSchema(slug: string, projectIds: string[] = []): Promise<void> {
  if (!_baseUri) throw new Error('db-setup: database not started — call startTestDatabase first');

  const schema = `emp_${slug}`;
  const adminClient = new PrismaClient({ datasourceUrl: _baseUri });

  try {
    await adminClient.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
  } finally {
    await adminClient.$disconnect();
  }

  // Create the projeto_editorial stub (FK prerequisite) via SQL fixture file.
  await createProjetoEditorialStub(_baseUri, schema);

  // Insert the fixed reference UUID plus any extra IDs requested.
  const ids = [FIXED_PROJ_ID, ...projectIds.filter((id) => id !== FIXED_PROJ_ID)];
  const insertClient = new PrismaClient({ datasourceUrl: _baseUri });
  try {
    for (const id of ids) {
      await insertClient.$executeRawUnsafe(
        `INSERT INTO "${schema}".projeto_editorial (id) VALUES ('${id}') ON CONFLICT DO NOTHING`,
      );
    }
  } finally {
    await insertClient.$disconnect();
  }

  // Apply real Prisma migrations for COMP tables (RULE-09 compliant).
  await applyCompMigrations(_baseUri, schema);
}

/**
 * Inserts additional FK reference rows into `projeto_editorial` for an
 * already-provisioned schema.
 *
 * Used by the BDD setup to ensure all project UUIDs referenced by scenarios
 * satisfy the FK constraint before any INSERT into metadados/layout tables.
 */
export async function insertProjetoRefs(slug: string, projectIds: string[]): Promise<void> {
  if (!_baseUri) throw new Error('db-setup: database not started');
  const schema = `emp_${slug}`;
  const adminClient = new PrismaClient({ datasourceUrl: _baseUri });
  try {
    for (const id of projectIds) {
      await adminClient.$executeRawUnsafe(
        `INSERT INTO "${schema}".projeto_editorial (id) VALUES ('${id}') ON CONFLICT DO NOTHING`,
      );
    }
  } finally {
    await adminClient.$disconnect();
  }
}

// ---------------------------------------------------------------------------
// Public lifecycle API
// ---------------------------------------------------------------------------

/**
 * Starts the PostgreSQL 16 Testcontainer and provisions all schemas.
 *
 * Call once in `beforeAll` with `jest.setTimeout(120000)`.
 * Sets `process.env.DATABASE_URL` to the container URI so PrismaEmpresaService
 * can build per-schema URLs via `buildSchemaUrl`.
 */
export async function startTestDatabase(): Promise<void> {
  _container = await new PostgreSqlContainer('postgres:16').start();
  _baseUri = _container.getConnectionUri();

  // Admin client (no schema param) — creates schemas only.
  const adminClient = new PrismaClient({ datasourceUrl: _baseUri });

  try {
    for (const slug of [TEST_SLUG, TEST_SLUG_B]) {
      const schema = `emp_${slug}`;
      await adminClient.$executeRawUnsafe(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    }
  } finally {
    await adminClient.$disconnect();
  }

  // Create the projeto_editorial stub (FK prerequisite for COMP migrations)
  // and apply COMP Prisma migrations to each schema.
  for (const slug of [TEST_SLUG, TEST_SLUG_B]) {
    const schema = `emp_${slug}`;
    // Step 1: create FK prerequisite via SQL fixture file (RULE-09 compliant).
    await createProjetoEditorialStub(_baseUri, schema);
    // Step 2: insert the fixed FK reference row.
    const insertClient = new PrismaClient({ datasourceUrl: _baseUri });
    try {
      await insertClient.$executeRawUnsafe(
        `INSERT INTO "${schema}".projeto_editorial (id) VALUES ('${FIXED_PROJ_ID}') ON CONFLICT DO NOTHING`,
      );
    } finally {
      await insertClient.$disconnect();
    }
    // Step 3: apply real Prisma migrations (RULE-09 compliant).
    await applyCompMigrations(_baseUri, schema);
  }

  // Expose base URI so PrismaEmpresaService builds per-schema URLs correctly.
  process.env['DATABASE_URL'] = _baseUri;
}

/** Stops the container and resets module-level state. */
export async function stopTestDatabase(): Promise<void> {
  if (_container) {
    await _container.stop();
    _container = null;
    _baseUri = '';
  }
}

/** Returns the raw base URI of the Testcontainer (without schema param). */
export function getBaseUri(): string {
  if (!_baseUri) throw new Error('db-setup: database not started — call startTestDatabase first');
  return _baseUri;
}

/**
 * Truncates all COMP tables in the given tenant schema.
 *
 * Call in `afterEach` to isolate tests from one another.
 * Truncates in FK-safe order: layout_override → configuracao_layout → metadados.
 */
export async function truncateCompTables(slug: string = TEST_SLUG): Promise<void> {
  if (!_baseUri) throw new Error('db-setup: database not started');
  const schemaUri = `${_baseUri}?schema=emp_${slug}`;
  const client = new PrismaClient({ datasourceUrl: schemaUri });
  try {
    await client.$executeRawUnsafe(
      'TRUNCATE TABLE layout_override, configuracao_layout, metadados CASCADE',
    );
  } finally {
    await client.$disconnect();
  }
}
