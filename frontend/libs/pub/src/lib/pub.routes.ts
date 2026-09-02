/**
 * pub.routes.ts — PUB module routes (exported as PUB_ROUTES for loadChildren).
 *
 * Registered in app.routes.ts as:
 *   { path: 'pub', loadChildren: () => import('@cordele/pub').then(r => r.PUB_ROUTES) }
 *
 * Routes (SPEC-01 §1):
 *   /pub/projetos/:projetoId/exportacao-e-validacao   → ExportacaoEValidacaoComponent (T07)
 *   /pub/projetos/:projetoId/download-e-historico     → DownloadEHistoricoComponent (T08)
 *
 * Guards stubs — full implementation in FE-PUB-021/022 (Layer 2):
 *   pubProjetoGuard: UUID validation
 *   pubStatusGuard('export'): T07 only for em_composicao projects
 *   pubStatusGuard('history'): T08 always allowed (empty state handled by component)
 *
 * Track D: created by fe-architect-promote PUB @ cordele (D-494).
 */
import { Routes } from '@angular/router';
import { pubProjetoGuard, pubStatusGuard } from '@cordele/pub-access';

export const PUB_ROUTES: Routes = [
  {
    path: 'projetos/:projetoId/exportacao-e-validacao',
    loadComponent: () =>
      import('./feature-exportacao/exportacao-e-validacao.component').then(
        m => m.ExportacaoEValidacaoComponent,
      ),
    canActivate: [pubProjetoGuard, pubStatusGuard('export')],
  },
  {
    path: 'projetos/:projetoId/download-e-historico',
    loadComponent: () =>
      import('./feature-historico/download-e-historico.component').then(
        m => m.DownloadEHistoricoComponent,
      ),
    canActivate: [pubProjetoGuard, pubStatusGuard('history')],
  },
  { path: '', redirectTo: '/proj/biblioteca-de-projetos', pathMatch: 'full' },
];
