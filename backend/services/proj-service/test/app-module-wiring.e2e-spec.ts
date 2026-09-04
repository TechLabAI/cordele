/**
 * AppModule empresa-context wiring integration test — PROJ service.
 *
 * Boots the REAL AppModule (full production DI tree) and proves that
 * `EmpresaContextStore` is populated correctly by `EmpresaContextInterceptor`
 * during authenticated HTTP requests — fixing the bug where any code path
 * calling `EmpresaContextStore.getEditoraId()` (e.g. `ProjetoEditorialLookupAdapter`)
 * threw "invoked outside an AsyncLocalStorage context" in production.
 *
 * ### What this test proves
 *
 * 1. `EmpresaContextInterceptor` (APP_INTERCEPTOR) wraps `next.handle()` inside
 *    `EmpresaContextStore.run({ editoraId, slug }, fn)`, making the store visible
 *    to every provider called within the handler chain.
 * 2. A `ContextCaptureInterceptor` — registered after the production interceptors
 *    via `app.useGlobalInterceptors()` — captures `EmpresaContextStore.tryGetEditoraId()`
 *    inside its `tap()`. Because it runs within the ALS scope established by
 *    `EmpresaContextInterceptor`, the captured value equals the JWT's `empresa_id`.
 * 3. Regular authenticated routes continue to return 200/201 (the interceptor
 *    does not break the normal path).
 * 4. Unauthenticated requests return 401 (guard still runs before the interceptor).
 *
 * ### Why this test was missing
 *
 * The bug survived previous gate-green iterations because:
 *   - `proj.e2e-spec.ts` uses `passport.use()` to inject a pre-built TEST_USER,
 *     bypassing the full JwtAuthGuard + interceptor chain.
 *   - No test ever verified that the ALS context was populated during a real request.
 *   - `ProjetoEditorialLookupAdapter.exists()` — the only production reader of the
 *     store — is an in-process port, not a directly accessible HTTP route.
 *
 * This file is the canary: if `EmpresaContextInterceptor` is removed or its ALS
 * scope breaks, `contextCapture.capturedEditoraId` will be undefined and the test
 * fails immediately.
 *
 * ### Configuration
 *
 * `JwtStrategy` is overridden with a symmetric-key (HS256) test variant so a real
 * Keycloak/JWKS endpoint is not required. The rest of `AppModule` runs unmodified:
 * real `JwtAuthGuard`, real `EmpresaContextInterceptor`, real `TenantPrismaFactory`,
 * real repositories.
 *
 * The test requires a real database reachable at `DATABASE_URL`. The CI environment
 * is responsible for provisioning the `emp_aetos` schema (the same requirement as
 * `proj.e2e-spec.ts`, which also uses `empresaId: 'aetos'`). When running locally,
 * start the DB with `docker compose -f docker/docker-compose.dev.yml up -d`.
 */

// ── Env vars (must be set before any Nest/Passport import) ───────────────────
process.env['NODE_ENV'] = 'test';
process.env['JWT_ISSUER_URI'] ??= 'http://test-issuer/realms/test';
process.env['JWT_AUDIENCE'] ??= 'proj-service-test';

import * as crypto from 'crypto';
import {
  CallHandler,
  ExecutionContext,
  INestApplication,
  Injectable,
  NestInterceptor,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { JwtStrategy } from '../src/infrastructure/auth/jwt.strategy';
import type { AuthenticatedUser } from '../src/infrastructure/auth/jwt-auth.guard';
import { EmpresaContextStore } from '../src/infrastructure/context/empresa.context';

// ── Test JWT configuration ────────────────────────────────────────────────────

/** Shared HS256 secret used by TestJwtStrategy (verification) and signToken() (signing). */
const TEST_JWT_SECRET = 'proj-wiring-test-symmetric-secret-2026';

/** Empresa slug used across all tests — matches the schema provisioned in CI/dev. */
const TEST_EMPRESA_ID = 'aetos';

/**
 * HS256 JWT strategy for integration tests.
 *
 * Replaces the production RS256+JWKS strategy so a real Keycloak is not needed.
 * Every other part of the security chain (JwtAuthGuard, EmpresaContextInterceptor,
 * ThrottlerGuard, TenantPrismaFactory) runs unmodified.
 */
@Injectable()
class TestJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: true,
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
      empresaId: (payload.empresa_id ?? '').replace(/^emp_/, ''),
    };
  }
}

/**
 * Signs a test JWT with HS256 using Node.js built-in `crypto`.
 *
 * Accepted by `TestJwtStrategy` — no external library needed.
 */
function signToken(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const data = `${header}.${body}`;
  const sig = crypto.createHmac('sha256', TEST_JWT_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

// ── Context capture interceptor ───────────────────────────────────────────────

/**
 * Test-only interceptor that records whether `EmpresaContextStore` is populated
 * during handler execution.
 *
 * Registered via `app.useGlobalInterceptors()` AFTER `EmpresaContextInterceptor`
 * (APP_INTERCEPTOR). NestJS chains APP_INTERCEPTOR providers before
 * `useGlobalInterceptors()` interceptors, so this interceptor's `tap()` runs
 * within the ALS scope established by `EmpresaContextInterceptor`.
 *
 * If `EmpresaContextInterceptor` correctly called `store.run()`, the `tap()`
 * executes inside that scope and `tryGetEditoraId()` returns the empresa slug.
 * If the wiring is broken, it returns `undefined`.
 */
@Injectable()
class ContextCaptureInterceptor implements NestInterceptor {
  public capturedEditoraId: string | undefined = undefined;

  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      tap(() => {
        this.capturedEditoraId = EmpresaContextStore.tryGetEditoraId();
      }),
    );
  }
}

// ── Suite ─────────────────────────────────────────────────────────────────────

jest.setTimeout(60_000);

describe('AppModule empresa-context wiring (EmpresaContextInterceptor propagation)', () => {
  let app: INestApplication;
  let contextCapture: ContextCaptureInterceptor;

  beforeAll(async () => {
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

    // Register the capture interceptor AFTER production interceptors.
    contextCapture = new ContextCaptureInterceptor();
    app.useGlobalInterceptors(contextCapture);

    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  // ── Primary wiring assertion ──────────────────────────────────────────────

  it(
    'POST /projetos — EmpresaContextStore is populated from verified JWT during handler execution',
    async () => {
      // Reset capture before each assertion.
      contextCapture.capturedEditoraId = undefined;

      const token = signToken({
        sub: 'wiring-test-user',
        empresa_id: TEST_EMPRESA_ID,
        scope: 'proj:read proj:write',
      });

      // A 201 proves the route itself works; the capture assertion proves the store was set.
      await request(app.getHttpServer())
        .post('/api/v1/proj/projetos')
        .set('Authorization', `Bearer ${token}`)
        .send({ nome: 'wiring test project' })
        .expect(201);

      // If EmpresaContextInterceptor did NOT wrap next.handle() in store.run(),
      // capturedEditoraId would be undefined — this assertion fails.
      // If it DID wrap correctly, the tap() runs inside the ALS scope and captures
      // the empresaId set from the verified JWT claim.
      expect(contextCapture.capturedEditoraId).toBe(TEST_EMPRESA_ID);
    },
  );

  it(
    'GET /projetos — context is set on a read route (GET path coverage)',
    async () => {
      contextCapture.capturedEditoraId = undefined;

      const token = signToken({
        sub: 'wiring-test-user',
        empresa_id: TEST_EMPRESA_ID,
        scope: 'proj:read proj:write',
      });

      await request(app.getHttpServer())
        .get('/api/v1/proj/projetos')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(contextCapture.capturedEditoraId).toBe(TEST_EMPRESA_ID);
    },
  );

  // ── Guard-before-interceptor ordering ───────────────────────────────────

  it(
    'request without Authorization header returns 401 — guard runs before interceptor, context not needed',
    async () => {
      await request(app.getHttpServer())
        .post('/api/v1/proj/projetos')
        .send({ nome: 'should be rejected' })
        .expect(401);
    },
  );
});
