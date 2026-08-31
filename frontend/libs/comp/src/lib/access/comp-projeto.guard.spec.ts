/**
 * comp-projeto.guard.spec.ts — unit tests for compProjetoGuard.
 * FE-COMP-019 (P5): UUID format validation + redirect behaviour.
 *
 * Tests:
 *   - Well-formed UUID → returns true (no HTTP)
 *   - Malformed UUID → redirects to /projetos/nao-encontrado (no HTTP)
 *   - Empty projetoId → redirects to /projetos/nao-encontrado (no HTTP)
 *   - UUID uppercase → accepted (case-insensitive)
 */
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { describe, expect, it, beforeEach } from 'vitest';
import { compProjetoGuard } from './comp-projeto.guard';

const VALID_UUID     = 'a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5';
const VALID_UUID_UC  = 'A1B2C3D4-E5F6-4A7B-8C9D-E0F1A2B3C4D5';
const MALFORMED_UUID = 'not-a-uuid';
const SHORT_UUID     = '1234-5678';

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

describe('compProjetoGuard', () => {
  let mockRouter: { createUrlTree: (c: unknown[]) => UrlTree };

  beforeEach(() => {
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

  it('well-formed UUID → returns true (no redirect, no HTTP)', () => {
    const route = makeRoute(VALID_UUID);
    const result = TestBed.runInInjectionContext(() =>
      compProjetoGuard(route, {} as never),
    );
    expect(result).toBe(true);
  });

  it('UUID uppercase → accepted (case-insensitive)', () => {
    const route = makeRoute(VALID_UUID_UC);
    const result = TestBed.runInInjectionContext(() =>
      compProjetoGuard(route, {} as never),
    );
    expect(result).toBe(true);
  });

  it('malformed UUID → redirects to /projetos/nao-encontrado without HTTP', () => {
    const route = makeRoute(MALFORMED_UUID);
    const result = TestBed.runInInjectionContext(() =>
      compProjetoGuard(route, {} as never),
    ) as UrlTree;
    expect(result.toString()).toContain('nao-encontrado');
  });

  it('short/partial UUID → redirects to /projetos/nao-encontrado', () => {
    const route = makeRoute(SHORT_UUID);
    const result = TestBed.runInInjectionContext(() =>
      compProjetoGuard(route, {} as never),
    ) as UrlTree;
    expect(result.toString()).toContain('nao-encontrado');
  });

  it('empty projetoId → redirects to /projetos/nao-encontrado without HTTP', () => {
    const route = makeRoute('');
    const result = TestBed.runInInjectionContext(() =>
      compProjetoGuard(route, {} as never),
    ) as UrlTree;
    expect(result.toString()).toContain('nao-encontrado');
  });

  it('null projetoId → redirects to /projetos/nao-encontrado without HTTP', () => {
    const route = makeRoute(null);
    const result = TestBed.runInInjectionContext(() =>
      compProjetoGuard(route, {} as never),
    ) as UrlTree;
    expect(result.toString()).toContain('nao-encontrado');
  });
});
