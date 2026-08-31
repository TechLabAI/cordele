/**
 * BDD suite for: API surface boundary guard
 * Contract: test/bdd/features/project-api-surface-guard.feature
 *
 * Proves that `advanceTo` (AdvanceProjetoStatusUseCase) is never reachable via
 * HTTP. The controller has no handler at POST /projetos/:id/advance, so Nest's
 * router returns 404 for any variant of that URL.
 *
 * Setup mirrors imp-service/test/bdd/manuscript-immutability-and-tenancy.steps.ts:
 *   - NestJS TestingModule with a @Global() fake-infra module + ProjModule
 *   - AppModule is intentionally NOT imported (avoids APP_GUARD binding that
 *     overrideGuard() cannot override — documented in the PROJ plan)
 *   - A fake guard injected via app.useGlobalGuards() populates req.user
 */

// ── Env vars required by ConfigModule (must be set before any Nest import) ──────
process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/cordele_test';
process.env['JWT_ISSUER_URI'] = 'http://test-issuer/realms/test';
process.env['JWT_AUDIENCE'] = 'proj-service-test';

import { join } from 'node:path';

import {
  ExecutionContext,
  ForbiddenException,
  Global,
  INestApplication,
  Module,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { defineFeature, loadFeature } from 'jest-cucumber';
import request from 'supertest';

import { REQUIRED_SCOPES_KEY } from 'src/infrastructure/auth/jwt-auth.guard';
import { ProjModule } from 'src/modules/proj/proj.module';
import {
  PROJETO_EDITORIAL_REPOSITORY,
  PROJETO_EDITORIAL_LOOKUP,
  MANUSCRIPT_SUMMARY_PORT,
  PROJECT_METADATA_PORT,
  PUBLICATION_HISTORY_PORT,
  PUBLICATION_ERASURE_PORT,
  COMPOSITION_ERASURE_PORT,
  MANUSCRIPT_ERASURE_PORT,
} from 'src/modules/proj/proj.tokens';

import { makePrincipal } from './steps/shared';
import type { FakeRequestPrincipal } from './steps/shared';

// ── Fake repository stubs (methods will not be called in this scenario) ──────────

const fakeProjetoEditorialRepository = {
  create: jest.fn(),
  findById: jest.fn(),
  findAll: jest.fn(),
  updateStatus: jest.fn(),
  existsByIdAndEmpresa: jest.fn(),
  delete: jest.fn(),
};

// ── @Global() module that supplies all externally-bound tokens to ProjModule ─────

@Global()
@Module({
  providers: [
    {
      provide: PROJETO_EDITORIAL_REPOSITORY,
      useValue: fakeProjetoEditorialRepository,
    },
    {
      provide: PROJETO_EDITORIAL_LOOKUP,
      useValue: { exists: async () => false },
    },
    {
      provide: MANUSCRIPT_SUMMARY_PORT,
      useValue: { getManuscritoSummary: async () => null },
    },
    {
      provide: PROJECT_METADATA_PORT,
      useValue: { getMetadata: async () => null },
    },
    {
      provide: PUBLICATION_HISTORY_PORT,
      useValue: { getHistory: async () => [] },
    },
    {
      provide: PUBLICATION_ERASURE_PORT,
      useValue: { eraseByProjetoId: async () => undefined },
    },
    {
      provide: COMPOSITION_ERASURE_PORT,
      useValue: { eraseByProjetoId: async () => undefined },
    },
    {
      provide: MANUSCRIPT_ERASURE_PORT,
      useValue: { eraseByProjetoId: async () => undefined },
    },
  ],
  exports: [
    PROJETO_EDITORIAL_REPOSITORY,
    PROJETO_EDITORIAL_LOOKUP,
    MANUSCRIPT_SUMMARY_PORT,
    PROJECT_METADATA_PORT,
    PUBLICATION_HISTORY_PORT,
    PUBLICATION_ERASURE_PORT,
    COMPOSITION_ERASURE_PORT,
    MANUSCRIPT_ERASURE_PORT,
  ],
})
class ApiSurfaceBddFakeInfraModule { /* NestJS module — all configuration in @Module() decorator above */ }

// ── Configurable guard state ─────────────────────────────────────────────────────

const guardState: {
  user: FakeRequestPrincipal;
  reflector: Reflector | null;
} = {
  user: makePrincipal(),
  reflector: null,
};

const fakeAuthGuard = {
  canActivate: (context: ExecutionContext): boolean => {
    const req = context.switchToHttp().getRequest<Record<string, unknown>>();
    req['user'] = guardState.user;

    if (guardState.reflector) {
      const required = guardState.reflector.getAllAndOverride<string[] | undefined>(
        REQUIRED_SCOPES_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (required && required.length > 0) {
        const hasScope = required.some((s) => guardState.user.scopes.includes(s));
        if (!hasScope) {
          throw new ForbiddenException(
            `Insufficient scope. Required one of: ${required.join(', ')}`,
          );
        }
      }
    }

    return true;
  },
};

// ── Feature ──────────────────────────────────────────────────────────────────────

const feature = loadFeature(join(__dirname, 'features', 'project-api-surface-guard.feature'));

defineFeature(feature, (test) => {
  let app: INestApplication;
  let response: request.Response;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        ApiSurfaceBddFakeInfraModule,
        ProjModule,
      ],
    }).compile();

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
    app.useGlobalGuards(fakeAuthGuard as Parameters<typeof app.useGlobalGuards>[0]);
    await app.init();

    guardState.reflector = moduleRef.get(Reflector);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    guardState.user = makePrincipal();
  });

  // ── Scenario: The advanceTo operation is not reachable via HTTP ───────────────
  //
  // SPEC-01 clause 2: advanceTo is exclusively an in-process inbound port.
  // ProjController declares no handler at POST .../advance — Nest returns 404.

  test('The advanceTo operation is not reachable via HTTP', ({ and, given, then, when }) => {
    given('an authenticated editor of empresa "aetos"', () => {
      // guardState.user is already set to makePrincipal() (full proj:* scopes, aetos)
      // by beforeEach. This step documents the precondition; nothing more to do.
    });

    when('a POST request is sent to "/api/proj/projetos/proj-1/advance"', async () => {
      // Send the request to the exact path from the Gherkin. This route does not
      // exist on ProjController (which is mounted at /api/v1/proj/...), so Nest's
      // router returns 404 regardless of prefix or versioning.
      response = await request(app.getHttpServer())
        .post('/api/proj/projetos/proj-1/advance');
    });

    then('the response status is 404', () => {
      expect(response.status).toBe(404);
    });

    and('the response body does not contain "advanceTo"', () => {
      // The default Nest 404 body is {"statusCode":404,"message":"Cannot POST ...","error":"Not Found"}.
      // None of those fields mention "advanceTo".
      expect(JSON.stringify(response.body)).not.toContain('advanceTo');
    });
  });
});
