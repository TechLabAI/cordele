/**
 * pub-status.guard.ts — Guards T07 (export mode) and T08 (history mode) by project status.
 *
 * export mode: project must be em_composicao (fresh export is valid only from a composed project).
 * history mode: project must have ≥1 Publicacao (empty state handled by component, not redirect).
 *
 * STUB: client-side guard only; server enforces its own pre-flight (409/422, api-contract §5).
 * Full implementation: FE-PUB-022 (Layer 2).
 *
 * Track D: created by fe-architect-promote PUB @ cordele (D-494).
 */
import { CanActivateFn } from '@angular/router';

/**
 * pubStatusGuard — returns a CanActivateFn for the given mode.
 * Usage in routes:
 *   canActivate: [pubProjetoGuard, pubStatusGuard('export')]
 *   canActivate: [pubProjetoGuard, pubStatusGuard('history')]
 */
export function pubStatusGuard(mode: 'export' | 'history'): CanActivateFn {
  return (_route, _state) => {
    // TODO[FE-PUB-022]: inject PROJ port, resolve project status for projetoId.
    // export mode: redirect to /proj/biblioteca-de-projetos if status !== em_composicao.
    // history mode: allow; component renders empty state if no publications.
    void mode;
    return true;
  };
}
