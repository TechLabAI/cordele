/**
 * proj-projeto.guard.ts — Guards that :projetoId is a well-formed UUID before
 * activating the T08 (Download e Histórico) route. FE-PROJ-017.
 *
 * Strategy (SPEC-01 §3):
 *   1. Extract projetoId from ActivatedRouteSnapshot.paramMap.
 *   2. Validate UUID format (RFC 4122 regex). If malformed → redirect to
 *      /proj/biblioteca-de-projetos without any HTTP call.
 *   3. If UUID is well-formed → return true. HistoryFacade.load() handles the
 *      404 case by rendering a 'not-found' state (api-contract §4.3).
 *
 * Non-goals:
 *   - Does NOT call proj-service (FE-PROJ-017 requirement — no duplicate HTTP).
 *   - Does NOT verify project existence (HistoryFacade owns the 404 UX).
 *
 * Track D: implemented in P1 — FE-PROJ-017.
 */
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';

/**
 * Matches any RFC 4122 UUID (v1–v5) in lowercase or uppercase.
 * Pattern: 8-4-4-4-12 hex groups separated by hyphens.
 */
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * projProjetoGuard — validates that :projetoId is a well-formed UUID.
 *
 * - UUID malformed or absent → redirect to /proj/biblioteca-de-projetos (no HTTP).
 * - UUID well-formed → return true (HistoryFacade handles 404 via 'not-found' state).
 *
 * Registered in PROJ_ROUTES as the 3rd guard after authGuard and empresaGuard,
 * only on the parametrized route /proj/projetos/:projetoId/historico.
 */
export const projProjetoGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const router    = inject(Router);
  const projetoId = route.paramMap.get('projetoId') ?? '';

  if (!projetoId || !UUID_REGEX.test(projetoId)) {
    return router.createUrlTree(['/proj', 'biblioteca-de-projetos']);
  }

  return true;
};
