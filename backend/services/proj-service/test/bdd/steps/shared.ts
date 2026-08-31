/**
 * Pure, stateless helpers shared by PROJ BDD suites (test/bdd/*.steps.ts).
 *
 * Each `*.steps.ts` file builds its own NestJS `TestingModule`, in-memory
 * fakes and guard state locally — mirroring imp-service's BDD suites
 * (test/bdd/manuscript-immutability-and-tenancy.steps.ts), where every file
 * is fully self-contained. Nothing here holds mutable per-scenario state
 * (no `app`, no captured `response`): sharing that across files that run in
 * separate jest-cucumber processes/files would not work, and coupling
 * unrelated suites to one shared app instance would make them fragile.
 *
 * What IS safe to share: pure constants and pure data builders. Each suite
 * imports what it needs from here and keeps its own local closures (guard
 * state, response capture, fake repositories) private to that file.
 */

import type { Response } from 'supertest';
import type { ProjetoStatus } from '../../../src/domain/proj/value-objects/project-status.vo';
import { ProjetoStatus as ProjetoStatusEnum } from '../../../src/domain/proj/value-objects/project-status.vo';

// ── Empresa / scope constants ──────────────────────────────────────────────

export const EMPRESA_AETOS = 'aetos';
export const EMPRESA_OUTRA = 'outra';

export const SCOPE_READ = 'proj:read';
export const SCOPE_WRITE = 'proj:write';
export const SCOPE_DELETE = 'proj:delete';

// ── Request principal (shape produced by JwtStrategy.validate, consumed by
//    CurrentUser via req.user — see infrastructure/auth/jwt-auth.guard.ts) ──

export interface FakeRequestPrincipal {
  readonly userId: string;
  readonly username: string;
  readonly roles: string[];
  readonly scopes: string[];
  readonly empresaId: string;
}

/**
 * Builds a fake authenticated principal for `req.user`, with sane defaults
 * for "an authenticated editor of empresa aetos" (full proj:* scopes).
 * Override `scopes`/`empresaId`/`roles` per scenario as needed.
 */
export function makePrincipal(
  overrides: Partial<FakeRequestPrincipal> = {},
): FakeRequestPrincipal {
  return {
    userId: overrides.userId ?? '00000000-0000-0000-0000-0000000000e1',
    username: overrides.username ?? 'bdd-editor',
    roles: overrides.roles ?? ['editor'],
    scopes: overrides.scopes ?? [SCOPE_READ, SCOPE_WRITE, SCOPE_DELETE],
    empresaId: overrides.empresaId ?? EMPRESA_AETOS,
  };
}

// ── ProjetoEditorialData builder (matches domain/proj/projeto-editorial.repository.ts) ──

export type ProjetoStatusLiteral = 'rascunho' | 'em_composicao' | 'publicado' | 'com_erros';

export interface FakeProjetoEditorialData {
  readonly id: string;
  readonly nome: string;
  readonly descricao?: string | null;
  readonly editoraId: string;
  readonly status: ProjetoStatus;
  readonly criadoEm: Date;
  readonly atualizadoEm: Date;
}

let projetoSeq = 0;

/**
 * Builds a fake ProjetoEditorialData row for pre-seeding an in-memory
 * repository. `id` defaults to a stable-but-unique UUID-shaped string so
 * assertions on distinct ids across calls remain reliable within one file.
 */
export function makeProjetoEditorialData(
  overrides: Partial<FakeProjetoEditorialData> = {},
): FakeProjetoEditorialData {
  projetoSeq += 1;
  const seqHex = projetoSeq.toString(16).padStart(2, '0');
  const now = new Date('2026-08-20T10:00:00.000Z');
  return {
    id: overrides.id ?? `aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee${seqHex}00`,
    nome: overrides.nome ?? 'Projeto de Teste',
    descricao: overrides.descricao ?? null,
    editoraId: overrides.editoraId ?? EMPRESA_AETOS,
    status: overrides.status ?? ProjetoStatusEnum.rascunho,
    criadoEm: overrides.criadoEm ?? now,
    atualizadoEm: overrides.atualizadoEm ?? now,
  };
}

// ── Assertion helpers ────────────────────────────────────────────────────

/** Asserts the supertest response has the given HTTP status code. */
export function expectStatus(response: Response, status: number): void {
  expect(response.status).toBe(status);
}
