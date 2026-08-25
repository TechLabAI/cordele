/**
 * comp-projeto.guard.ts — Guard verifying that projetoId from route params resolves
 * to an existing project in em_composicao status before activating COMP routes.
 * STUB: Full implementation in FE-COMP-019 (Layer 2).
 * Track D: created by fe-architect-promote COMP @ cordele (D-494).
 */
import { CanActivateFn } from '@angular/router';

/**
 * Guards that :projetoId resolves to an existing project.
 * Stub: always allows. Layer 2 (FE-COMP-019) will call PROJ port and redirect on 404.
 */
export const compProjetoGuard: CanActivateFn = () => {
  // TODO[FE-COMP-019]: inject PROJETO_PORT, resolve projetoId from route.params,
  // call projetoPort.get(projetoId), redirect to /proj/biblioteca-de-projetos on 404.
  return true;
};
