/**
 * pub-projeto.guard.spec.ts — Unit tests for pubProjetoGuard (FE-PUB-021 / P5).
 *
 * Verifies:
 *   - Well-formed UUID → returns true (no HTTP call)
 *   - UUID uppercase → accepted (case-insensitive)
 *   - Malformed UUID → redirects to /proj/biblioteca-de-projetos (no HTTP)
 *   - Partial / short UUID → redirects (no HTTP)
 *   - Empty projetoId → redirects (no HTTP)
 *   - Null projetoId → redirects (no HTTP)
 */
import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, UrlTree } from '@angular/router';
import { pubProjetoGuard } from './pub-projeto.guard';

const VALID_UUID    = '550e8400-e29b-41d4-a716-446655440000';
const VALID_UUID_UC = '550E8400-E29B-41D4-A716-446655440000';
const INVALID_UUID  = 'not-a-uuid';
const SHORT_UUID    = '1234-5678-abcd';

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

function urlTreeToString(tree: UrlTree): string {
  return tree.toString();
}

describe('pubProjetoGuard', () => {
  let createUrlTreeSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    createUrlTreeSpy = vi.fn((commands: string[]) =>
      ({ toString: () => commands.join('/') } as unknown as UrlTree),
    );

    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { createUrlTree: createUrlTreeSpy } }],
    });
  });

  it('should return true for a well-formed UUID', () => {
    const result = TestBed.runInInjectionContext(() =>
      pubProjetoGuard(makeRoute(VALID_UUID), {} as never),
    );
    expect(result).toBe(true);
    expect(createUrlTreeSpy).not.toHaveBeenCalled();
  });

  it('should return true for a UUID in uppercase (case-insensitive)', () => {
    const result = TestBed.runInInjectionContext(() =>
      pubProjetoGuard(makeRoute(VALID_UUID_UC), {} as never),
    );
    expect(result).toBe(true);
    expect(createUrlTreeSpy).not.toHaveBeenCalled();
  });

  it('should redirect for a malformed UUID', () => {
    const result = TestBed.runInInjectionContext(() =>
      pubProjetoGuard(makeRoute(INVALID_UUID), {} as never),
    ) as UrlTree;

    expect(createUrlTreeSpy).toHaveBeenCalledWith(['/proj/biblioteca-de-projetos']);
    expect(urlTreeToString(result)).toContain('biblioteca-de-projetos');
  });

  it('should redirect for a short/partial UUID', () => {
    const result = TestBed.runInInjectionContext(() =>
      pubProjetoGuard(makeRoute(SHORT_UUID), {} as never),
    ) as UrlTree;

    expect(createUrlTreeSpy).toHaveBeenCalledWith(['/proj/biblioteca-de-projetos']);
    expect(urlTreeToString(result)).toContain('biblioteca-de-projetos');
  });

  it('should redirect for an empty projetoId (no HTTP)', () => {
    TestBed.runInInjectionContext(() =>
      pubProjetoGuard(makeRoute(''), {} as never),
    );
    expect(createUrlTreeSpy).toHaveBeenCalledWith(['/proj/biblioteca-de-projetos']);
  });

  it('should redirect when projetoId param is null (no HTTP)', () => {
    TestBed.runInInjectionContext(() =>
      pubProjetoGuard(makeRoute(null), {} as never),
    );
    expect(createUrlTreeSpy).toHaveBeenCalledWith(['/proj/biblioteca-de-projetos']);
  });
});
