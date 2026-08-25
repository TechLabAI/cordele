/**
 * proj.routes.ts — PROJ module routes (exported as PROJ_ROUTES for loadChildren).
 * Registered in app.routes.ts as:
 *   { path: 'proj', loadChildren: () => import('@cordele/proj').then(r => r.PROJ_ROUTES) }
 *
 * Routes (SPEC-01 / generator-config.yml):
 *   /proj/biblioteca-de-projetos          → BibliotecaDeProjetosComponent (T02, library)
 *   /proj/projetos/:projetoId/historico   → DownloadEHistoricoComponent (T08, parametrized)
 *
 * Note: route for T08 is parametrized /projetos/:projetoId/historico, replacing the flat
 * /download-e-historico from the prototype (as required by the promote spec).
 *
 * Track D: created by fe-architect-promote PROJ @ cordele (D-494).
 */
import { Routes } from '@angular/router';

export const PROJ_ROUTES: Routes = [
  {
    path: 'biblioteca-de-projetos',
    loadComponent: () =>
      import('./feature-library/biblioteca-de-projetos.component').then(
        m => m.BibliotecaDeProjetosComponent,
      ),
    // guards (proj.view permission) wired by Layer 2 — FE-PROJ-013
  },
  {
    path: 'projetos/:projetoId/historico',
    loadComponent: () =>
      import('./feature-history/download-e-historico.component').then(
        m => m.DownloadEHistoricoComponent,
      ),
    // guards (proj.view permission) wired by Layer 2 — FE-PROJ-013
  },
  { path: '', redirectTo: 'biblioteca-de-projetos', pathMatch: 'full' },
];
