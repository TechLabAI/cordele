/**
 * AppModule empresa-context wiring integration test.
 *
 * Boots the REAL AppModule (full production DI tree) against a Testcontainers
 * PostgreSQL database and proves that `PrismaEmpresaService.store` is populated
 * correctly from the verified JWT — fixing the bug where every DB-touching route
 * returned 500 ("empresa context not set") in production.
 *
 * ### What this test proves
 *
 * The real `JwtAuthGuard.canActivate()` now calls `PrismaEmpresaService.enterWith()`
 * AFTER `super.canActivate()` verifies the JWT signature. Repositories then call
 * `PrismaEmpresaService.getCurrentSlug()` and get the correct schema slug.
 *
 * ### Why this test is necessary
 *
 * The bug survived 5 gate-green iterations because:
 *   - `comp.e2e-spec.ts` uses `E2EFakeInfraModule` (in-memory repos, no ALS reads)
 *   - BDD `cucumber-context.ts` used `BddTenantBridgeMiddleware` to manually populate
 *     both ALS stores, masking the missing production wiring
 *   - No test ever booted `AppModule` (the real DI tree) and hit a real DB path
 *
 * This file is the canary: if the wiring regresses, this test is the first to fail.
 *
 * ### Configuration
 *
 * `JwtStrategy` is overridden with a symmetric-key (HS256) test variant so a real
 * Keycloak is not required. The rest of `AppModule` runs unmodified: real
 * `JwtAuthGuard`, real `ScopeGuard`, real `PrismaEmpresaService`, real repositories.
 *
 * `DATABASE_URL` is set to the Testcontainer URI before any Nest module is imported
 * (ConfigModule reads env at bootstrap time).
 *
 * Issue: COMP-020 wiring gap / empresa-context bug (September 2026 audit)
 */

// ── Env vars (must be set before any Nest/Passport import) ───────────────────
process.env['NODE_ENV'] = 'test';
// JWT_ISSUER_URI is required by JwtStrategy constructor but overridden below via
// overrideProvider(JwtStrategy) — the value here is never actually used.
process.env['JWT_ISSUER_URI'] = 'http://test-issuer/realms/test';
process.env['JWT_AUDIENCE'] = 'comp-service-test';
// DATABASE_URL is overwritten in beforeAll once the Testcontainer is ready.
process.env['DATABASE_URL'] = 'postgresql://placeholder:placeholder@localhost:5432/placeholder';
process.env['FILE_STORAGE_BASE_DIR'] = '/tmp/cordele-wiring-e2e';
process.env['COMP_STUB_MANUSCRIPT_FIXTURE_PATH'] = 'test/fixtures/content-tree.json';

import * as crypto from 'crypto';

import { INestApplication, Injectable, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { JwtStrategy } from '../src/infrastructure/auth/jwt.strategy';
import type { AuthenticatedUser } from '../src/infrastructure/comp/auth/jwt-auth.guard';
import {
  startTestDatabase,
  stopTestDatabase,
  FIXED_PROJ_ID,
  TEST_SLUG,
} from './integration/db-setup';

// ── Test JWT key ──────────────────────────────────────────────────────────────

/** Shared HS256 secret — used by TestJwtStrategy (verification) and signToken() (signing). */
const TEST_JWT_SECRET = 'wiring-test-symmetric-secret-2026';

/**
 * HS256 JWT strategy for integration tests.
 *
 * Replaces the production RS256+JWKS strategy so a real Keycloak is not needed.
 * Every other part of the security chain (JwtAuthGuard, ScopeGuard, throttler)
 * runs unmodified — this strategy is the ONLY override.
 */
@Injectable()
class TestJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: true,        // test tokens have no exp claim
      secretOrKey: TEST_JWT_SECRET,
      algorithms: ['HS256'],
    });
  }

  validate(payload: {
    sub: string;
    empresa_id?: string;
    scope?: string;
    realm_access?: { roles?: string[] };
  }): AuthenticatedUser {
    return {
      userId: payload.sub,
      username: payload.sub,
      roles: payload.realm_access?.roles ?? [],
      scopes: (payload.scope ?? '').split(' ').filter((s) => s.length > 0),
      empresaId: payload.empresa_id ?? '',
    };
  }
}

// ── JWT signing helper ────────────────────────────────────────────────────────

/**
 * Signs a test JWT with HS256 using Node.js built-in `crypto`.
 *
 * The resulting token is accepted by `TestJwtStrategy` (symmetric verification).
 * No external library needed — only Node.js built-ins.
 */
function signToken(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data = `${header}.${body}`;
  const sig = crypto.createHmac('sha256', TEST_JWT_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

// ── Test timeout (Testcontainer startup) ──────────────────────────────────────

jest.setTimeout(120_000);

// ── Suite ─────────────────────────────────────────────────────────────────────

describe('AppModule empresa-context wiring (real DI tree + Testcontainers)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // 1. Boot Testcontainer and point DATABASE_URL at it.
    await startTestDatabase();

    // 2. Bootstrap AppModule with only JwtStrategy overridden.
    //    Everything else — JwtAuthGuard, ScopeGuard, PrismaEmpresaService,
    //    CompInfraBindingsModule, PersistenceModule — is the REAL production code.
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(JwtStrategy)
      .useClass(TestJwtStrategy)
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );

    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await stopTestDatabase();
  });

  // ── Primary wiring assertion ──────────────────────────────────────────────

  it(
    'GET /metadados resolves empresa context from verified JWT and queries the real DB — returns 200, not 500',
    async () => {
      // Sign a token whose `empresa_id` matches the provisioned test tenant.
      // The slug 'test' → schema 'emp_test' (provisioned by startTestDatabase).
      const token = signToken({
        sub: 'wiring-test-user',
        empresa_id: TEST_SLUG,
        scope: 'comp:read comp:write',
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/comp/projetos/${FIXED_PROJ_ID}/metadados`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // GetMetadadosViewUseCase lazy-default: no row → materialized=false.
      // If PrismaEmpresaService.store were not set, the repository would throw
      // "empresa context not set" and the response would be 500 — not 200.
      expect(res.body.projetoId).toBe(FIXED_PROJ_ID);
      expect(res.body.materialized).toBe(false);
    },
  );

  it(
    'GET /metadados without Authorization header returns 401 (guard runs before context is needed)',
    async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/comp/projetos/${FIXED_PROJ_ID}/metadados`)
        .expect(401);
    },
  );

  it(
    'PUT /metadados persists data in the correct tenant schema and returns 200',
    async () => {
      const token = signToken({
        sub: 'wiring-test-user',
        empresa_id: TEST_SLUG,
        scope: 'comp:read comp:write',
      });

      const res = await request(app.getHttpServer())
        .put(`/api/v1/comp/projetos/${FIXED_PROJ_ID}/metadados`)
        .set('Authorization', `Bearer ${token}`)
        .send({ titulo: 'Wiring Test Book', autor: 'Integration Test', idioma: 'pt' })
        .expect(200);

      // If the empresa context was not set, this would 500 (repository throws).
      // That it returns 200 with the correct data proves the full stack wiring:
      // JwtAuthGuard (verified JWT) → EmpresaContextInterceptor (runWithSlug) →
      // repository (getCurrentSlug) → correct tenant schema.
      expect(res.body.materialized).toBe(true);
      expect(res.body.titulo).toBe('Wiring Test Book');
    },
  );

  it(
    'GET /layout resolves empresa context from verified JWT and queries the real DB — returns 200, not 500',
    async () => {
      const token = signToken({
        sub: 'wiring-test-user',
        empresa_id: TEST_SLUG,
        scope: 'comp:read comp:write',
      });

      const res = await request(app.getHttpServer())
        .get(`/api/v1/comp/projetos/${FIXED_PROJ_ID}/layout`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.projetoId).toBe(FIXED_PROJ_ID);
      expect(res.body.materialized).toBe(false);
    },
  );
});
