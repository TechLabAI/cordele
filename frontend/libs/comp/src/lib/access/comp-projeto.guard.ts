/**
 * comp-projeto.guard.ts — Guards that :projetoId is a well-formed UUID before
 * activating any COMP route. Full implementation for FE-COMP-019 (P5).
 *
 * Strategy (SPEC-01 §3 / SPEC-07 §1):
 *   1. Extract projetoId from ActivatedRouteSnapshot.params.
 *   2. Validate UUID format (regex). If malformed → redirect to /projetos/nao-encontrado
 *      without making any HTTP call (pre-empts urn:cordele:comp:projeto-not-found 404).
 *   3. If UUID is well-formed → return true. The BE (comp-service) handles 404 for
 *      non-existent projects; compStatusGuard handles the status check via proj-service.
 *
 * Non-goals:
 *   - Does NOT call comp-service (FE-COMP-019 requirement).
 *   - Does NOT verify status (responsibility of compStatusGuard, FE-COMP-020 / INT-FE-COMP-003).
 *
 * Degradation: If projetoId is absent → redirect. UUID-only validation is intentional MVP
 * simplification (SPEC-07 §1 risk note: no ProjetoStore export from scope:proj in MVP).
 *
 * Track D: implemented in FE-COMP-019 (P5). Stub from P4 replaced.
 */
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';

/**
 * Matches any RFC 4122 UUID (v1–v5) in lowercase or uppercase.
 * Pattern: 8-4-4-4-12 hex groups separated by hyphens.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * compProjetoGuard — validates that :projetoId is a well-formed UUID.
 *
 * - UUID malformed or absent → redirect to /projetos/nao-encontrado (no HTTP).
 * - UUID well-formed → return true (compStatusGuard takes over).
 *
 * Registered in COMP_ROUTES (FE-COMP-002) as the 4th guard in the COMP_GUARDS chain,
 * running after authGuard / empresaGuard / accessGuard and before compStatusGuard.
 */
export const compProjetoGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const router    = inject(Router);
  const projetoId = route.paramMap.get('projetoId') ?? '';

  if (!projetoId || !UUID_REGEX.test(projetoId)) {
    // D-H: pre-empt projeto-not-found without HTTP round-trip to comp-service
    return router.createUrlTree(['/projetos', 'nao-encontrado']);
  }

  return true;
};
