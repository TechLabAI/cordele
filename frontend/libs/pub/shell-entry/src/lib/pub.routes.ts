/**
 * pub.routes.ts — PUB module routes with full guards (FE-PUB-002).
 * P3 update: components migrated from flat lib to feature sub-libs (FE-PUB-012, FE-PUB-018).
 *
 * Registered in app.routes.ts as:
 *   { path: 'pub', loadChildren: () => import('@cordele/pub-shell-entry').then(r => r.PUB_ROUTES) }
 *
 * Routes (SPEC-01 §routes):
 *   /pub/projetos/:projetoId/exportacao-e-validacao   → ExportacaoEValidacaoComponent (T07)
 *   /pub/projetos/:projetoId/download-e-historico     → DownloadEHistoricoComponent (T08)
 *
 * Guards (ordered — all must pass):
 *   authGuard           — JWT present and valid   (@cordele/shared/access-decision)
 *   empresaGuard        — EmpresaContext resolved  (@cordele/shared/empresa-context)
 *   accessGuard(perm)   — named permission check   (@cordele/shared/access-decision)
 *   pubProjetoGuard     — UUID-v4 format check     (@cordele/pub-access, FE-PUB-021 stub)
 *   pubStatusGuard      — project status check     (@cordele/pub-access, FE-PUB-022 stub)
 *
 * Track D: FE-PUB-002 — P1 Foundation; FE-PUB-012/018 — P3 Feature Libs migration.
 */
import { Routes } from '@angular/router';
import { authGuard, accessGuard } from '@cordele/shared/access-decision';
import { empresaGuard } from '@cordele/shared/empresa-context';
import { pubProjetoGuard, pubStatusGuard } from '@cordele/pub-access';

/** Guards applied to all PUB routes (auth + empresa context). */
const PUB_BASE_GUARDS = [authGuard, empresaGuard];

export const PUB_ROUTES: Routes = [
  {
    path: 'projetos/:projetoId/exportacao-e-validacao',
    // P3: loadComponent from @cordele/pub-feature-export (FE-PUB-012)
    loadComponent: () =>
      import('@cordele/pub-feature-export').then(m => m.ExportacaoEValidacaoComponent),
    canActivate: [
      ...PUB_BASE_GUARDS,
      pubProjetoGuard,
      pubStatusGuard('export'),
      accessGuard('pub.export'),
    ],
    title: 'Exportação e Validação',
  },
  {
    path: 'projetos/:projetoId/download-e-historico',
    // P3: loadComponent from @cordele/pub-feature-history (FE-PUB-018)
    loadComponent: () =>
      import('@cordele/pub-feature-history').then(m => m.DownloadEHistoricoComponent),
    canActivate: [
      ...PUB_BASE_GUARDS,
      pubProjetoGuard,
      pubStatusGuard('history'),
      accessGuard('pub.view'),
    ],
    title: 'Download e Histórico',
  },
  { path: '', redirectTo: '/proj/biblioteca-de-projetos', pathMatch: 'full' },
];
