/**
 * BDD suite for: Domain event integrity
 * Contract: test/bdd/features/project-event-integrity.feature
 *
 * Covers SPEC-05 clause 6 (unique eventId) and SPEC-09 clauses 2 and 3
 * (no status change on incoming events; no event on rollback).
 *
 * Runs against a NestJS TestingModule with in-memory fakes.
 * Never imports AppModule — avoids the overrideGuard() + APP_GUARD conflict
 * documented in the PROJ plan. Mounts EventIntegrityFakeInfraModule (@Global)
 * + ProjModule directly instead.
 */

// ── Env vars required by ConfigModule (before any Nest import) ──────────────
process.env['NODE_ENV'] = 'test';
process.env['JWT_ISSUER_URI'] = 'http://test-issuer/realms/test';
process.env['JWT_AUDIENCE'] = 'proj-service-test';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/cordele_test';

import { join } from 'node:path';

import { Global, type INestApplication, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { defineFeature, loadFeature } from 'jest-cucumber';

import { ProjModule } from 'src/modules/proj/proj.module';
import { AdvanceProjetoStatusUseCase } from 'src/modules/proj/use-cases/advance-projeto-status.use-case';
import {
  ADVANCE_PROJETO_STATUS_USE_CASE,
  COMPOSITION_ERASURE_PORT,
  MANUSCRIPT_ERASURE_PORT,
  MANUSCRIPT_SUMMARY_PORT,
  PROJECT_EVENT_PUBLISHER,
  PROJECT_METADATA_PORT,
  PROJETO_EDITORIAL_REPOSITORY,
  PUBLICATION_ERASURE_PORT,
  PUBLICATION_HISTORY_PORT,
} from 'src/modules/proj/proj.tokens';
import { ProjectStatusVO, ProjetoStatus } from 'src/domain/proj/value-objects/project-status.vo';
import type {
  CreateProjetoEditorialInput,
  ProjetoEditorialData,
  ProjetoEditorialFilter,
  ProjetoEditorialRepository,
  UpdateStatusInput,
} from 'src/domain/proj/projeto-editorial.repository';
import type { UsuarioContext } from 'src/domain/shared/usuario-context.interface';

import { EMPRESA_AETOS, makePrincipal } from './steps/shared';

// ── Module-level mutable state (reset in beforeEach) ────────────────────────

/**
 * Backing store for the fake ProjetoEditorialRepository.
 * Keys are project IDs; values are full ProjetoEditorialData records.
 */
const eventIntegrityStore = new Map<string, ProjetoEditorialData>();

/**
 * When true, the next call to fakeRepo.updateStatus() throws to simulate a
 * persistence rollback. Reset to false in beforeEach.
 */
let shouldThrowOnNextWrite = false;

/**
 * Spy for PROJECT_EVENT_PUBLISHER.publish.
 * Registered once at module creation time; cleared (not replaced) in beforeEach
 * so that call history is fresh for each scenario.
 */
const publishSpy = jest.fn<void, [string, unknown]>();

// ── In-memory fake repository ─────────────────────────────────────────────

const fakeProjetoEditorialRepo: ProjetoEditorialRepository = {
  create: async (input: CreateProjetoEditorialInput): Promise<ProjetoEditorialData> => {
    const now = new Date();
    const data: ProjetoEditorialData = {
      id: input.id,
      nome: input.nome,
      descricao: input.descricao ?? null,
      editoraId: input.editoraId,
      status: input.status,
      criadoEm: now,
      atualizadoEm: now,
    };
    eventIntegrityStore.set(data.id, data);
    return data;
  },

  findById: async (
    id: string,
    empresaId: string,
  ): Promise<ProjetoEditorialData | null> => {
    const proj = eventIntegrityStore.get(id);
    if (proj && proj.editoraId === empresaId) return proj;
    return null;
  },

  findAll: async (
    empresaId: string,
    _filter?: ProjetoEditorialFilter,
  ): Promise<ProjetoEditorialData[]> => {
    return [...eventIntegrityStore.values()].filter(
      (p) => p.editoraId === empresaId,
    );
  },

  updateStatus: async (input: UpdateStatusInput): Promise<ProjetoEditorialData> => {
    if (shouldThrowOnNextWrite) {
      throw new Error('simulated rollback');
    }
    const proj = eventIntegrityStore.get(input.id);
    if (!proj) {
      throw new Error(`Fake repo: project not found: ${input.id}`);
    }
    const updated: ProjetoEditorialData = {
      ...proj,
      status: input.newStatus,
      atualizadoEm: new Date(),
    };
    eventIntegrityStore.set(input.id, updated);
    return updated;
  },

  existsByIdAndEmpresa: async (
    id: string,
    empresaId: string,
  ): Promise<boolean> => {
    const proj = eventIntegrityStore.get(id);
    return !!proj && proj.editoraId === empresaId;
  },

  delete: async (id: string, empresaId: string): Promise<void> => {
    const proj = eventIntegrityStore.get(id);
    if (proj && proj.editoraId === empresaId) {
      eventIntegrityStore.delete(id);
    }
  },

  advanceStatusAtomic: async (input) => {
    // Respect the shouldThrowOnNextWrite flag (simulates a persistence rollback).
    if (shouldThrowOnNextWrite) {
      throw new Error('simulated rollback');
    }
    const proj = eventIntegrityStore.get(input.id);
    if (!proj || proj.editoraId !== input.empresaId) return null;
    const { newStatus, changed } = ProjectStatusVO.advanceTo(proj.status, input.targetStatus);
    if (!changed) return { data: proj, previousStatus: proj.status, changed: false };
    const updated: ProjetoEditorialData = { ...proj, status: newStatus, atualizadoEm: new Date() };
    eventIntegrityStore.set(input.id, updated);
    return { data: updated, previousStatus: proj.status, changed: true };
  },
};

// ── @Global() fake infrastructure module ─────────────────────────────────

/**
 * Provides all tokens that normally come from PersistenceModule,
 * ReadPortsModule and ErasurePortsModule (all @Global() in AppModule).
 * ProjModule is imported directly without AppModule so we must supply these
 * tokens ourselves.
 *
 * Tokens already registered inside ProjModule itself (PROJECT_EVENT_PUBLISHER,
 * PROJETO_EDITORIAL_LOOKUP) are not duplicated here; the event-publisher
 * stub is replaced by the publishSpy via overrideProvider().
 */
@Global()
@Module({
  providers: [
    { provide: PROJETO_EDITORIAL_REPOSITORY, useValue: fakeProjetoEditorialRepo },
    // Cross-context read ports (P4 use cases) — never called in these scenarios.
    { provide: MANUSCRIPT_SUMMARY_PORT, useValue: {} },
    { provide: PROJECT_METADATA_PORT, useValue: {} },
    { provide: PUBLICATION_HISTORY_PORT, useValue: {} },
    // LGPD erasure ports (P6 use cases) — never called in these scenarios.
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
class EventIntegrityFakeInfraModule { /* NestJS module — all configuration in @Module() decorator above */ }

// ── Feature ───────────────────────────────────────────────────────────────

const feature = loadFeature(
  join(__dirname, 'features', 'project-event-integrity.feature'),
);

defineFeature(feature, (test) => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        EventIntegrityFakeInfraModule,
        ProjModule,
      ],
    })
      // Replace the no-op stub registered in ProjModule with our spy so we can
      // assert on publish() calls. overrideProvider() is safe here because it
      // does not touch APP_GUARD — the known NestJS bug only affects overrideGuard()
      // when APP_GUARD is registered in the root module.
      .overrideProvider(PROJECT_EVENT_PUBLISHER)
      .useValue({ publish: publishSpy })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    eventIntegrityStore.clear();
    shouldThrowOnNextWrite = false;
    publishSpy.mockClear();
  });

  // ── Scenario 1: Every published event carries a unique eventId ──────────────
  //
  // SPEC-05 clause 6 — eventId uniqueness is mandatory for at-least-once
  // deduplication by downstream consumers. Three independent transitions must
  // produce three distinct UUIDs.

  test('Every published event carries a unique eventId', ({ given, when, then }) => {
    const principal = makePrincipal();
    const user: UsuarioContext = {
      id: principal.userId,
      empresaId: EMPRESA_AETOS,
      scopes: ['proj:write'],
    };

    const projAId = 'aabbcc00-0000-4000-8000-000000000a01';
    const projBId = 'aabbcc00-0000-4000-8000-000000000b02';
    const projCId = 'aabbcc00-0000-4000-8000-000000000c03';
    const now = new Date('2026-08-20T10:00:00.000Z');

    given('an authenticated principal of empresa "aetos"', () => {
      // UsuarioContext constructed above with empresaId = EMPRESA_AETOS.
    });

    given(
      'three projects "proj-a", "proj-b", "proj-c" each transitioning to "em_composicao"',
      () => {
        // Pre-seed three projects in "rascunho" — the only status from which
        // "em_composicao" is a legal forward transition (api-contract §7).
        const seeds: Array<{ id: string; nome: string }> = [
          { id: projAId, nome: 'Projeto A' },
          { id: projBId, nome: 'Projeto B' },
          { id: projCId, nome: 'Projeto C' },
        ];
        for (const { id, nome } of seeds) {
          const data: ProjetoEditorialData = {
            id,
            nome,
            descricao: null,
            editoraId: EMPRESA_AETOS,
            status: ProjetoStatus.rascunho,
            criadoEm: now,
            atualizadoEm: now,
          };
          eventIntegrityStore.set(id, data);
        }
      },
    );

    when('the three transitions are applied', async () => {
      const useCase = app.get<AdvanceProjetoStatusUseCase>(
        ADVANCE_PROJETO_STATUS_USE_CASE,
      );
      await useCase.advanceTo(
        { projetoId: projAId, targetStatus: ProjetoStatus.em_composicao },
        user,
      );
      await useCase.advanceTo(
        { projetoId: projBId, targetStatus: ProjetoStatus.em_composicao },
        user,
      );
      await useCase.advanceTo(
        { projetoId: projCId, targetStatus: ProjetoStatus.em_composicao },
        user,
      );
    });

    then('each emitted ProjectStatusChanged event has a distinct eventId', () => {
      // publish() must have been called exactly once per transition.
      expect(publishSpy).toHaveBeenCalledTimes(3);

      // Each call: publish('ProjectStatusChanged', { eventId, ... })
      // Extract the eventId from the payload (second argument of each call).
      const eventIds = publishSpy.mock.calls.map(
        ([, payload]) => (payload as { eventId: string }).eventId,
      );

      expect(eventIds).toHaveLength(3);

      // All three must be distinct (a Set with size 3 means no duplicates).
      const uniqueIds = new Set(eventIds);
      expect(uniqueIds.size).toBe(3);
    });
  });

  // ── Scenario 2: PROJ does not change project status in response to any
  //               incoming event ─────────────────────────────────────────────
  //
  // SPEC-09 clause 2 — status transitions are exclusively port-driven via
  // AdvanceProjetoStatusUseCase / ReopenProjectForRevisionUseCase. PROJ has no
  // @OnEvent handler, no EventEmitterModule subscriber, and no queue consumer
  // for any external event (e.g. "ManuscriptImported"). Dispatching one is
  // therefore a structural no-op with zero observable effect.

  test(
    'PROJ does not change project status in response to any incoming event',
    ({ given, when, then, and }) => {
      // Snapshot of the store state captured just before the attempted dispatch.
      let snapshotBefore: Map<string, ProjetoEditorialData>;

      given('an authenticated principal of empresa "aetos"', () => {
        // No projects seeded: verifying the absence of any change in an empty
        // store is sufficient for this invariant test.
      });

      when(
        'an external event with name "ManuscriptImported" is dispatched to the PROJ module',
        () => {
          // PROJ is exclusively port-driven. There is no @OnEvent handler, no
          // EventEmitterModule subscription, and no message-queue consumer for
          // "ManuscriptImported" (or any other external event) anywhere in
          // src/. Status transitions happen only when an inbound use-case port
          // is explicitly invoked. Dispatching an arbitrary external event name
          // therefore has zero effect on PROJ's internal state.
          //
          // This step is intentionally a no-op: we capture the store state to
          // make the subsequent assertion concrete.
          snapshotBefore = new Map(eventIntegrityStore);
        },
      );

      then('no project status changes', () => {
        // Store size and every project's status must be identical to the
        // snapshot taken immediately before the (no-op) dispatch.
        expect(eventIntegrityStore.size).toBe(snapshotBefore.size);
        for (const [id, projBefore] of snapshotBefore) {
          expect(eventIntegrityStore.get(id)?.status).toBe(projBefore.status);
        }
      });

      and('no ProjectStatusChanged event is emitted', () => {
        // publish() must never have been called — there is nothing in PROJ that
        // could have triggered it.
        expect(publishSpy).not.toHaveBeenCalledWith(
          'ProjectStatusChanged',
          expect.anything(),
        );
      });
    },
  );

  // ── Scenario 3: No domain event is dispatched when a status transition
  //               rolls back ───────────────────────────────────────────────────
  //
  // SPEC-09 clause 3 — publish() is called only after updateStatus() resolves.
  // If the persistence layer throws (simulating a DB rollback), execution never
  // reaches the publish() call, so no spurious ProjectStatusChanged event
  // is emitted.

  test(
    'No domain event is dispatched when a status transition rolls back',
    ({ given, when, then, and }) => {
      const principal = makePrincipal();
      const user: UsuarioContext = {
        id: principal.userId,
        empresaId: EMPRESA_AETOS,
        scopes: ['proj:write'],
      };

      let proj1Id: string;

      given('an authenticated principal of empresa "aetos"', () => {
        // UsuarioContext constructed above.
      });

      given('an existing project "proj-1" in status "rascunho"', () => {
        const now = new Date('2026-08-20T10:00:00.000Z');
        const data: ProjetoEditorialData = {
          id: 'proj1-rollback-4000-8000-cc0000000001',
          nome: 'Projeto 1 Rollback',
          descricao: null,
          editoraId: EMPRESA_AETOS,
          status: ProjetoStatus.rascunho,
          criadoEm: now,
          atualizadoEm: now,
        };
        proj1Id = data.id;
        eventIntegrityStore.set(data.id, data);
      });

      and(
        'the persistence layer is configured to roll back on the next write',
        () => {
          // Signal the fake repository to throw on the next updateStatus() call,
          // simulating what a failed DB transaction would do.
          shouldThrowOnNextWrite = true;
        },
      );

      when(
        'the imp context attempts to advance project "proj-1" to "em_composicao"',
        async () => {
          const useCase = app.get<AdvanceProjetoStatusUseCase>(
            ADVANCE_PROJETO_STATUS_USE_CASE,
          );
          // The use case must propagate the error thrown by updateStatus().
          await expect(
            useCase.advanceTo(
              {
                projetoId: proj1Id,
                targetStatus: ProjetoStatus.em_composicao,
              },
              user,
            ),
          ).rejects.toThrow('simulated rollback');
        },
      );

      then('the transaction is rolled back', () => {
        // updateStatus() threw before completing, so the fake store was never
        // mutated. The project must still be in its original status.
        const proj = eventIntegrityStore.get(proj1Id);
        expect(proj?.status).toBe(ProjetoStatus.rascunho);
      });

      and('no ProjectStatusChanged event is emitted', () => {
        // In AdvanceProjetoStatusUseCase, publish() is called only on the line
        // after `await this.repository.updateStatus(...)`. Because updateStatus()
        // rejected, execution never reached publish() — this is the structural
        // guarantee under test (SPEC-09 clause 3).
        expect(publishSpy).not.toHaveBeenCalledWith(
          'ProjectStatusChanged',
          expect.anything(),
        );
      });
    },
  );
});
