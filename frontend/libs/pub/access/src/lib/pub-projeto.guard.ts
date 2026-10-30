/**
 * pub-projeto.guard.ts — Guards that :projetoId is a well-formed UUID before
 * activating any PUB route. Full implementation for FE-PUB-021 (P5).
 *
 * Strategy (SPEC-01 §3):
 *   1. Extract projetoId from ActivatedRouteSnapshot.params.
 *   2. Validate UUID format (regex). If malformed or absent → redirect to
 *      /proj/biblioteca-de-projetos without making any HTTP call.
 *   3. If UUID is well-formed → return true. The BE (pub-service) handles 404 for
 *      non-existent projects; pubStatusGuard handles the status check via proj-service.
 *
 * Non-goals:
 *   - Does NOT call pub-service or proj-service (FE-PUB-021 requirement: client-side UUID check only).
 *   - Does NOT verify project status (responsibility of pubStatusGuard, FE-PUB-022).
 *
 * Track D: FE-PUB-021 (P5) — real implementation replacing P1 stub from @cordele/pub flat lib.
 */
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';

/**
 * Matches any RFC 4122 UUID (v1–v5) in lowercase or uppercase.
 * Pattern: 8-4-4-4-12 hex groups separated by hyphens.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * pubProjetoGuard — validates that :projetoId is a well-formed UUID.
 *
 * - UUID malformed or absent → redirect to /proj/biblioteca-de-projetos (no HTTP).
 * - UUID well-formed → return true (pubStatusGuard takes over for export mode).
 *
 * Registered in PUB_ROUTES (pub-shell-entry) as the 4th guard in the chain,
 * running after authGuard / empresaGuard / accessGuard and before pubStatusGuard.
 */
export const pubProjetoGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const router    = inject(Router);
  const projetoId = route.paramMap.get('projetoId') ?? '';

  if (!projetoId || !UUID_REGEX.test(projetoId)) {
    return router.createUrlTree(['/proj/biblioteca-de-projetos']);
  }

  return true;
};
