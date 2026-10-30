/**
 * comp-status.guard.ts — Guards that the resolved project is in em_composicao status.
 *
 * INT-FE-COMP-003 (P4): real implementation using GET to proj-service.
 * FE-COMP-020 (P5) will refine with ProjetoStore integration if @cordele/proj exports one.
 *
 * Strategy:
 *   1. Extract projetoId from ActivatedRouteSnapshot.
 *   2. GET /api/v1/proj/projetos/{projetoId} via AccessHttpClient (RULE-NX-05).
 *   3. em_composicao → allow.
 *   4. rascunho → redirect to /imp/projetos/:projetoId/importar.
 *   5. publicado / com_erros → redirect to /proj/projetos/:projetoId/historico.
 *   6. Error (404 / 5xx) → redirect to /proj/biblioteca-de-projetos.
 *
 * This is a FE-only UX guard (SPEC-01 §3): the BE api-contract defines no COMP
 * illegal-status error. The guard pre-empts the navigation; it is not a security boundary.
 *
 * HTTP: uses AccessHttpClient (not HttpClient directly) per RULE-NX-05 — empresa context
 * is resolved server-side from the JWT `empresa_id` claim (INT-FE-COMP-001).
 *
 * Track D: created by fe-architect-promote COMP @ cordele (D-494).
 * Updated: INT-FE-COMP-003 (P4) — real proj-service integration via AccessHttpClient.
 */
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AccessHttpClient, moduleBase } from '@cordele/shared/access-http-base';
import { catchError, map, of } from 'rxjs';

// Canonical project status values (mirrors BE ProjetoStatus enum)
type ProjetoStatus = 'rascunho' | 'em_composicao' | 'publicado' | 'com_erros';

interface ProjetoStatusDto {
  readonly id: string;
  readonly status: ProjetoStatus;
}

/**
 * compStatusGuard — verifies the project is in em_composicao before activating COMP routes.
 *
 * Reads projetoId from ActivatedRouteSnapshot.params['projetoId'].
 * On success (em_composicao): returns true.
 * On any other status: redirects appropriately.
 * On HTTP error: redirects to library (safe degradation).
 */
export const compStatusGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const http      = inject(AccessHttpClient);
  const router    = inject(Router);
  const projetoId = route.paramMap.get('projetoId') ?? '';

  if (!projetoId) {
    return router.createUrlTree(['/proj/biblioteca-de-projetos']);
  }

  return http
    .get<ProjetoStatusDto>(`${moduleBase('proj')}/projetos/${projetoId}`)
    .pipe(
      map(projeto => {
        switch (projeto.status) {
          case 'em_composicao':
            return true;
          case 'rascunho':
            // Not yet in composicao → redirect to IMP to continue importation
            return router.createUrlTree(['/imp', 'projetos', projetoId, 'importar']);
          case 'publicado':
          case 'com_erros':
            // Past composicao → redirect to PROJ historico
            return router.createUrlTree(['/proj', 'projetos', projetoId, 'historico']);
          default:
            return router.createUrlTree(['/proj/biblioteca-de-projetos']);
        }
      }),
      catchError(() =>
        // Network error or 404 → redirect to project library (safe degradation)
        of(router.createUrlTree(['/proj/biblioteca-de-projetos'])),
      ),
    );
};
