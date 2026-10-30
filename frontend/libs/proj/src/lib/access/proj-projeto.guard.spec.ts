/**
 * proj-projeto.guard.spec.ts — unit tests for projProjetoGuard.
 * FE-PROJ-017 (P1): UUID format validation + redirect behaviour.
 *
 * Tests:
 *   - Well-formed UUID → returns true (no HTTP)
 *   - Malformed UUID → redirects to /proj/biblioteca-de-projetos (no HTTP)
 *   - Null projetoId → redirects to /proj/biblioteca-de-projetos (no HTTP)
 *   - UUID uppercase → accepted (case-insensitive)
 */
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { describe, expect, it, beforeEach } from 'vitest';
import { projProjetoGuard } from './proj-projeto.guard';

// ── Test fixtures ─────────────────────────────────────────────────────────────

/** Valid RFC 4122 UUID (from plan §1c) */
const VALID_UUID     = '123e4567-e89b-12d3-a456-426614174000';
/** Same UUID in uppercase — guard must accept (case-insensitive) */
const VALID_UUID_UC  = '123E4567-E89B-12D3-A456-426614174000';
/** Clearly malformed — as named in the plan */
const MALFORMED_UUID = 'nao-uuid';
/** Looks UUID-like but has wrong group lengths */
const SHORT_UUID     = '1234-5678-abcd';

function makeRoute(projetoId: string | null): ActivatedRouteSnapshot {
  return {
    paramMap: {
      get: (key: string) => (key === 'projetoId' ? projetoId : null),
      has: (_key: string) => false,
      getAll: (_key: string) => [],
      keys: [],
    },
  } as unknown as ActivatedRouteSnapshot;
}

// ── Specs ─────────────────────────────────────────────────────────────────────

describe('projProjetoGuard', () => {
  let mockRouter: { createUrlTree: (c: unknown[]) => UrlTree };

  beforeEach(() => {
    // Mock router.createUrlTree so we can inspect the redirect target
    mockRouter = {
      createUrlTree: (commands: unknown[]) =>
        ({ toString: () => (commands as string[]).join('/') } as UrlTree),
    };

    TestBed.configureTestingModule({
      providers: [
        { provide: Router, useValue: mockRouter },
      ],
    });
  });

  it('UUID válido → retorna true (sem redirect, sem HTTP)', () => {
    const route = makeRoute(VALID_UUID);
    const result = TestBed.runInInjectionContext(() =>
      projProjetoGuard(route, {} as never),
    );
    expect(result).toBe(true);
  });

  it('UUID em maiúsculas → aceito (regex case-insensitive)', () => {
    const route = makeRoute(VALID_UUID_UC);
    const result = TestBed.runInInjectionContext(() =>
      projProjetoGuard(route, {} as never),
    );
    expect(result).toBe(true);
  });

  it('UUID malformado → redireciona para /proj/biblioteca-de-projetos sem HTTP', () => {
    const route = makeRoute(MALFORMED_UUID);
    const result = TestBed.runInInjectionContext(() =>
      projProjetoGuard(route, {} as never),
    ) as UrlTree;
    expect(result.toString()).toContain('biblioteca-de-projetos');
  });

  it('UUID curto/parcial → redireciona para /proj/biblioteca-de-projetos', () => {
    const route = makeRoute(SHORT_UUID);
    const result = TestBed.runInInjectionContext(() =>
      projProjetoGuard(route, {} as never),
    ) as UrlTree;
    expect(result.toString()).toContain('biblioteca-de-projetos');
  });

  it('projetoId nulo → redireciona para /proj/biblioteca-de-projetos sem HTTP', () => {
    const route = makeRoute(null);
    const result = TestBed.runInInjectionContext(() =>
      projProjetoGuard(route, {} as never),
    ) as UrlTree;
    expect(result.toString()).toContain('biblioteca-de-projetos');
  });

  it('projetoId vazio → redireciona para /proj/biblioteca-de-projetos', () => {
    const route = makeRoute('');
    const result = TestBed.runInInjectionContext(() =>
      projProjetoGuard(route, {} as never),
    ) as UrlTree;
    expect(result.toString()).toContain('biblioteca-de-projetos');
  });
});
