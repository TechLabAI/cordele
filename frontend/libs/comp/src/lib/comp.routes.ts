/**
 * comp.routes.ts — COMP module routes (exported as COMP_ROUTES for loadChildren).
 * Registered in app.routes.ts as:
 *   { path: 'comp', loadChildren: () => import('@cordele/comp').then(r => r.COMP_ROUTES) }
 *
 * Routes (SPEC-01 / generator-config.yml / M3-fe):
 *   /comp/projetos/:projetoId/config                    → ConfiguracoesComponent (T05)
 *   /comp/projetos/:projetoId/editor-de-layout-preview  → EditorDeLayoutPreviewComponent (T06)
 *
 * Guards:
 *   compProjetoGuard  — verifies projetoId resolves to an existing project (stub, FE-COMP-019)
 *   compStatusGuard   — verifies project status = em_composicao (stub, FE-COMP-020)
 *
 * Track D: created by fe-architect-promote COMP @ cordele (D-494).
 */
import { Routes } from '@angular/router';
import { compProjetoGuard } from './access/comp-projeto.guard';
import { compStatusGuard } from './access/comp-status.guard';

export const COMP_ROUTES: Routes = [
  {
    path: 'projetos/:projetoId/config',
    loadComponent: () =>
      import('./feature-configuracoes/configuracoes.component').then(
        m => m.ConfiguracoesComponent,
      ),
    canActivate: [compProjetoGuard, compStatusGuard],
  },
  {
    path: 'projetos/:projetoId/editor-de-layout-preview',
    loadComponent: () =>
      import('./feature-editor/editor-de-layout-preview.component').then(
        m => m.EditorDeLayoutPreviewComponent,
      ),
    canActivate: [compProjetoGuard, compStatusGuard],
  },
  { path: '', redirectTo: 'projetos/proj-001/config', pathMatch: 'full' },
];
