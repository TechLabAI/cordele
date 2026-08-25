/**
 * pub-projeto.guard.ts — Guard verifying that :projetoId from route params is a well-formed UUID.
 *
 * Hard existence / tenant check is the server's job (404 projeto-not-found, api-contract §5).
 * STUB: SPEC-01 §3 / FE-PUB-021 (Layer 2) will add PROJ port call on 404.
 *
 * Track D: created by fe-architect-promote PUB @ cordele (D-494).
 */
import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const pubProjetoGuard: CanActivateFn = (route) => {
  const router    = inject(Router);
  const projetoId = route.paramMap.get('projetoId') ?? '';

  if (!UUID_RE.test(projetoId)) {
    // TODO[FE-PUB-021]: replace mock-id fallback with real UUID validation + PROJ lookup
    return router.createUrlTree(['/proj/biblioteca-de-projetos']);
  }
  return true;
};
