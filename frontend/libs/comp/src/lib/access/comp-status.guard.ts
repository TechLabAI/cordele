/**
 * comp-status.guard.ts — Guard verifying that the resolved project is in em_composicao.
 * Replaces the 409 illegal-status from vision (not in api-contract §5) with a FE-only UX
 * redirect so the user is never navigated to COMP on a rascunho/publicado project.
 * STUB: Full implementation in FE-COMP-020 (Layer 2).
 * Track D: created by fe-architect-promote COMP @ cordele (D-494).
 */
import { CanActivateFn } from '@angular/router';

/**
 * Guards that the resolved project has status = em_composicao.
 * Stub: always allows. Layer 2 (FE-COMP-020) will check status and redirect:
 *   - rascunho → /imp/projetos/:projetoId/importar
 *   - publicado / com_erros → /proj/projetos/:projetoId/historico
 */
export const compStatusGuard: CanActivateFn = () => {
  // TODO[FE-COMP-020]: inject PROJETO_PORT, check status from resolved project,
  // redirect out of COMP if status != 'em_composicao'.
  return true;
};
