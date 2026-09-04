/**
 * pub-status.guard.ts — Guards PUB routes by project status. Full implementation FE-PUB-022 (P5).
 *
 * Modes (SPEC-01 §routes):
 *   export  — project must be in em_composicao for a fresh ePub generation to be valid.
 *             Any other status → redirect to /proj/biblioteca-de-projetos.
 *   history — always allow; the DownloadEHistoricoComponent renders empty state when there
 *             are no publications (no HTTP call needed for this mode).
 *
 * HTTP strategy (export mode):
 *   GET /api/proj/projetos/{projetoId} via AccessHttpClient (carries X-Empresa-Id).
 *   em_composicao → true.
 *   any other status or HTTP error → redirect to /proj/biblioteca-de-projetos.
 *
 * This is a FE-only UX guard (SPEC-01 §3): the BE api-contract defines its own pre-flight
 * checks (409/422, api-contract §5). The guard pre-empts the navigation; it is not a
 * security boundary.
 *
 * HTTP: uses AccessHttpClient (not HttpClient directly) — all module HTTP passes via
 * access-http-base so X-Empresa-Id is propagated consistently (RULE-NX-05 / INT-FE-PUB-001).
 *
 * Track D: FE-PUB-022 (P5) — real implementation replacing P1 stub from @cordele/pub flat lib.
 */
import { inject } from '@angular/core';
import { ActivatedRouteSnapshot, CanActivateFn, Router } from '@angular/router';
import { AccessHttpClient, moduleBase } from '@cordele/shared/access-http-base';
import { catchError, map, of } from 'rxjs';

/** Canonical project status values (mirrors BE ProjetoStatus enum). */
type ProjetoStatus = 'rascunho' | 'em_composicao' | 'publicado' | 'com_erros';

interface ProjetoStatusDto {
  readonly id: string;
  readonly status: ProjetoStatus;
}

/**
 * pubStatusGuard — returns a CanActivateFn for the given mode.
 *
 * Usage in PUB_ROUTES (pub-shell-entry):
 *   canActivate: [pubProjetoGuard, pubStatusGuard('export')]   // T07
 *   canActivate: [pubProjetoGuard, pubStatusGuard('history')]  // T08
 *
 * @param mode 'export' checks project status via proj-service; 'history' always allows.
 */
export function pubStatusGuard(mode: 'export' | 'history'): CanActivateFn {
  return (route: ActivatedRouteSnapshot) => {
    if (mode === 'history') {
      // history mode: component handles empty state — no redirect needed
      return true;
    }

    // export mode: project must be in em_composicao for export to be valid
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
          if (projeto.status === 'em_composicao') {
            return true as boolean;
          }
          // Any other status (rascunho, publicado, com_erros) → redirect to project library
          return router.createUrlTree(['/proj/biblioteca-de-projetos']);
        }),
        catchError(() =>
          // Network error, 404 or 5xx → redirect to project library (safe degradation)
          of(router.createUrlTree(['/proj/biblioteca-de-projetos'])),
        ),
      );
  };
}
