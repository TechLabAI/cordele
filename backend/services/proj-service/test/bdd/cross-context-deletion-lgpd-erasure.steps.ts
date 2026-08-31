/**
 * BDD suite for: Cross-context deletion and LGPD erasure
 * Contract: test/bdd/features/cross-context-deletion-lgpd-erasure.feature
 *
 * SCOPE DECISION (PROJ plan §P8 / PROJ-018):
 *   The Gherkin uses "scope 'proj:delete'" as a business-level label for the
 *   privileged deletion capability. The real controller applies
 *   @RequiredScopes('proj:write') on DELETE /projetos/:projetoId — there is no
 *   literal 'proj:delete' scope anywhere in the production code; the Gherkin
 *   label was conceptual only.
 *   Resolution applied here:
 *     - "an authenticated principal ... with scope 'proj:delete'" →
 *         guard injects scopes: ['proj:read', 'proj:write', 'proj:delete']
 *         ('proj:write' satisfies @RequiredScopes('proj:write'))
 *     - "the principal's token lacks scope 'proj:delete'" →
 *         guard injects scopes: ['proj:read'] ('proj:write' is absent,
 *         guard throws ForbiddenException → 403)
 */

// ── Env vars required by ConfigModule (before any Nest import) ─────────────────
process.env['NODE_ENV'] = 'test';
process.env['JWT_ISSUER_URI'] = 'http://test-issuer/realms/test';
process.env['JWT_AUDIENCE'] = 'proj-service-test';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/cordele_test';

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

import { ProjModule } from 'src/modules/proj/proj.module';
import {
  PROJETO_EDITORIAL_REPOSITORY,
  MANUSCRIPT_SUMMARY_PORT,
  PROJECT_METADATA_PORT,
  PUBLICATION_HISTORY_PORT,
  PUBLICATION_ERASURE_PORT,
  COMPOSITION_ERASURE_PORT,
  MANUSCRIPT_ERASURE_PORT,
  PROJECT_EVENT_PUBLISHER,
} from 'src/modules/proj/proj.tokens';
import type { ProjetoEditorialData } from 'src/domain/proj/projeto-editorial.repository';
import { ProjetoStatus } from 'src/domain/proj/value-objects/project-status.vo';

import {
  EMPRESA_AETOS,
  makePrincipal,
  makeProjetoEditorialData,
  expectStatus,
} from './steps/shared';

// ── Fixed UUIDs for proj-1 and proj-2 (must be valid UUIDs — ParseUUIDPipe) ──

const PROJ_1_UUID = 'a1000000-0000-4000-8000-000000000001';
const PROJ_2_UUID = 'a2000000-0000-4000-8000-000000000002';

// ── In-memory repository (cleared in beforeEach) ───────────────────────────────

const projetoStore = new Map<string, ProjetoEditorialData>();

const fakeProjetoRepo = {
  create: async (): Promise<ProjetoEditorialData> => {
    throw new Error('create: not exercised by this BDD suite');
  },
  findById: async (id: string, empresaId: string): Promise<ProjetoEditorialData | null> => {
    const data = projetoStore.get(id);
    if (data && data.editoraId === empresaId) return data;
    return null;
  },
  findAll: async (_empresaId: string): Promise<ProjetoEditorialData[]> => [],
  updateStatus: async (): Promise<ProjetoEditorialData> => {
    throw new Error('updateStatus: not exercised by this BDD suite');
  },
  existsByIdAndEmpresa: async (id: string, empresaId: string): Promise<boolean> => {
    const data = projetoStore.get(id);
    return !!(data && data.editoraId === empresaId);
  },
  /**
   * Hard-deletes the row from the in-memory store so that "project still exists"
   * assertions in the abort scenario detect the correct post-failure state.
   */
  delete: async (id: string, empresaId: string): Promise<void> => {
    const data = projetoStore.get(id);
    if (data && data.editoraId === empresaId) {
      projetoStore.delete(id);
    }
  },
};

// ── Call order tracking (reset in beforeEach) ─────────────────────────────────

const callOrder: string[] = [];

// ── Jest mock erasure ports (reset + reconfigured in beforeEach) ───────────────
//
// Default implementations push their context label into callOrder and resolve,
// so Scenario 1 can verify the leaf-first ordering.
// Per-scenario failure modes are configured via mockRejectedValueOnce() BEFORE
// the default mockImplementation is checked — jest respects "once" queues first.

const fakePubErasure = { erase: jest.fn() };
const fakeCompErasure = { erase: jest.fn() };
const fakeImpErasure = { erase: jest.fn() };

// ── Fake event publisher spy (reset in beforeEach) ────────────────────────────

const fakeEventPublisher = { publish: jest.fn() };

// ── @Global() fake infra module ───────────────────────────────────────────────
//
// Provides the tokens that real AppModule supplies globally
// (PersistenceModule, ReadPortsModule, ErasurePortsModule).
// ProjModule must NOT import infrastructure/ (RULE-04), so these must arrive
// via a @Global() module — same pattern as imp-service BDD suites.

@Global()
@Module({
  providers: [
    // ProjetoEditorialRepository — in-memory Map controlled by step defs
    { provide: PROJETO_EDITORIAL_REPOSITORY, useValue: fakeProjetoRepo },
    // Cross-context read ports (P4) — not exercised by DELETE; minimal stubs so
    // GetProjetoLibraryUseCase / GetProjetoDetailUseCase can be instantiated
    { provide: MANUSCRIPT_SUMMARY_PORT, useValue: { getSummary: async () => null } },
    { provide: PROJECT_METADATA_PORT, useValue: { getMetadata: async () => null } },
    { provide: PUBLICATION_HISTORY_PORT, useValue: { getHistory: async () => [] } },
    // Erasure ports — jest.fn() mocks, behaviour reset per scenario in beforeEach
    { provide: PUBLICATION_ERASURE_PORT, useValue: fakePubErasure },
    { provide: COMPOSITION_ERASURE_PORT, useValue: fakeCompErasure },
    { provide: MANUSCRIPT_ERASURE_PORT, useValue: fakeImpErasure },
  ],
  exports: [
    PROJETO_EDITORIAL_REPOSITORY,
    MANUSCRIPT_SUMMARY_PORT,
    PROJECT_METADATA_PORT,
    PUBLICATION_HISTORY_PORT,
    PUBLICATION_ERASURE_PORT,
    COMPOSITION_ERASURE_PORT,
    MANUSCRIPT_ERASURE_PORT,
  ],
})
class ProjBddFakeInfraModule { /* NestJS module — all configuration in @Module() decorator above */ }

// ── Auth guard state (mutated per scenario, reset in beforeEach) ───────────────
//
// The guard stub reads `guardState.user` at request time (lazy reference) and
// enforces @RequiredScopes metadata via the Reflector.  Swapping `guardState.user`
// inside a step body therefore affects the next HTTP request without rebuilding
// the app — same pattern as imp-service BDD suites.

const REQUIRED_SCOPES_METADATA_KEY = 'requiredScopes';

const guardState: {
  user: ReturnType<typeof makePrincipal>;
  reflector: Reflector | null;
} = {
  user: makePrincipal(), // default: full scopes incl. proj:write
  reflector: null,
};

const fakeAuthGuard = {
  canActivate: (context: ExecutionContext): boolean => {
    const req = context.switchToHttp().getRequest<Record<string, unknown>>();
    req['user'] = guardState.user;

    if (guardState.reflector) {
      const required = guardState.reflector.getAllAndOverride<string[] | undefined>(
        REQUIRED_SCOPES_METADATA_KEY,
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

// ── Feature ───────────────────────────────────────────────────────────────────

const feature = loadFeature(
  join(__dirname, 'features', 'cross-context-deletion-lgpd-erasure.feature'),
);

defineFeature(feature, (test) => {
  let app: INestApplication;
  let response: request.Response;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        // Fake infra must be imported BEFORE ProjModule so @Global() providers
        // are registered first.  ProjModule's own internal providers (e.g.
        // PROJECT_EVENT_PUBLISHER, PROJETO_EDITORIAL_LOOKUP) take local
        // precedence — the override below replaces PROJECT_EVENT_PUBLISHER.
        ProjBddFakeInfraModule,
        ProjModule,
      ],
    })
      // Replace ProjModule's no-op event publisher stub with the spy so that
      // DeleteProjetoUseCase receives fakeEventPublisher via DI.
      .overrideProvider(PROJECT_EVENT_PUBLISHER)
      .useValue(fakeEventPublisher)
      .compile();

    app = moduleRef.createNestApplication();
    // Replicate src/main.ts bootstrap (no exception filter in proj-service).
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
    // Register the guard AFTER pipes so it intercepts at the correct lifecycle
    // position (mirrors AppModule's APP_GUARD registration, avoids the known
    // NestJS bug with overrideGuard() + APP_GUARD — hence we use ProjModule
    // directly instead of AppModule).
    app.useGlobalGuards(fakeAuthGuard as Parameters<typeof app.useGlobalGuards>[0]);
    await app.init();

    // Wire the Reflector so the guard stub can read @RequiredScopes metadata.
    guardState.reflector = moduleRef.get(Reflector);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    // Clear repository
    projetoStore.clear();
    // Clear call-order log
    callOrder.length = 0;
    // Reset erasure port mocks and set default behaviour: succeed + track order
    fakePubErasure.erase.mockReset();
    fakeCompErasure.erase.mockReset();
    fakeImpErasure.erase.mockReset();
    fakePubErasure.erase.mockImplementation(async () => {
      callOrder.push('PUB');
    });
    fakeCompErasure.erase.mockImplementation(async () => {
      callOrder.push('COMP');
    });
    fakeImpErasure.erase.mockImplementation(async () => {
      callOrder.push('IMP');
    });
    // Reset event publisher spy
    fakeEventPublisher.publish.mockReset();
    // Reset guard principal to full-scopes default
    guardState.user = makePrincipal();
  });

  // ── Scenario 1: Deleting a project purges all contexts leaf-first then the identity ──

  test('Deleting a project purges all contexts leaf-first then the identity', ({
    and,
    given,
    then,
    when,
  }) => {
    given('an authenticated principal of empresa "aetos" with scope "proj:delete"', () => {
      // Default principal already has proj:write (set in beforeEach).
      // Explicit assignment makes the Gherkin intent readable in the test output.
      guardState.user = makePrincipal({
        scopes: ['proj:read', 'proj:write', 'proj:delete'],
      });
    });

    given(
      'an existing project "proj-1" with imported manuscripts, composed metadata and publications',
      () => {
        projetoStore.set(
          PROJ_1_UUID,
          makeProjetoEditorialData({ id: PROJ_1_UUID, editoraId: EMPRESA_AETOS, status: ProjetoStatus.publicado }),
        );
      },
    );

    when('the principal deletes project "proj-1"', async () => {
      response = await request(app.getHttpServer()).delete(
        `/api/v1/proj/projetos/${PROJ_1_UUID}`,
      );
    });

    then('the response status is 204', () => {
      expectStatus(response, 204);
    });

    and('PUB publications and their ePub artifacts are purged', () => {
      expect(fakePubErasure.erase).toHaveBeenCalledWith(PROJ_1_UUID, EMPRESA_AETOS);
    });

    and('COMP metadata and layout are purged', () => {
      expect(fakeCompErasure.erase).toHaveBeenCalledWith(PROJ_1_UUID, EMPRESA_AETOS);
    });

    and('IMP manuscripts and their stored binaries and images are purged', () => {
      expect(fakeImpErasure.erase).toHaveBeenCalledWith(PROJ_1_UUID, EMPRESA_AETOS);
    });

    and('the projeto_editorial and its status history are removed', () => {
      expect(projetoStore.has(PROJ_1_UUID)).toBe(false);
    });

    and('the purge order was pub then comp then imp then projeto_editorial', () => {
      // callOrder records PUB/COMP/IMP in sequence; DB delete happens after IMP
      // (verified via absence of the row from the store above).
      expect(callOrder).toEqual(['PUB', 'COMP', 'IMP']);
    });

    and('a ProjectDeleted event is emitted', () => {
      expect(fakeEventPublisher.publish).toHaveBeenCalledTimes(1);
      expect(fakeEventPublisher.publish).toHaveBeenCalledWith(
        'ProjectDeleted',
        expect.objectContaining({ projetoId: PROJ_1_UUID, editoraId: EMPRESA_AETOS }),
      );
    });
  });

  // ── Scenario 2: A project with no downstream data still deletes cleanly ──────

  test('A project with no downstream data still deletes cleanly', ({
    and,
    given,
    then,
    when,
  }) => {
    given('an authenticated principal of empresa "aetos" with scope "proj:delete"', () => {
      guardState.user = makePrincipal({
        scopes: ['proj:read', 'proj:write', 'proj:delete'],
      });
    });

    given(
      'an existing project "proj-2" in status "rascunho" with no manuscript, metadata or publication',
      () => {
        projetoStore.set(
          PROJ_2_UUID,
          makeProjetoEditorialData({ id: PROJ_2_UUID, editoraId: EMPRESA_AETOS, status: ProjetoStatus.rascunho }),
        );
      },
    );

    when('the principal deletes project "proj-2"', async () => {
      response = await request(app.getHttpServer()).delete(
        `/api/v1/proj/projetos/${PROJ_2_UUID}`,
      );
    });

    then('the response status is 204', () => {
      expectStatus(response, 204);
    });

    and('the per-context purges were idempotent no-ops', () => {
      // All three erasure ports were called once and resolved successfully.
      // Idempotency is a contract of the real ports: "no data to purge" is a
      // no-op success, not an error. The mocks satisfy this by default.
      expect(fakePubErasure.erase).toHaveBeenCalledTimes(1);
      expect(fakeCompErasure.erase).toHaveBeenCalledTimes(1);
      expect(fakeImpErasure.erase).toHaveBeenCalledTimes(1);
    });

    and('the projeto_editorial is removed', () => {
      expect(projetoStore.has(PROJ_2_UUID)).toBe(false);
    });
  });

  // ── Scenario 3: A failing purge aborts before the identity is removed ─────────

  test('A failing purge aborts before the identity is removed', ({
    and,
    given,
    then,
    when,
  }) => {
    given('an authenticated principal of empresa "aetos" with scope "proj:delete"', () => {
      guardState.user = makePrincipal({
        scopes: ['proj:read', 'proj:write', 'proj:delete'],
      });
    });

    given('an existing project "proj-1" with imported manuscripts and publications', () => {
      projetoStore.set(
        PROJ_1_UUID,
        makeProjetoEditorialData({ id: PROJ_1_UUID, editoraId: EMPRESA_AETOS, status: ProjetoStatus.publicado }),
      );
    });

    and('the publication erasure port is unavailable', () => {
      // Queue a one-time rejection for the PUB port.  The use case catches this
      // and re-throws as BadGatewayException (502), aborting the cascade before
      // the COMP / IMP / DB-delete steps are reached (abort-on-failure).
      fakePubErasure.erase.mockReset();
      fakePubErasure.erase.mockRejectedValueOnce(
        new Error('PUB service unavailable (simulated)'),
      );
    });

    when('the principal deletes project "proj-1"', async () => {
      response = await request(app.getHttpServer()).delete(
        `/api/v1/proj/projetos/${PROJ_1_UUID}`,
      );
    });

    then('the response status is 502', () => {
      expectStatus(response, 502);
    });

    and('project "proj-1" still exists', () => {
      // The cascade aborted at PUB — repository.delete was never called, so the
      // row remains in the in-memory store.
      expect(projetoStore.has(PROJ_1_UUID)).toBe(true);
    });

    and('no ProjectDeleted event is emitted', () => {
      expect(fakeEventPublisher.publish).not.toHaveBeenCalled();
      // Also assert strict abort-on-failure: COMP and IMP must not have been called.
      expect(fakeCompErasure.erase).not.toHaveBeenCalled();
      expect(fakeImpErasure.erase).not.toHaveBeenCalled();
    });
  });

  // ── Scenario 4: A retried deletion after a partial failure completes idempotently ──

  test('A retried deletion after a partial failure completes idempotently', ({
    and,
    given,
    then,
    when,
  }) => {
    given('an authenticated principal of empresa "aetos" with scope "proj:delete"', () => {
      guardState.user = makePrincipal({
        scopes: ['proj:read', 'proj:write', 'proj:delete'],
      });
    });

    given(
      'a previous deletion of project "proj-1" purged PUB and COMP but failed on IMP',
      () => {
        // The project row still exists because the previous attempt aborted at IMP
        // (abort-on-failure preserved it — same logic as Scenario 3).
        projetoStore.set(
          PROJ_1_UUID,
          makeProjetoEditorialData({ id: PROJ_1_UUID, editoraId: EMPRESA_AETOS, status: ProjetoStatus.publicado }),
        );
        // Idempotency contract: re-calling erase() for already-purged data must
        // succeed without error.  The jest.fn() mocks honour this naturally —
        // they always resolve (via mockImplementation set in beforeEach) unless
        // explicitly configured to fail.  No state tracking is needed in the fake.
      },
    );

    when('the principal deletes project "proj-1" again', async () => {
      response = await request(app.getHttpServer()).delete(
        `/api/v1/proj/projetos/${PROJ_1_UUID}`,
      );
    });

    then('the response status is 204', () => {
      expectStatus(response, 204);
    });

    and('re-purging PUB and COMP were no-ops', () => {
      // Both ports were called once more and resolved (idempotent by contract).
      expect(fakePubErasure.erase).toHaveBeenCalledWith(PROJ_1_UUID, EMPRESA_AETOS);
      expect(fakeCompErasure.erase).toHaveBeenCalledWith(PROJ_1_UUID, EMPRESA_AETOS);
    });

    and('IMP manuscripts and binaries are purged', () => {
      expect(fakeImpErasure.erase).toHaveBeenCalledWith(PROJ_1_UUID, EMPRESA_AETOS);
    });

    and('the projeto_editorial is removed', () => {
      expect(projetoStore.has(PROJ_1_UUID)).toBe(false);
    });
  });

  // ── Scenario 5: Deletion without the privileged scope is forbidden ─────────────

  test('Deletion without the privileged scope is forbidden', ({ given, then, when }) => {
    given('an authenticated principal of empresa "aetos" with scope "proj:delete"', () => {
      // Background: start with the full-scopes principal.
      guardState.user = makePrincipal({
        scopes: ['proj:read', 'proj:write', 'proj:delete'],
      });
    });

    given('the principal\'s token lacks scope "proj:delete"', () => {
      // Replace the principal with one that only holds proj:read.
      // The real DELETE handler is annotated @RequiredScopes('proj:write');
      // the guard stub will throw ForbiddenException (403) because proj:write
      // is absent from the principal's scopes.
      guardState.user = makePrincipal({ scopes: ['proj:read'] });
    });

    when('the principal deletes project "proj-1"', async () => {
      // Pre-seed the project so the 403 comes from the guard, not from 404.
      projetoStore.set(
        PROJ_1_UUID,
        makeProjetoEditorialData({ id: PROJ_1_UUID, editoraId: EMPRESA_AETOS }),
      );
      response = await request(app.getHttpServer()).delete(
        `/api/v1/proj/projetos/${PROJ_1_UUID}`,
      );
    });

    then('the response status is 403', () => {
      expectStatus(response, 403);
    });
  });
});
