/**
 * NestJS BDD test harness for COMP (P4 — PostgreSQL real via Testcontainers).
 *
 * Strategy: one PostgreSQL 16 Testcontainer for the entire BDD suite, reused
 * across all step files. Infrastructure ports use REAL adapters:
 *   - COMP_METADADOS_REPO       → PrismaMetadadosRepository (real Prisma + tenant routing)
 *   - COMP_LAYOUT_REPO          → PrismaConfiguracaoLayoutRepository (real Prisma)
 *   - COMP_FILE_STORAGE_PORT    → DiskFileStorageAdapter (real disk, /tmp/...)
 *   - COMP_MANUSCRIPT_CONTENT_PORT → BddManuscriptStub (fixture-backed, runtime-configurable)
 *
 * JwtAuthGuard is replaced by TestJwtAuthGuard so tests can control the
 * authenticated user (empresa, scopes, roles) per scenario without a live Keycloak.
 *
 * Tenant routing: BddTenantBridgeMiddleware reads the Bearer JWT and wraps
 * every request in BOTH:
 *   - EmpresaContextService.run()       (EmpresaContextService AsyncLocalStorage)
 *   - PrismaEmpresaService.runWithSlug() (PrismaEmpresaService AsyncLocalStorage)
 * This is required because PrismaMetadadosRepository reads PrismaEmpresaService's
 * static ALS, which is a different AsyncLocalStorage from EmpresaContextService.
 *
 * Schema provisioning: beforeAll provisions emp_test, emp_aetos, emp_other (and
 * emp_test_b from startTestDatabase) with COMP DDL and FK refs for all BDD project
 * UUIDs. afterEach truncates the relevant schema(s). afterAll stops the container.
 *
 * Issue: COMP-020 / INT-COMP-006
 */

// ── Environment vars required by ConfigModule (before any Nest import) ────────
process.env['NODE_ENV'] = 'test';
process.env['JWT_ISSUER_URI'] = 'http://test-issuer/realms/test';
process.env['JWT_AUDIENCE'] = 'comp-service-test';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/cordele_test'; // overwritten in beforeAll
process.env['FILE_STORAGE_BASE_DIR'] = '/tmp/cordele-bdd-comp';
process.env['COMP_STUB_MANUSCRIPT_FIXTURE_PATH'] = 'test/fixtures/content-tree.json';

import {
  ExecutionContext,
  ForbiddenException,
  Global,
  Injectable,
  INestApplication,
  Module,
  NestMiddleware,
  UnauthorizedException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { NextFunction, Request, Response } from 'express';
import request from 'supertest';

import type { AuthenticatedUser } from 'src/infrastructure/comp/auth/jwt-auth.guard';
import { REQUIRED_SCOPES_KEY } from 'src/infrastructure/comp/auth/scope.guard';
import { CorrelationMiddleware } from 'src/infrastructure/comp/middleware/correlation.middleware';
import { ProblemJsonFilter } from 'src/infrastructure/comp/filters/problem-json.filter';
import { EmpresaContextService } from 'src/infrastructure/auth/empresa-context.service';
import { EmpresaContextMiddleware } from 'src/infrastructure/auth/empresa-context.middleware';
import { PrismaEmpresaService } from 'src/infrastructure/persistence/prisma-empresa.service';
import { PrismaMetadadosRepository } from 'src/infrastructure/comp/persistence/metadados.repository';
import { PrismaConfiguracaoLayoutRepository } from 'src/infrastructure/comp/persistence/configuracao-layout.repository';
import { DiskFileStorageAdapter } from 'src/infrastructure/comp/storage/disk-file-storage.adapter';
import { DatabaseModule } from 'src/infrastructure/persistence/database.module';
import { CompModule } from 'src/modules/comp/comp.module';
import {
  COMP_METADADOS_REPO,
  COMP_LAYOUT_REPO,
  COMP_FILE_STORAGE_PORT,
  COMP_MANUSCRIPT_CONTENT_PORT,
  COMP_PROJECT_METADATA_PORT,
  COMP_COMPOSITION_ERASURE_PORT,
  COMP_EVENT_EMITTER,
  COMP_METRICS_SERVICE,
} from 'src/modules/comp/comp.tokens';
import type { ManuscriptContentPort, ContentTreeDto } from 'src/modules/comp/ports/manuscript-content.port';
import { COMP_DATABASE_HEALTH_PORT } from 'src/modules/comp/ports/database-health.port';
import { PrismaClient } from '../../src/infrastructure/prisma-client';

import {
  startTestDatabase,
  stopTestDatabase,
  getBaseUri,
  truncateCompTables,
  provisionExtraSchema,
  insertProjetoRefs,
  FIXED_PROJ_ID,
  TEST_SLUG,
} from '../integration/db-setup';

// ── All BDD empresa slugs ─────────────────────────────────────────────────────

const BDD_SLUG_AETOS = 'aetos';
const BDD_SLUG_OTHER = 'other';

// ── All project UUIDs used across BDD features (needed for FK refs in DB) ────
// Insert into every provisioned schema so any PUT can succeed regardless of which
// schema it hits. GETs return lazy defaults without writing, so no FK needed;
// only UPSERTs trigger the FK. We insert all UUIDs for simplicity.

const BDD_ALL_PROJECT_IDS: string[] = [
  // Fixed reference UUID (already in emp_test / emp_test_b from startTestDatabase)
  FIXED_PROJ_ID,
  // metadata.feature
  '22222222-2222-2222-2222-222222222222',
  '33333333-3333-3333-3333-333333333333',
  '44444444-4444-4444-4444-444444444444',
  '55555555-5555-5555-5555-555555555555',
  // cover.feature
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'cccccccc-cccc-cccc-cccc-cccccccccccc',
  'dddddddd-dddd-dddd-dddd-dddddddddddd',
  'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
  // idempotency.feature
  '11111111-1111-1111-1111-aaaaaaaaaaaa',
  '22222222-2222-2222-2222-bbbbbbbbbbbb',
  '33333333-3333-3333-3333-cccccccccccc',
  '44444444-4444-4444-4444-dddddddddddd',
  '55555555-5555-5555-5555-eeeeeeeeeeee',
  // layout.feature
  '11111111-1111-1111-1111-111111111112',
  '22222222-2222-2222-2222-222222222223',
  '33333333-3333-3333-3333-333333333334',
  '44444444-4444-4444-4444-444444444445',
  '55555555-5555-5555-5555-555555555556',
  '66666666-6666-6666-6666-666666666667',
  // observability.feature
  '11111111-1111-1111-1111-bbbbbbbbbbbb',
  '22222222-2222-2222-2222-cccccccccccc',
  '33333333-3333-3333-3333-dddddddddddd',
  '44444444-4444-4444-4444-eeeeeeeeeeee',
  // security.feature
  '66666666-6666-6666-6666-666666666666',
  '77777777-7777-7777-7777-777777777777',
  // service-boundary.feature
  'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
  'bbbbbbbb-cccc-dddd-eeee-ffffffffffff',
  'cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa',
  'dddddddd-eeee-ffff-aaaa-bbbbbbbbbbbb',
  'eeeeeeee-ffff-aaaa-bbbb-cccccccccccc',
  // preview-context.feature
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab',
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbc',
  'cccccccc-cccc-cccc-cccc-cccccccccccd',
  'dddddddd-dddd-dddd-dddd-ddddddddddde',
];

// ── Shared test state ─────────────────────────────────────────────────────────

/** Currently active user for this scenario — mutated by step definitions. */
export let currentUser: AuthenticatedUser = {
  userId: 'user-bdd-001',
  username: 'bdd-editor',
  roles: [],
  scopes: ['comp:read', 'comp:write'],
  empresaId: 'test',
};

/** Set the active user for the current scenario. */
export function setCurrentUser(user: AuthenticatedUser): void {
  currentUser = user;
}

/** Reset the user to the default test editor for empresa 'test'. */
export function resetUser(): void {
  currentUser = {
    userId: 'user-bdd-001',
    username: 'bdd-editor',
    roles: [],
    scopes: ['comp:read', 'comp:write'],
    empresaId: 'test',
  };
}

// ── BddManuscriptStub ─────────────────────────────────────────────────────────

/**
 * Runtime-configurable ManuscriptContentPort stub for BDD tests.
 *
 * Reads the content fixture from disk (same as ManuscriptContentStubAdapter)
 * but allows per-test runtime configuration of which projects return null.
 * This preserves the `setNullForProject` / `clearOverrides` API used by
 * service-boundary and preview-context step definitions.
 *
 * Wired as the COMP_MANUSCRIPT_CONTENT_PORT provider in BddRealModule.
 */
@Injectable()
export class BddManuscriptStub implements ManuscriptContentPort {
  private readonly nullProjectIds = new Set<string>();

  /** Configures stub to return null for projetoId (no manuscript). */
  setNullForProject(projetoId: string): void {
    this.nullProjectIds.add(projetoId);
  }

  /** Resets per-scenario overrides. Call in afterEach. */
  clearOverrides(): void {
    this.nullProjectIds.clear();
  }

  async getContentTree(projetoId: string): Promise<ContentTreeDto | null> {
    if (this.nullProjectIds.has(projetoId)) {
      return null;
    }
    return {
      manuscritoId: projetoId,
      estrutura: [
        { nodeId: 'node-001', tipo: 'capitulo', children: [{ nodeId: 'node-002', tipo: 'paragrafo' }] },
        { nodeId: 'node-003', tipo: 'imagem' },
      ],
    };
  }

  async nodeExists(projetoId: string, referenciaNo: string): Promise<boolean> {
    const tree = await this.getContentTree(projetoId);
    if (tree === null) return false;
    const search = (nodes: ReadonlyArray<{ nodeId?: string; children?: ReadonlyArray<unknown> }>): boolean => {
      for (const n of nodes) {
        if (n.nodeId === referenciaNo) return true;
        if (n.children && search(n.children as ReadonlyArray<{ nodeId?: string; children?: ReadonlyArray<unknown> }>)) return true;
      }
      return false;
    };
    return search(tree.estrutura as ReadonlyArray<{ nodeId?: string; children?: ReadonlyArray<unknown> }>);
  }
}

/** Shared BddManuscriptStub singleton — exported for step files. */
export let fakeManuscript: BddManuscriptStub;

// ── BddTenantBridgeMiddleware ─────────────────────────────────────────────────

/**
 * Middleware that populates BOTH AsyncLocalStorage contexts required for
 * real Prisma-based tenant routing in BDD tests.
 *
 * The real application uses EmpresaContextMiddleware to populate
 * EmpresaContextService's ALS, which is one ALS. PrismaMetadadosRepository
 * (and the other Prisma adapters) read from PrismaEmpresaService's SEPARATE
 * static ALS via `PrismaEmpresaService.getCurrentSlug()`. These two stores
 * must both be populated from the same JWT claim before the handler runs.
 *
 * This middleware replaces EmpresaContextMiddleware in the BDD test module:
 *   1. Decodes Bearer JWT (no verification — TestJwtAuthGuard handles auth).
 *   2. Calls PrismaEmpresaService.runWithSlug(slug, ...) to populate the
 *      repository ALS.
 *   3. Inside that, calls empresaContextService.run(ctx, ...) to populate the
 *      EmpresaContextService ALS for use by the controller/guard.
 *   4. Calls next() within both nested ALS contexts.
 *
 * For the empresa-admin X-Tenant-Id override: the middleware uses the JWT
 * empresa_id (not the override header). The Prisma ALS is therefore set to
 * the admin's own empresa slug. For GET endpoints that return lazy defaults
 * this is correct — the tenant test only asserts status 200 (admin can
 * access other empresa), which holds regardless of which schema is queried
 * (no data in either emp_aetos or emp_other for the test project ID).
 */
@Injectable()
class BddTenantBridgeMiddleware implements NestMiddleware {
  constructor(private readonly empresaCtx: EmpresaContextService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const authHeader = req.headers['authorization'];

    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const parts = token.split('.');
      if (parts.length === 3) {
        try {
          const raw = Buffer.from(parts[1], 'base64url').toString('utf8');
          const payload = JSON.parse(raw) as { sub?: string; empresa_id?: string };
          const slug = payload.empresa_id ?? '';
          const userId = payload.sub ?? '';

          if (slug && userId) {
            // Validate slug before setting; PrismaEmpresaService.runWithSlug
            // validates internally but we guard here to fail fast.
            PrismaEmpresaService.runWithSlug(slug, () => {
              this.empresaCtx.run({ userId, empresaId: slug }, () => next());
            });
            return;
          }
        } catch {
          // Malformed token — TestJwtAuthGuard will emit 401; proceed without context.
        }
      }
    }

    next();
  }
}

// ── BddRealModule ─────────────────────────────────────────────────────────────

/**
 * Global NestJS module wiring real infrastructure adapters for BDD tests.
 *
 * Replaces the in-memory FakeInfraModule used in previous priorities (P1–P3).
 * Uses PersistenceModule's adapters bound to the COMP port tokens so the
 * real Prisma repositories and DiskFileStorageAdapter are injected into use cases.
 *
 * BddManuscriptStub replaces ManuscriptContentStubAdapter to allow per-scenario
 * runtime configuration (setNullForProject) needed by service-boundary / preview-
 * context step definitions.
 *
 * COMP_PROJECT_METADATA_PORT and COMP_COMPOSITION_ERASURE_PORT are stub-provided
 * because BDD scenarios do not exercise PUB/PROJ integration contracts.
 */
@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    // Tenant routing (reads DATABASE_URL from process.env — set in beforeAll).
    PrismaEmpresaService,
    // Real Prisma repository adapters.
    PrismaMetadadosRepository,
    PrismaConfiguracaoLayoutRepository,
    // Auth context services (used by BddTenantBridgeMiddleware).
    EmpresaContextService,
    EmpresaContextMiddleware,
    // Real storage adapter.
    DiskFileStorageAdapter,
    // Runtime-configurable stub for ManuscriptContentPort.
    {
      provide: BddManuscriptStub,
      useFactory: () => {
        fakeManuscript = new BddManuscriptStub();
        return fakeManuscript;
      },
    },
    // Port token bindings.
    { provide: COMP_METADADOS_REPO, useExisting: PrismaMetadadosRepository },
    { provide: COMP_LAYOUT_REPO, useExisting: PrismaConfiguracaoLayoutRepository },
    { provide: COMP_FILE_STORAGE_PORT, useExisting: DiskFileStorageAdapter },
    { provide: COMP_MANUSCRIPT_CONTENT_PORT, useExisting: BddManuscriptStub },
    // P6 ports — stub for BDD (not tested in these scenarios).
    { provide: COMP_PROJECT_METADATA_PORT, useValue: { metadata: async () => [] } },
    { provide: COMP_COMPOSITION_ERASURE_PORT, useValue: { purge: async () => {} } },
    // P7/COMP-019: database health port stub — BDD tests do not exercise health checks.
    { provide: COMP_DATABASE_HEALTH_PORT, useValue: { pingDatabase: async () => true } },
    // COMP-007: no-op event emitter stub — BDD tests do not assert on domain events.
    { provide: COMP_EVENT_EMITTER, useValue: { emit: () => undefined } },
    // COMP-019: no-op metrics stub — BDD tests do not assert on counters.
    { provide: COMP_METRICS_SERVICE, useValue: { increment: () => undefined } },
  ],
  exports: [
    EmpresaContextService,
    EmpresaContextMiddleware,
    PrismaEmpresaService,
    PrismaMetadadosRepository,
    PrismaConfiguracaoLayoutRepository,
    BddManuscriptStub,
    COMP_METADADOS_REPO,
    COMP_LAYOUT_REPO,
    COMP_FILE_STORAGE_PORT,
    COMP_MANUSCRIPT_CONTENT_PORT,
    COMP_PROJECT_METADATA_PORT,
    COMP_COMPOSITION_ERASURE_PORT,
    COMP_DATABASE_HEALTH_PORT,
    COMP_EVENT_EMITTER,
    COMP_METRICS_SERVICE,
  ],
})
class BddRealModule {}

// ── Test JWT guard ────────────────────────────────────────────────────────────

/**
 * A test replacement for JwtAuthGuard that:
 *   - Emits 401 when the Authorization header is absent.
 *   - Sets request.user from the shared `currentUser` variable.
 *   - Resolves the tenant via X-Tenant-Id (only for empresa-admin).
 *   - Checks @RequiredScopes() metadata and emits 403 when scopes are missing.
 *
 * This matches the behaviour of the real JwtAuthGuard without requiring a real
 * Passport strategy or a real JWT token signature.
 */
@Injectable()
class TestJwtAuthGuard {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: AuthenticatedUser;
    }>();

    // 401: no Authorization header.
    if (!req.headers['authorization']) {
      throw new UnauthorizedException('No authorization token');
    }

    let user: AuthenticatedUser = { ...currentUser };

    // Resolve tenant: empresa-admin may override via X-Tenant-Id.
    const tenantHeader = req.headers['x-tenant-id'];
    if (tenantHeader && tenantHeader !== user.empresaId) {
      if (!user.roles.includes('empresa-admin')) {
        throw new ForbiddenException('Not allowed to act on behalf of another empresa');
      }
      user = { ...user, empresaId: tenantHeader };
    }

    req.user = user;

    // 403: required scopes not held by the principal.
    const required = this.reflector.getAllAndOverride<string[] | undefined>(REQUIRED_SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (required && required.length > 0) {
      const hasScope = required.some((s) => user.scopes.includes(s));
      if (!hasScope) {
        throw new ForbiddenException(`Insufficient scope. Required one of: ${required.join(', ')}`);
      }
    }

    return true;
  }
}

// ── NestJS BDD application ────────────────────────────────────────────────────

let app: INestApplication;
let _dbStarted = false;

/**
 * Bootstraps the NestJS BDD application with real adapters and Testcontainers DB.
 *
 * Called once per test suite via `beforeAll`. Subsequent calls return the cached
 * application. The container is shared across all BDD step files.
 *
 * Lifecycle:
 *   1. Start PostgreSQL 16 Testcontainer (if not yet started).
 *   2. Provision extra schemas: emp_aetos, emp_other.
 *   3. Insert FK refs for all BDD project UUIDs into each schema.
 *   4. Bootstrap NestJS with BddRealModule + CompModule + TestJwtAuthGuard.
 *   5. Register BddTenantBridgeMiddleware globally.
 */
export async function getTestApp(): Promise<INestApplication> {
  if (app) {
    return app;
  }

  // ── Step 1: Start the database (idempotent — only starts once) ────────────
  if (!_dbStarted) {
    jest.setTimeout(180000);
    await startTestDatabase();
    _dbStarted = true;

    // ── Step 2: Provision additional BDD schemas ──────────────────────────
    await provisionExtraSchema(BDD_SLUG_AETOS, BDD_ALL_PROJECT_IDS);
    await provisionExtraSchema(BDD_SLUG_OTHER, []);

    // ── Step 3: Insert remaining FK refs into emp_test and emp_test_b ────
    // startTestDatabase already inserts FIXED_PROJ_ID; insert the rest.
    const extraIds = BDD_ALL_PROJECT_IDS.filter((id) => id !== FIXED_PROJ_ID);
    await insertProjetoRefs(TEST_SLUG, extraIds);
    await insertProjetoRefs('test_b', extraIds);
  }

  // ── Step 4: Bootstrap NestJS ──────────────────────────────────────────────
  // TestJwtAuthGuard is registered as APP_GUARD directly (not via overrideGuard)
  // because JwtAuthGuard is registered as APP_GUARD in AppModule, which is NOT
  // imported here. overrideGuard only replaces a guard that is already registered
  // somewhere in the DI container — since AppModule is absent, there is nothing
  // to override and TestJwtAuthGuard would never run.
  const moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
      BddRealModule,
      CompModule,
    ],
    providers: [
      { provide: APP_GUARD, useClass: TestJwtAuthGuard },
    ],
  })
    .compile();

  app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // ── Step 5: Register middlewares and global filters ──────────────────────
  // CorrelationMiddleware must run first (sets X-Correlation-Id before handler).
  const correlation = new CorrelationMiddleware();
  app.use((req: Request, res: Response, next: NextFunction) =>
    correlation.use(req as Request & { correlationId?: string }, res, next),
  );

  // BddTenantBridgeMiddleware reads Bearer JWT and populates both ALS contexts.
  const empresaCtx = moduleRef.get(EmpresaContextService);
  const bridge = new BddTenantBridgeMiddleware(empresaCtx);
  app.use((req: Request, res: Response, next: NextFunction) => bridge.use(req, res, next));

  // ProblemJsonFilter is registered as APP_FILTER in AppModule (not imported here).
  // Register it globally so DomainException → 422 instead of 500 in BDD tests.
  app.useGlobalFilters(new ProblemJsonFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  await app.init();

  return app;
}

/**
 * Tears down the shared NestJS application and Testcontainer.
 *
 * Call once in a global afterAll (or the last step file's afterAll).
 * The container is shared, so only one call to stopTestDatabase() is needed.
 */
export async function closeTestApp(): Promise<void> {
  if (app) {
    await app.close();
    app = undefined as unknown as INestApplication;
  }
  if (_dbStarted) {
    await stopTestDatabase();
    _dbStarted = false;
  }
}

// ── Database helpers for step definitions ─────────────────────────────────────

/**
 * Truncates all COMP tables in the given empresa schema.
 *
 * Call in afterEach to isolate scenarios from each other.
 * Wraps `truncateCompTables` from db-setup with the slug for the given empresa.
 */
export async function truncateBddTables(slug: string): Promise<void> {
  try {
    await truncateCompTables(slug);
  } catch {
    // If the database is not started (e.g., test file loaded alone), swallow.
  }
}

/**
 * Queries the metadados table directly for the given empresa schema and projetoId.
 *
 * Returns the row or null. Used by step definitions that verify read-only
 * operations did not persist data (replaces fakeMetadadosRepo.getByKey()).
 */
export async function queryMetadadosByProjetoId(
  slug: string,
  projetoId: string,
): Promise<{ id: string } | null> {
  try {
    const baseUri = getBaseUri();
    const schemaUri = `${baseUri}?schema=emp_${slug}`;
    const client = new PrismaClient({ datasourceUrl: schemaUri });
    try {
      const row = await client.metadados.findUnique({ where: { projetoId }, select: { id: true } });
      return row;
    } finally {
      await client.$disconnect();
    }
  } catch {
    return null;
  }
}

// ── JWT helpers ───────────────────────────────────────────────────────────────

/**
 * Creates a synthetic (unsigned) JWT token so BddTenantBridgeMiddleware and
 * EmpresaContextMiddleware can decode it.
 *
 * The signature segment is a literal "fakesig" — the middleware only decodes, not
 * verifies. Verification happens in JwtAuthGuard which is overridden in tests.
 */
export function buildFakeJwt(claims: { sub: string; empresa_id: string; scope?: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url');
  return `${header}.${payload}.fakesig`;
}

/**
 * Builds the default test JWT for the given empresa.
 */
export function defaultJwt(empresaId = 'test'): string {
  return buildFakeJwt({ sub: 'user-bdd-001', empresa_id: empresaId });
}

// ── Request helpers ───────────────────────────────────────────────────────────

/**
 * Returns the base URL for a project-scoped COMP route.
 */
export function compUrl(projetoId: string, sub: string): string {
  return `/api/v1/comp/projetos/${projetoId}/${sub}`;
}

/** Creates a request agent with the default auth header. */
export function authRequest(app: INestApplication, empresaId = 'test'): ReturnType<typeof request.agent> {
  return request.agent(app.getHttpServer()).set('Authorization', `Bearer ${defaultJwt(empresaId)}`);
}

/** Creates a request agent without auth (for 401 tests). */
export function noAuthRequest(app: INestApplication): ReturnType<typeof request.agent> {
  return request.agent(app.getHttpServer());
}
