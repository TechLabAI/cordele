/**
 * pub-shell-integration.service.ts -- PUB shell bridge (FE-PUB-006, INT-FE-PUB-006).
 * Updated: FE-PUB-023 (P6 -- Navigation / Breadcrumbs).
 *
 * Responsibilities:
 *   - start(): registers PUB_NAV_CONFIG locally (stores _registeredConfig); tracks empresa changes.
 *   - stop(): deregisters nav config; resets breadcrumbs; cancels polls (INT-FE-PUB-006).
 *   - updateBreadcrumb(nomeProjeto): resolves T07/T08 breadcrumbs; called via token.
 *   - Callers (ExportFacade) react to empresaChanged to cancel polls.
 *
 * INT-FE-PUB-006 (P4): PUB_EMPRESA_CHANGED token wired in app.config.ts.
 * FE-PUB-023 (P6): PUB_UPDATE_BREADCRUMB token wired in app.config.ts.
 *
 * Boundaries (RULE-NX-01 / RULE-NX-05):
 *   - scope:pub, type:feature -- imports scope:shared type:domain libs only.
 *   - No HttpClient. No imports from pub-data-access, pub-shell-entry, or pub-navigation.
 *     (ng-packagr-lite fails when tsconfig path aliases resolve to another lib source.)
 *   - NavConfig + PUB_NAV_CONFIG inlined to avoid cross-lib source import.
 *
 * NavigationService: shared service does not yet exist (TODO[INT-FE-PUB-NAV]).
 * Registration stored locally until available -- mirrors CompShellIntegrationService.
 *
 * Track D: FE-PUB-006 (P1). Updated: INT-FE-PUB-006 (P4). FE-PUB-023 (P6).
 */
import { Injectable, effect, inject, signal } from '@angular/core';
import { EmpresaContextService } from '@cordele/shared/empresa-context';

// -- NavConfig (local -- avoids cross-lib source import that breaks ng-packagr-lite) --

interface NavConfig {
  moduleKey: string;
  stageIndex: number;
  stageLabel: string;
  breadcrumbLabel: string;
}

const PUB_NAV_CONFIG_LOCAL: NavConfig = {
  moduleKey: 'pub',
  stageIndex: 3,
  stageLabel: 'Exportar',
  breadcrumbLabel: 'Publicação',
};

// -- Breadcrumb resolution (P6 -- FE-PUB-023) --

type PubNavScreen = 'exportar' | 'download-historico';

const BREADCRUMB_TEMPLATES: Record<PubNavScreen, string[]> = {
  'exportar':            ['Projetos', '{nomeProjeto}', 'Exportar'],
  'download-historico':  ['Projetos', '{nomeProjeto}', 'Download e Histórico'],
};

function resolvePubBreadcrumbs(screen: PubNavScreen, nomeProjeto: string): string[] {
  return BREADCRUMB_TEMPLATES[screen].map(s => s.replace('{nomeProjeto}', nomeProjeto));
}

// -- Service --

@Injectable({ providedIn: 'root' })
export class PubShellIntegrationService {
  private readonly empresaCtx = inject(EmpresaContextService);

  // Navigation registration (P6 -- FE-PUB-023)
  private _registeredConfig: NavConfig | null = null;

  get registeredConfig(): NavConfig | null {
    return this._registeredConfig;
  }

  private readonly _resolvedBreadcrumbs = signal<Record<PubNavScreen, string[]>>({
    'exportar':           [],
    'download-historico': [],
  });

  readonly resolvedBreadcrumbs = this._resolvedBreadcrumbs.asReadonly();

  // Empresa-changed counter (P1 / P4 -- INT-FE-PUB-006)
  private readonly _empresaChangedCount = signal(0);

  readonly empresaChanged = this._empresaChangedCount.asReadonly();

  private _bootstrapped = false;
  private _active = false;

  constructor() {
    effect(() => {
      this.empresaCtx.current();
      if (this._bootstrapped) {
        this._empresaChangedCount.update(n => n + 1);
      } else {
        this._bootstrapped = true;
      }
    });
  }

  start(): void {
    if (this._active) return;
    this._active = true;
    // FE-PUB-023: register nav config locally until shared NavigationService is available.
    this._registeredConfig = PUB_NAV_CONFIG_LOCAL;
  }

  stop(): void {
    if (!this._active) return;
    this._active = false;
    // FE-PUB-023: clear nav registration and breadcrumbs.
    this._registeredConfig = null;
    this._resolvedBreadcrumbs.set({ 'exportar': [], 'download-historico': [] });
    // INT-FE-PUB-006: signal poll cancellation.
    this._empresaChangedCount.update(n => n + 1);
  }

  /**
   * updateBreadcrumb() -- FE-PUB-023 (P6).
   * Called via PUB_UPDATE_BREADCRUMB token (pub-data-access) from feature components.
   * Token pattern decouples type:feature -> type:feature (Nx boundary rule).
   */
  updateBreadcrumb(nomeProjeto: string): void {
    this._resolvedBreadcrumbs.set({
      'exportar':           resolvePubBreadcrumbs('exportar', nomeProjeto),
      'download-historico': resolvePubBreadcrumbs('download-historico', nomeProjeto),
    });
  }
}
