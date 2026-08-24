/**
 * imp.routes.ts — IMP module routes (exported as IMP_ROUTES for loadChildren).
 * Registered in app.routes.ts as: { path: 'imp', loadChildren: () => import('@cordele/imp').then(r => r.IMP_ROUTES) }
 * Routes (SPEC-01):
 *   /imp/upload                              → UploadComponent (T03, new project)
 *   /imp/projetos/:projetoId/importar        → UploadComponent (T03, existing project)
 *   /imp/manuscritos/:manuscritoId/revisao   → RevisaoDeEstruturaComponent (T04, deep-linkable)
 * Track D: created by fe-architect-promote IMP @ cordele (D-494).
 */
import { Routes } from '@angular/router';

export const IMP_ROUTES: Routes = [
  {
    path: 'upload',
    loadComponent: () =>
      import('./feature-upload/upload.component').then(m => m.UploadComponent),
    // guards (imp.import permission) wired by Layer 2 — FE-IMP-013
  },
  {
    path: 'projetos/:projetoId/importar',
    loadComponent: () =>
      import('./feature-upload/upload.component').then(m => m.UploadComponent),
    // same UploadComponent reads :projetoId from route params
  },
  {
    path: 'manuscritos/:manuscritoId/revisao',
    loadComponent: () =>
      import('./feature-review/revisao-de-estrutura.component').then(
        m => m.RevisaoDeEstruturaComponent,
      ),
    // guards (imp.review permission) wired by Layer 2 — FE-IMP-013
  },
  { path: '', redirectTo: 'upload', pathMatch: 'full' },
];
