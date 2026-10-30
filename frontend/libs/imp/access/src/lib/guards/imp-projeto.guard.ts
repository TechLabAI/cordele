/**
 * imp-projeto.guard.ts — impProjetoGuard (FE-IMP-019).
 *
 * Validates that the :projetoId route parameter is a well-formed UUID v4.
 * Redirects to /projetos if the value is absent, empty, or not a UUID v4.
 *
 * UUID v4 format:
 *   xxxxxxxx-xxxx-4xxx-[89ab]xxx-xxxxxxxxxxxx
 *   - 3rd group version nibble = 4
 *   - 4th group variant nibble = [89ab]
 *
 * Used in:
 *   imp.routes.ts — canActivate on /imp/projetos/:projetoId/importar
 */
import { inject } from '@angular/core';
import { CanActivateFn } from '@angular/router';
import { Router } from '@angular/router';

/** UUID v4 regex: version nibble = 4; variant nibble = [89ab]. */
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * impProjetoGuard — CanActivateFn.
 *
 * Returns `true` when `projetoId` is a valid UUID v4.
 * Returns a UrlTree redirecting to `/projetos` otherwise.
 */
export const impProjetoGuard: CanActivateFn = (route) => {
  const projetoId = route.paramMap.get('projetoId') ?? '';
  if (!UUID_V4.test(projetoId)) {
    return inject(Router).createUrlTree(['/projetos']);
  }
  return true;
};
