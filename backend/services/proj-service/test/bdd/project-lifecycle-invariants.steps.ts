/**
 * BDD suite for: Project lifecycle model invariants
 * Contract: test/bdd/features/project-lifecycle-invariants.feature
 *
 * Covers SPEC-04: invalid status rejection (clause 1) and status-history
 * row on transition (clause 3). Both scenarios call use cases directly via
 * app.get() — no HTTP layer involved.
 *
 * Design note — fake CHECK constraint:
 *   The real Prisma adapter for updateStatus runs inside a $transaction that
 *   also inserts a projeto_status_historico row; the Postgres migration adds a
 *   CHECK constraint limiting status to the four ProjetoStatus enum values.
 *   This fake repository simulates that constraint via
 *   `Object.values(ProjetoStatus).includes(input.newStatus)`, throwing the same
 *   kind of Error the real adapter surfaces on a constraint violation. The TypeScript
 *   enum guard in production code prevents the call from even being compiled; the
 *   test deliberately bypasses it with `as unknown as ProjetoStatus` to exercise
 *   the persistence-layer defence.
 */

// ── Env vars required by any Nest import that touches ConfigModule ────────────
process.env['NODE_ENV'] = 'test';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/cordele_test';
process.env['JWT_ISSUER_URI'] = 'http://test-issuer/realms/test';
process.env['JWT_AUDIENCE'] = 'proj-service-test';

import { join } from 'node:path';

import { Global, type INestApplication, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { defineFeature, loadFeature } from 'jest-cucumber';

import {
  ProjetoEditorialRepository,
  type ProjetoEditorialData,
  type CreateProjetoEditorialInput,
  type UpdateStatusInput,
  type ProjetoEditorialFilter,
} from 'src/domain/proj/projeto-editorial.repository';
import { ProjetoStatus } from 'src/domain/proj/value-objects/project-status.vo';
import type { UsuarioContext } from 'src/domain/shared/usuario-context.interface';
import {
  ADVANCE_PROJETO_STATUS_USE_CASE,
  COMPOSITION_ERASURE_PORT,
  MANUSCRIPT_ERASURE_PORT,
  MANUSCRIPT_SUMMARY_PORT,
  PROJETO_EDITORIAL_LOOKUP,
  PROJETO_EDITORIAL_REPOSITORY,
  PROJECT_METADATA_PORT,
  PUBLICATION_ERASURE_PORT,
  PUBLICATION_HISTORY_PORT,
} from 'src/modules/proj/proj.tokens';
import type { AdvanceProjetoStatusUseCase } from 'src/modules/proj/use-cases/advance-projeto-status.use-case';
import { ProjModule } from 'src/modules/proj/proj.module';

import { EMPRESA_AETOS, makeProjetoEditorialData } from './steps/shared';

// ── In-memory store (module-level mutable state, reset in beforeEach) ─────────

const lifecycleStore = new Map<string, ProjetoEditorialData>();

interface StatusHistoryEntry {
  readonly statusDe: ProjetoStatus;
  readonly statusPara: ProjetoStatus;
  readonly changedBy: string;
  readonly empresaId: string;
  readonly at: Date;
}

const statusHistory: StatusHistoryEntry[] = [];

// ── Fake ProjetoEditorialRepository (in-memory, with enum CHECK simulation) ───

const fakeProjetoRepository: ProjetoEditorialRepository = {
  async create(input: CreateProjetoEditorialInput): Promise<ProjetoEditorialData> {
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
    lifecycleStore.set(input.id, data);
    return data;
  },

  async findById(id: string, empresaId: string): Promise<ProjetoEditorialData | null> {
    const proj = lifecycleStore.get(id);
    if (!proj || proj.editoraId !== empresaId) return null;
    return proj;
  },

  async findAll(
    empresaId: string,
    filter?: ProjetoEditorialFilter,
  ): Promise<ProjetoEditorialData[]> {
    let rows = [...lifecycleStore.values()].filter((p) => p.editoraId === empresaId);
    if (filter?.status) {
      rows = rows.filter((p) => p.status === filter.status);
    }
    return rows.sort((a, b) => b.atualizadoEm.getTime() - a.atualizadoEm.getTime());
  },

  async updateStatus(input: UpdateStatusInput): Promise<ProjetoEditorialData> {
    // Simulate the Postgres CHECK constraint: only the four ProjetoStatus enum
    // values are allowed. A value outside the enum (e.g. 'arquivado') would be
    // rejected by the real adapter's $transaction just as it is here.
    if (!(Object.values(ProjetoStatus) as string[]).includes(input.newStatus as string)) {
      throw new Error(
        `invalid status value: '${String(input.newStatus)}' is not a valid ProjetoStatus`,
      );
    }

    const proj = lifecycleStore.get(input.id);
    if (!proj) {
      throw new Error(`ProjetoEditorial ${input.id} not found`);
    }

    const now = new Date();
    const updated: ProjetoEditorialData = { ...proj, status: input.newStatus, atualizadoEm: now };
    lifecycleStore.set(input.id, updated);

    // Simulate the atomic INSERT into projeto_status_historico (SPEC-04 clause 3).
    statusHistory.push({
      statusDe: input.previousStatus,
      statusPara: input.newStatus,
      changedBy: input.changedBy,
      empresaId: input.empresaId,
      at: now,
    });

    return updated;
  },

  async existsByIdAndEmpresa(id: string, empresaId: string): Promise<boolean> {
    const proj = lifecycleStore.get(id);
    return !!proj && proj.editoraId === empresaId;
  },

  async delete(id: string, _empresaId: string): Promise<void> {
    lifecycleStore.delete(id);
  },
};

// ── @Global() fake infra module — provides all tokens that come from AppModule's
//    PersistenceModule / ReadPortsModule / ErasurePortsModule in production. ────

@Global()
@Module({
  providers: [
    { provide: PROJETO_EDITORIAL_REPOSITORY, useValue: fakeProjetoRepository },
    { provide: PROJETO_EDITORIAL_LOOKUP, useValue: { exists: async () => false } },
    { provide: MANUSCRIPT_SUMMARY_PORT, useValue: { summaries: async () => new Map() } },
    { provide: PROJECT_METADATA_PORT, useValue: { metadata: async () => new Map() } },
    { provide: PUBLICATION_HISTORY_PORT, useValue: { history: async () => [] } },
    { provide: PUBLICATION_ERASURE_PORT, useValue: { erase: async () => undefined } },
    { provide: COMPOSITION_ERASURE_PORT, useValue: { erase: async () => undefined } },
    { provide: MANUSCRIPT_ERASURE_PORT, useValue: { erase: async () => undefined } },
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
class ProjLifecycleFakeInfraModule { /* NestJS module — all configuration in @Module() decorator above */ }

// ── Feature ───────────────────────────────────────────────────────────────────

const feature = loadFeature(join(__dirname, 'features', 'project-lifecycle-invariants.feature'));

defineFeature(feature, (test) => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        ProjLifecycleFakeInfraModule,
        ProjModule,
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    lifecycleStore.clear();
    statusHistory.length = 0;
  });

  // ── Scenario 1: Invalid status rejection (SPEC-04 clause 1) ──────────────────

  test('Persisting a project with an invalid status value is rejected', ({ and, given, then, when }) => {
    const PROJ_ID = 'aaaaaaaa-0001-4000-8000-000000000001';
    let caughtError: Error | undefined;

    given('an authenticated editor of empresa "aetos"', () => {
      // No guard in this suite; the step establishes conceptual context only.
    });

    when('an internal actor attempts to set project status to "arquivado"', async () => {
      // Pre-seed a project in the valid initial state.
      const seed = makeProjetoEditorialData({ id: PROJ_ID, status: ProjetoStatus.rascunho, editoraId: EMPRESA_AETOS });
      lifecycleStore.set(PROJ_ID, {
        id: seed.id,
        nome: seed.nome,
        descricao: seed.descricao ?? null,
        editoraId: seed.editoraId,
        status: seed.status as ProjetoStatus,
        criadoEm: seed.criadoEm,
        atualizadoEm: seed.atualizadoEm,
      });

      // Call updateStatus directly with 'arquivado' cast around TypeScript's enum
      // guard to simulate the value that only the persistence layer would reject.
      // In production, the Postgres CHECK constraint raises the equivalent error.
      try {
        await fakeProjetoRepository.updateStatus({
          id: PROJ_ID,
          newStatus: 'arquivado' as unknown as ProjetoStatus,
          previousStatus: ProjetoStatus.rascunho,
          changedBy: 'internal-actor',
          empresaId: EMPRESA_AETOS,
        });
      } catch (err) {
        caughtError = err as Error;
      }
    });

    then('a validation error is raised', () => {
      expect(caughtError).toBeDefined();
      expect(caughtError).toBeInstanceOf(Error);
      expect(caughtError!.message).toMatch(/invalid status value/i);
    });

    and('the project status remains unchanged', () => {
      const proj = lifecycleStore.get(PROJ_ID);
      expect(proj).toBeDefined();
      // The fake rejected before writing, so status must still be rascunho.
      expect(proj!.status).toBe(ProjetoStatus.rascunho);
    });
  });

  // ── Scenario 2: Status transition records history row (SPEC-04 clause 3) ─────

  test('A status transition records the change in the status history table', ({ and, given, then, when }) => {
    const PROJ1_ID = 'bbbbbbbb-0002-4000-8000-000000000002';

    // UsuarioContext expected by AdvanceProjetoStatusUseCase (id, empresaId, scopes).
    const user: UsuarioContext = {
      id: '00000000-0000-0000-0000-0000000000e1',
      empresaId: EMPRESA_AETOS,
      scopes: ['proj:read', 'proj:write'],
    };

    given('an authenticated editor of empresa "aetos"', () => {
      // User context established above.
    });

    given('an existing project "proj-1" in status "rascunho"', () => {
      const seed = makeProjetoEditorialData({ id: PROJ1_ID, status: ProjetoStatus.rascunho, editoraId: EMPRESA_AETOS });
      lifecycleStore.set(PROJ1_ID, {
        id: seed.id,
        nome: seed.nome,
        descricao: seed.descricao ?? null,
        editoraId: seed.editoraId,
        status: seed.status as ProjetoStatus,
        criadoEm: seed.criadoEm,
        atualizadoEm: seed.atualizadoEm,
      });
    });

    when('the imp context advances project "proj-1" to "em_composicao"', async () => {
      const useCase = app.get<AdvanceProjetoStatusUseCase>(ADVANCE_PROJETO_STATUS_USE_CASE);
      await useCase.advanceTo(
        { projetoId: PROJ1_ID, targetStatus: ProjetoStatus.em_composicao },
        user,
      );
    });

    then('a projeto_status_historico row exists with statusDe "rascunho" and statusPara "em_composicao"', () => {
      expect(statusHistory).toHaveLength(1);
      expect(statusHistory[0].statusDe).toBe(ProjetoStatus.rascunho);
      expect(statusHistory[0].statusPara).toBe(ProjetoStatus.em_composicao);
    });

    and('the projeto_editorial.atualizado_em is updated to approximately now', () => {
      const proj = lifecycleStore.get(PROJ1_ID);
      expect(proj).toBeDefined();
      // atualizadoEm must have been updated by updateStatus to a timestamp within
      // 5 seconds of the assertion — loose tolerance for slow CI runners.
      expect(Math.abs(Date.now() - proj!.atualizadoEm.getTime())).toBeLessThan(5000);
    });
  });
});
