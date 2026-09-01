/**
 * imp-projeto.guard.spec.ts — unit tests for impProjetoGuard (FE-IMP-019).
 *
 * Criteria:
 *   - UUID v4 valid  → returns true
 *   - empty string   → returns UrlTree (/projetos)
 *   - random string  → returns UrlTree (/projetos)
 *   - UUID v3        → returns UrlTree (/projetos)
 *   - UUID v5        → returns UrlTree (/projetos)
 */
import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  UrlTree,
  provideRouter,
} from '@angular/router';
import { impProjetoGuard } from './imp-projeto.guard';

/** Build a minimal ActivatedRouteSnapshot with a single paramMap entry. */
function makeRoute(projetoId: string): ActivatedRouteSnapshot {
  return {
    paramMap: {
      get: (key: string) => (key === 'projetoId' ? projetoId : null),
    },
  } as unknown as ActivatedRouteSnapshot;
}

/** Execute the guard inside an injection context. */
function runGuard(projetoId: string): ReturnType<typeof impProjetoGuard> {
  return TestBed.runInInjectionContext(() =>
    impProjetoGuard(makeRoute(projetoId), {} as RouterStateSnapshot),
  );
}

describe('impProjetoGuard', () => {
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
    router = TestBed.inject(Router);
  });

  it('returns true for a valid UUID v4', () => {
    // Valid UUID v4: version nibble = 4, variant nibble = a (in [89ab])
    const result = runGuard('550e8400-e29b-41d4-a716-446655440000');
    expect(result).toBe(true);
  });

  it('returns true for another valid UUID v4 (uppercase)', () => {
    const result = runGuard('A987FBC9-4BED-4078-8F07-9141BA07C9F3');
    expect(result).toBe(true);
  });

  it('redirects to /projetos for an empty string', () => {
    const result = runGuard('');
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/projetos');
  });

  it('redirects to /projetos for a random non-UUID string', () => {
    const result = runGuard('not-a-uuid');
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/projetos');
  });

  it('redirects to /projetos for a UUID v3 (version nibble = 3)', () => {
    // UUID v3: version digit is 3 — fails the 4[0-9a-f]{3} check
    const result = runGuard('550e8400-e29b-31d4-a716-446655440000');
    expect(result).toBeInstanceOf(UrlTree);
  });

  it('redirects to /projetos for a UUID v5 (version nibble = 5)', () => {
    // UUID v5: version digit is 5 — fails the 4[0-9a-f]{3} check
    const result = runGuard('550e8400-e29b-51d4-a716-446655440000');
    expect(result).toBeInstanceOf(UrlTree);
  });

  it('redirects to /projetos when projetoId has wrong variant nibble', () => {
    // Variant nibble must be [89ab]; 'c' is outside that range
    const result = runGuard('550e8400-e29b-41d4-c716-446655440000');
    expect(result).toBeInstanceOf(UrlTree);
  });
});
