/**
 * comp.routes.ts — COMP module routes (exported as COMP_ROUTES for loadChildren).
 * FE-COMP-002 / SPEC-01 §1–§3
 *
 * Registered in app.routes.ts as:
 *   { path: 'comp', loadChildren: () => import('@cordele/comp').then(r => r.COMP_ROUTES) }
 *
 * Routes:
 *   /comp/projetos/:projetoId/config                    → ConfiguracoesComponent (T05)
 *   /comp/projetos/:projetoId/editor-de-layout-preview  → EditorDeLayoutPreviewComponent (T06)
 *
 * Guards (ordered — all 5 must pass):
 *   authGuard         — JWT present and valid (stub, INT-FE-COMP-001)
 *   empresaGuard      — EmpresaContext resolved (stub, INT-FE-COMP-006)
 *   accessGuard       — comp:read scope (stub, INT-FE-COMP-005)
 *   compProjetoGuard  — projetoId resolves to existing project (stub, FE-COMP-019)
 *   compStatusGuard   — project status = em_composicao (stub, FE-COMP-020)
 *
 * Track D: created by fe-architect-promote COMP @ cordele (D-494).
 * Updated: FE-COMP-002 — added auth/empresa/access guards + breadcrumb titles.
 */
import { Routes } from '@angular/router';
import { authGuard } from './access/auth.guard';
import { empresaGuard } from './access/empresa.guard';
import { accessGuard } from './access/access.guard';
import { compProjetoGuard } from './access/comp-projeto.guard';
import { compStatusGuard } from './access/comp-status.guard';

const COMP_GUARDS = [
  authGuard,
  empresaGuard,
  accessGuard('comp.view'),
  compProjetoGuard,
  compStatusGuard,
];

export const COMP_ROUTES: Routes = [
  {
    path: 'projetos/:projetoId/config',
    title: '{nome} · Configurar',
    loadComponent: () =>
      import('./feature-configuracoes/configuracoes.component').then(
        m => m.ConfiguracoesComponent,
      ),
    canActivate: COMP_GUARDS,
  },
  {
    path: 'projetos/:projetoId/editor-de-layout-preview',
    title: '{nome} · Edição',
    loadComponent: () =>
      import('./feature-editor/editor-de-layout-preview.component').then(
        m => m.EditorDeLayoutPreviewComponent,
      ),
    canActivate: COMP_GUARDS,
  },
  { path: '', redirectTo: 'projetos', pathMatch: 'full' },
];
