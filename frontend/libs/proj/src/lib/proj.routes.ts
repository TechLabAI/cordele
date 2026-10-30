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
 * Guards (INT-FE-PROJ-002 / FE-PROJ-017 — P1):
 *   authGuard        — JWT present and valid (@cordele/shared/access-decision)
 *   empresaGuard     — EmpresaContext resolved (@cordele/shared/empresa-context)
 *   projProjetoGuard — :projetoId is a well-formed UUID (only on T08 route)
 *
 * Track D: created by fe-architect-promote PROJ @ cordele (D-494).
 * Updated: P1 — guards wired (INT-FE-PROJ-002, FE-PROJ-017).
 */
import { Routes } from '@angular/router';
import { authGuard } from '@cordele/shared/access-decision';
import { empresaGuard } from '@cordele/shared/empresa-context';
import { projProjetoGuard } from './access/proj-projeto.guard';
import { provideProj } from './proj.providers';

export const PROJ_ROUTES: Routes = [
  {
    // Wrapper route: provides PROJETO_PORT + PUBLICACAO_PORT within the lazy chunk scope.
    // Removes the need for app.config.ts to statically import @cordele/proj (lazy-loaded).
    // Fixes lint: "Static imports of lazy-loaded libraries are forbidden."
    path: '',
    providers: [provideProj({ adapter: 'mock' })],
    children: [
      {
        path: 'biblioteca-de-projetos',
        loadComponent: () =>
          import('./feature-library/biblioteca-de-projetos.component').then(
            m => m.BibliotecaDeProjetosComponent,
          ),
        canActivate: [authGuard, empresaGuard],
      },
      {
        path: 'projetos/:projetoId/historico',
        loadComponent: () =>
          import('./feature-history/download-e-historico.component').then(
            m => m.DownloadEHistoricoComponent,
          ),
        canActivate: [authGuard, empresaGuard, projProjetoGuard],
      },
      { path: '', redirectTo: 'biblioteca-de-projetos', pathMatch: 'full' },
    ],
  },
];
