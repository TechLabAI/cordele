/**
 * BDD suite for: Project status authority and legal transitions
 * Contract: test/bdd/features/project-status-authority-transitions.feature
 *
 * All 10 scenarios implemented (including the 6-row Scenario Outline).
 * Issues: PROJ-018 (P8 — BDD end-to-end for status authority).
 *
 * Architecture notes:
 *  - NestJS TestingModule imports ProjBddFakeInfraModule (@Global) + ProjModule directly.
 *    AppModule is deliberately NOT imported: it registers JwtAuthGuard as APP_GUARD via
 *    useClass, and overrideGuard() does not suppress APP_GUARD (known NestJS limitation,
 *    documented in plan-PROJ.md). The fake guard is installed via app.useGlobalGuards().
 *  - PROJECT_EVENT_PUBLISHER is overridden in the TestingModule builder with a jest spy.
 *  - ADVANCE_PROJETO_STATUS_USE_CASE is invoked directly (app.get) — there is no HTTP
 *    route for "advance"; IMP/PUB call the use case as a cross-context dependency.
 *  - REOPEN_PROJECT_USE_CASE is exercised via HTTP POST /api/v1/proj/projetos/:id/reopen.
 */

// Env vars required by ConfigModule (before any Nest import)
process.env['NODE_ENV'] = 'test';
process.env['JWT_ISSUER_URI'] = 'http://test-issuer/realms/test';
process.env['JWT_AUDIENCE'] = 'proj-service-test';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/cordele_test';

import { join } from 'node:path';

import {
  ExecutionContext,
  ForbiddenException,
  Global,
  type INestApplication,
  Module,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { defineFeature, loadFeature } from 'jest-cucumber';
import request from 'supertest';

import {
  ADVANCE_PROJETO_STATUS_USE_CASE,
  PROJETO_EDITORIAL_REPOSITORY,
  PROJECT_EVENT_PUBLISHER,
  MANUSCRIPT_SUMMARY_PORT,
  PROJECT_METADATA_PORT,
  PUBLICATION_HISTORY_PORT,
  PUBLICATION_ERASURE_PORT,
  COMPOSITION_ERASURE_PORT,
  MANUSCRIPT_ERASURE_PORT,
} from 'src/modules/proj/proj.tokens';
import { ProjModule } from 'src/modules/proj/proj.module';
import { IllegalStatusTransitionError } from 'src/domain/proj/errors/illegal-status-transition.error';
import { ProjetoStatus } from 'src/domain/proj/value-objects/project-status.vo';
import type {
  ProjetoEditorialData,
  ProjetoEditorialRepository as IProjetoEditorialRepository,
  CreateProjetoEditorialInput,
  UpdateStatusInput,
} from 'src/domain/proj/projeto-editorial.repository';
import type { UsuarioContext } from 'src/domain/shared/usuario-context.interface';

import {
  EMPRESA_AETOS,
  SCOPE_WRITE,
  makePrincipal,
  expectStatus,
  type ProjetoStatusLiteral,
} from './steps/shared';

// ── Stable UUID for "proj-1" — valid UUID so ParseUUIDPipe accepts it ─────────
const PROJ_1_UUID = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c401';

// ── In-memory ProjetoEditorial repository (scoped to this suite) ──────────────

const projetoStore = new Map<string, ProjetoEditorialData>();

const fakeProjetoRepo: IProjetoEditorialRepository = {
  create: async (input: CreateProjetoEditorialInput): Promise<ProjetoEditorialData> => {
    const data: ProjetoEditorialData = {
      id: input.id,
      nome: input.nome,
      descricao: input.descricao ?? null,
      editoraId: input.editoraId,
      status: input.status,
      criadoEm: new Date(),
      atualizadoEm: new Date(),
    };
    projetoStore.set(input.id, data);
    return data;
  },

  findById: async (id: string, empresaId: string): Promise<ProjetoEditorialData | null> => {
    const p = projetoStore.get(id);
    if (p && p.editoraId === empresaId) return p;
    return null;
  },

  findAll: async (empresaId: string): Promise<ProjetoEditorialData[]> =>
    [...projetoStore.values()].filter((p) => p.editoraId === empresaId),

  updateStatus: async (input: UpdateStatusInput): Promise<ProjetoEditorialData> => {
    const existing = projetoStore.get(input.id);
    if (!existing) throw new Error(`Projeto ${input.id} not found in fake store`);
    const updated: ProjetoEditorialData = {
      ...existing,
      status: input.newStatus,
      atualizadoEm: new Date(),
    };
    projetoStore.set(input.id, updated);
    return updated;
  },

  existsByIdAndEmpresa: async (id: string, empresaId: string): Promise<boolean> => {
    const p = projetoStore.get(id);
    return !!p && p.editoraId === empresaId;
  },

  delete: async (id: string): Promise<void> => {
    projetoStore.delete(id);
  },
};

// ── Event publisher spy (overrides the no-op stub registered in ProjModule) ───

const publishSpy = { publish: jest.fn() };

// ── @Global() module: exposes all tokens that ProjModule expects from "globals" ─
//
// In production: PersistenceModule (@Global) provides PROJETO_EDITORIAL_REPOSITORY;
// ReadPortsModule (@Global) provides the three read-port tokens;
// ErasurePortsModule (@Global) provides the three erasure-port tokens.
// In this BDD suite we provide all of them from a single @Global() fake module.

@Global()
@Module({
  providers: [
    { provide: PROJETO_EDITORIAL_REPOSITORY, useValue: fakeProjetoRepo },
    // Read-port stubs — never called in status-transition scenarios.
    {
      provide: MANUSCRIPT_SUMMARY_PORT,
      useValue: { byProjetoIds: async () => new Map(), findByProjetoId: async () => null },
    },
    {
      provide: PROJECT_METADATA_PORT,
      useValue: { byProjetoIds: async () => new Map(), findByProjetoId: async () => null },
    },
    {
      provide: PUBLICATION_HISTORY_PORT,
      useValue: {
        latest: async () => new Map(),
        history: async () => [],
        signedDownloadUrl: async () => ({
          arquivoUrl: 'https://fake.example.com/fake.epub',
          expiresAt: new Date().toISOString(),
        }),
      },
    },
    // Erasure-port stubs — never called in status-transition scenarios.
    { provide: PUBLICATION_ERASURE_PORT, useValue: { erase: async () => undefined } },
    { provide: COMPOSITION_ERASURE_PORT, useValue: { erase: async () => undefined } },
    { provide: MANUSCRIPT_ERASURE_PORT, useValue: { erase: async () => undefined } },
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

// ── Configurable guard state ──────────────────────────────────────────────────
//
// The guard stub injects `guardState.principal` as `req.user` and enforces
// @RequiredScopes metadata via Reflector — mirroring the real JwtAuthGuard logic.
// REQUIRED_SCOPES_KEY must match the constant in modules/proj/decorators/require-scope.decorator.ts.

const REQUIRED_SCOPES_KEY = 'requiredScopes';

const guardState: {
  principal: ReturnType<typeof makePrincipal>;
  reflector: Reflector | null;
} = {
  principal: makePrincipal(),
  reflector: null,
};

const fakeAuthGuard = {
  canActivate: (context: ExecutionContext): boolean => {
    const req = context.switchToHttp().getRequest<Record<string, unknown>>();
    req['user'] = guardState.principal;

    if (guardState.reflector) {
      const required = guardState.reflector.getAllAndOverride<string[] | undefined>(
        REQUIRED_SCOPES_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (required && required.length > 0) {
        const hasScope = required.some((s) =>
          (guardState.principal.scopes as readonly string[]).includes(s),
        );
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

// ── UsuarioContext for direct use-case invocations (IMP/PUB simulated calls) ──

const fakeUser: UsuarioContext = {
  id: '00000000-0000-0000-0000-0000000000e1',
  empresaId: EMPRESA_AETOS,
  scopes: [SCOPE_WRITE],
};

// ── Feature ───────────────────────────────────────────────────────────────────

const feature = loadFeature(
  join(__dirname, 'features', 'project-status-authority-transitions.feature'),
);

defineFeature(feature, (test) => {
  let app: INestApplication;
  let response: request.Response;
  let advanceError: Error | null = null;

  // ── Seed helper ─────────────────────────────────────────────────────────────

  function seedProj1(status: ProjetoStatusLiteral): void {
    const now = new Date('2026-08-20T10:00:00.000Z');
    const data: ProjetoEditorialData = {
      id: PROJ_1_UUID,
      nome: 'Projeto de Teste BDD',
      descricao: null,
      editoraId: EMPRESA_AETOS,
      status: status as ProjetoStatus,
      criadoEm: now,
      atualizadoEm: now,
    };
    projetoStore.set(PROJ_1_UUID, data);
  }

  // ── Shorthand: get the advance use case from the DI container ───────────────

  function getAdvanceUc(): {
    advanceTo(
      input: { projetoId: string; targetStatus: string },
      user: UsuarioContext,
    ): Promise<{ projetoId: string; newStatus: string; changed: boolean }>;
  } {
    return app.get<ReturnType<typeof getAdvanceUc>>(ADVANCE_PROJETO_STATUS_USE_CASE);
  }

  // ── Module bootstrap (once per suite) ───────────────────────────────────────

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        ProjBddFakeInfraModule,
        ProjModule,
      ],
    })
      .overrideProvider(PROJECT_EVENT_PUBLISHER)
      .useValue(publishSpy)
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
    app.useGlobalGuards(fakeAuthGuard as Parameters<typeof app.useGlobalGuards>[0]);
    await app.init();

    // Wire Reflector so the guard stub can enforce @RequiredScopes metadata.
    guardState.reflector = moduleRef.get(Reflector);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    projetoStore.clear();
    publishSpy.publish.mockClear();
    advanceError = null;
    guardState.principal = makePrincipal();
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Scenario 1: Import advances a draft project into composition
  // ────────────────────────────────────────────────────────────────────────────

  test('Import advances a draft project into composition', ({ and, given, then, when }) => {
    given('an authenticated editor of empresa "aetos"', () => {
      // guardState.principal is reset to a full-scope aetos editor in beforeEach.
    });

    given('an existing project "proj-1" in status "rascunho"', () => {
      seedProj1('rascunho');
    });

    when('the imp context advances project "proj-1" to "em_composicao"', async () => {
      await getAdvanceUc().advanceTo(
        { projetoId: PROJ_1_UUID, targetStatus: 'em_composicao' },
        fakeUser,
      );
    });

    then('the project status is "em_composicao"', () => {
      expect(projetoStore.get(PROJ_1_UUID)?.status).toBe('em_composicao');
    });

    and(
      'a ProjectStatusChanged event is emitted with statusDe "rascunho" and statusPara "em_composicao"',
      () => {
        expect(publishSpy.publish).toHaveBeenCalledTimes(1);
        const [eventName, payload] = publishSpy.publish.mock.calls[0] as [
          string,
          { statusDe: string; statusPara: string },
        ];
        expect(eventName).toBe('ProjectStatusChanged');
        expect(payload.statusDe).toBe('rascunho');
        expect(payload.statusPara).toBe('em_composicao');
      },
    );
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Scenario 2: Publication marks a composed project as published
  // ────────────────────────────────────────────────────────────────────────────

  test('Publication marks a composed project as published', ({ and, given, then, when }) => {
    given('an authenticated editor of empresa "aetos"', () => {});

    given('an existing project "proj-1" in status "em_composicao"', () => {
      seedProj1('em_composicao');
    });

    when('the pub context advances project "proj-1" to "publicado"', async () => {
      await getAdvanceUc().advanceTo(
        { projetoId: PROJ_1_UUID, targetStatus: 'publicado' },
        fakeUser,
      );
    });

    then('the project status is "publicado"', () => {
      expect(projetoStore.get(PROJ_1_UUID)?.status).toBe('publicado');
    });

    and('a ProjectStatusChanged event is emitted', () => {
      expect(publishSpy.publish).toHaveBeenCalledTimes(1);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Scenario 3: A later failed export flips a published project to error
  // ────────────────────────────────────────────────────────────────────────────

  test('A later failed export flips a published project to error', ({ and, given, then, when }) => {
    given('an authenticated editor of empresa "aetos"', () => {});

    given('an existing project "proj-1" in status "publicado"', () => {
      seedProj1('publicado');
    });

    when('the pub context advances project "proj-1" to "com_erros"', async () => {
      await getAdvanceUc().advanceTo(
        { projetoId: PROJ_1_UUID, targetStatus: 'com_erros' },
        fakeUser,
      );
    });

    then('the project status is "com_erros"', () => {
      expect(projetoStore.get(PROJ_1_UUID)?.status).toBe('com_erros');
    });

    and('a ProjectStatusChanged event is emitted', () => {
      expect(publishSpy.publish).toHaveBeenCalledTimes(1);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Scenario 4: Advancing to the current status is an idempotent no-op
  // ────────────────────────────────────────────────────────────────────────────

  test('Advancing to the current status is an idempotent no-op', ({ and, given, then, when }) => {
    given('an authenticated editor of empresa "aetos"', () => {});

    given('an existing project "proj-1" in status "publicado"', () => {
      seedProj1('publicado');
    });

    when('the pub context advances project "proj-1" to "publicado"', async () => {
      // advanceTo(publicado, publicado) → idempotent no-op (SPEC-05)
      await getAdvanceUc().advanceTo(
        { projetoId: PROJ_1_UUID, targetStatus: 'publicado' },
        fakeUser,
      );
    });

    then('the project status is "publicado"', () => {
      expect(projetoStore.get(PROJ_1_UUID)?.status).toBe('publicado');
    });

    and('no status event is emitted', () => {
      expect(publishSpy.publish).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Scenario 5: Re-confirming an already-composed project never regresses
  // ────────────────────────────────────────────────────────────────────────────

  test('Re-confirming an already-composed project never regresses', ({ and, given, then, when }) => {
    given('an authenticated editor of empresa "aetos"', () => {});

    given('an existing project "proj-1" in status "publicado"', () => {
      seedProj1('publicado');
    });

    when('the imp context advances project "proj-1" to "em_composicao"', async () => {
      // publicado → em_composicao is NOT in the legal advanceTo table.
      // ProjectStatusVO.advanceTo throws IllegalStatusTransitionError.
      // The use case propagates it without touching the store or emitting an event.
      try {
        await getAdvanceUc().advanceTo(
          { projetoId: PROJ_1_UUID, targetStatus: 'em_composicao' },
          fakeUser,
        );
      } catch (err) {
        advanceError = err as Error;
      }
    });

    then('the project status is "publicado"', () => {
      // Error was thrown before any persistence — status must remain publicado.
      expect(projetoStore.get(PROJ_1_UUID)?.status).toBe('publicado');
    });

    and('no status event is emitted', () => {
      expect(publishSpy.publish).not.toHaveBeenCalled();
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Scenario 6: Skipping composition is an illegal transition
  // ────────────────────────────────────────────────────────────────────────────

  test('Skipping composition is an illegal transition', ({ and, given, then, when }) => {
    given('an authenticated editor of empresa "aetos"', () => {});

    given('an existing project "proj-1" in status "rascunho"', () => {
      seedProj1('rascunho');
    });

    when('the pub context advances project "proj-1" to "publicado"', async () => {
      // rascunho → publicado skips em_composicao — illegal (api-contract §7).
      try {
        await getAdvanceUc().advanceTo(
          { projetoId: PROJ_1_UUID, targetStatus: 'publicado' },
          fakeUser,
        );
      } catch (err) {
        advanceError = err as Error;
      }
    });

    then('an IllegalStatusTransition error is raised', () => {
      expect(advanceError).toBeInstanceOf(IllegalStatusTransitionError);
    });

    and('the project status is "rascunho"', () => {
      // updateStatus was never called — store unchanged.
      expect(projetoStore.get(PROJ_1_UUID)?.status).toBe('rascunho');
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Scenario 7: The editor reopens a published project for a new revision
  // ────────────────────────────────────────────────────────────────────────────

  test('The editor reopens a published project for a new revision', ({ and, given, then, when }) => {
    given('an authenticated editor of empresa "aetos"', () => {
      // Full-scope editor in aetos — guard allows proj:write.
    });

    given('an existing project "proj-1" in status "publicado"', () => {
      seedProj1('publicado');
    });

    when('the editor reopens project "proj-1"', async () => {
      response = await request(app.getHttpServer())
        .post(`/api/v1/proj/projetos/${PROJ_1_UUID}/reopen`);
    });

    then('the response status is 200', () => {
      expectStatus(response, 200);
    });

    and('the project status is "em_composicao"', () => {
      expect(projetoStore.get(PROJ_1_UUID)?.status).toBe('em_composicao');
    });

    and('a ProjectStatusChanged event is emitted', () => {
      expect(publishSpy.publish).toHaveBeenCalledTimes(1);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Scenario 8: Reopening a draft is rejected
  // ────────────────────────────────────────────────────────────────────────────

  test('Reopening a draft is rejected', ({ given, then, when }) => {
    given('an authenticated editor of empresa "aetos"', () => {});

    given('an existing project "proj-1" in status "rascunho"', () => {
      seedProj1('rascunho');
    });

    when('the editor reopens project "proj-1"', async () => {
      // ReopenProjectForRevisionUseCase.reopen throws IllegalStatusTransitionError for rascunho.
      // ProjController.reopenProjeto catches it and converts to ConflictException (409).
      response = await request(app.getHttpServer())
        .post(`/api/v1/proj/projetos/${PROJ_1_UUID}/reopen`);
    });

    then('the response status is 409', () => {
      expectStatus(response, 409);
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Scenario 9: The legal-transition table is enforced (Scenario Outline — 6 rows)
  // ────────────────────────────────────────────────────────────────────────────
  //
  // Outcomes:
  //   applied  → advanceTo succeeds, changed=true
  //   rejected → advanceTo throws IllegalStatusTransitionError
  //   noop     → advanceTo succeeds, changed=false (idempotent, same status)

  test('The legal-transition table is enforced', ({ given, then, when }) => {
    let tableError: Error | null = null;
    let tableResult: { changed: boolean } | null = null;

    given('an authenticated editor of empresa "aetos"', () => {});

    given(/^an existing project "proj-1" in status "(.*)"$/, (fromStatus: string) => {
      seedProj1(fromStatus as ProjetoStatusLiteral);
    });

    when(/^the (.*) advances project "proj-1" to "(.*)"$/, async (_context: string, to: string) => {
      try {
        tableResult = await getAdvanceUc().advanceTo(
          { projetoId: PROJ_1_UUID, targetStatus: to },
          fakeUser,
        );
        tableError = null;
      } catch (err) {
        tableError = err as Error;
        tableResult = null;
      }
    });

    then(/^the transition outcome is "(.*)"$/, (outcome: string) => {
      switch (outcome) {
        case 'applied':
          expect(tableError).toBeNull();
          expect(tableResult?.changed).toBe(true);
          break;
        case 'rejected':
          expect(tableError).toBeInstanceOf(IllegalStatusTransitionError);
          break;
        case 'noop':
          expect(tableError).toBeNull();
          expect(tableResult?.changed).toBe(false);
          break;
        default:
          throw new Error(`Unknown transition outcome in Scenario Outline: "${outcome}"`);
      }
    });
  });

  // ────────────────────────────────────────────────────────────────────────────
  // Scenario 10: Reopening a project with export errors also opens it for revision
  // ────────────────────────────────────────────────────────────────────────────

  test('Reopening a project with export errors also opens it for revision', ({
    and,
    given,
    then,
    when,
  }) => {
    given('an authenticated editor of empresa "aetos"', () => {});

    given('an existing project "proj-1" in status "com_erros"', () => {
      seedProj1('com_erros');
    });

    when('the editor reopens project "proj-1"', async () => {
      // com_erros → em_composicao is the regression arc (SPEC-02 clause 5).
      response = await request(app.getHttpServer())
        .post(`/api/v1/proj/projetos/${PROJ_1_UUID}/reopen`);
    });

    then('the response status is 200', () => {
      expectStatus(response, 200);
    });

    and('the project status is "em_composicao"', () => {
      expect(projetoStore.get(PROJ_1_UUID)?.status).toBe('em_composicao');
    });

    and('a ProjectStatusChanged event is emitted', () => {
      expect(publishSpy.publish).toHaveBeenCalledTimes(1);
    });
  });
});
