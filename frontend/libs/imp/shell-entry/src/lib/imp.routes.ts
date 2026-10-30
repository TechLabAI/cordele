/**
 * imp.routes.ts — IMP module routes with guards (FE-IMP-003, FE-IMP-013, INT-FE-IMP-004).
 * P3 — Shell Entry + Bootstrap.
 * P5 — Real guards wired (FE-IMP-019, INT-FE-IMP-004).
 *
 * Registered in app.routes.ts as:
 *   { path: 'imp', loadChildren: () => import('@cordele/imp/shell-entry').then(r => r.IMP_ROUTES) }
 *
 * Routes (SPEC-01 §routes):
 *   /imp/upload                              → UploadComponent (T03, new project)
 *   /imp/projetos/:projetoId/importar        → UploadComponent (T03, existing project)
 *   /imp/manuscritos/:manuscritoId/revisao   → RevisaoDeEstruturaComponent (T04, deep-linkable)
 *
 * Guards (ordered — all must pass):
 *   authGuard           — JWT present and valid   (@cordele/shared/access-decision)
 *   empresaGuard        — EmpresaContext resolved  (@cordele/shared/empresa-context)
 *   accessGuard(perm)   — named permission check   (@cordele/shared/access-decision)
 *   impProjetoGuard     — UUID-v4 format check     (@cordele/imp/access, FE-IMP-019)
 *
 * Track D: created by fe-architect-promote IMP @ cordele (D-494).
 * Updated: P3 (FE-IMP-003/005) — guards wired; loadComponent kept for code-splitting.
 * Updated: P5 (INT-FE-IMP-004, FE-IMP-019) — real impProjetoGuard from imp-access.
 */
import { Routes } from '@angular/router';
import { authGuard, accessGuard } from '@cordele/shared/access-decision';
import { empresaGuard } from '@cordele/shared/empresa-context';
import { impProjetoGuard } from '@cordele/imp/access';

/** Guards applied to all IMP routes (auth + empresa context). */
const IMP_BASE_GUARDS = [authGuard, empresaGuard];

export const IMP_ROUTES: Routes = [
  {
    path: 'upload',
    loadComponent: () =>
      import('@cordele/imp/feature-upload').then(m => m.UploadComponent),
    canActivate: [...IMP_BASE_GUARDS, accessGuard('imp.import')],
    title: 'Importar Manuscrito',
  },
  {
    path: 'projetos/:projetoId/importar',
    loadComponent: () =>
      import('@cordele/imp/feature-upload').then(m => m.UploadComponent),
    // impProjetoGuard validates UUID-v4 format of :projetoId (wired in P5 — FE-IMP-019)
    canActivate: [...IMP_BASE_GUARDS, impProjetoGuard, accessGuard('imp.import')],
    title: 'Importar para Projeto',
  },
  {
    path: 'manuscritos/:manuscritoId/revisao',
    loadComponent: () =>
      import('@cordele/imp/feature-review').then(m => m.RevisaoDeEstruturaComponent),
    canActivate: [...IMP_BASE_GUARDS, accessGuard('imp.review')],
    title: 'Revisão de Estrutura',
  },
  { path: '', redirectTo: 'upload', pathMatch: 'full' },
];
