/**
 * comp-shell-integration.service.ts — registers COMP nav config with the shell.
 * FE-COMP-004 / SPEC-06 §2
 * FE-COMP-023 — dynamic breadcrumb resolution (P7).
 * FE-COMP-025 — observability telemetry (P9).
 *
 * Responsibilities:
 * - Register COMP_NAV_CONFIG (step-bar + breadcrumbs) with the navigation layer.
 * - Resolve `{nome}` in breadcrumbs dynamically from the active projetoId.
 * - Emit telemetry events for module navigation milestones (P9).
 * - No UI state; no prefetch of editorial data (ADR-COMP-001).
 *
 * Called by:
 * - compInit() in comp.bootstrap.ts — module-level registration (FE-COMP-003).
 * - ConfiguracoesComponent.ngOnInit() — breadcrumb resolution + metadata-opened event.
 * - EditorDeLayoutPreviewComponent.ngOnInit() — breadcrumb resolution + layout-opened event.
 * - LayoutFacade.onExport() success — comp-exported event.
 *
 * NOTE: NavigationService integration with @cordele/shared is a P4 hub task
 * (INT-FE-COMP-001). This service stores the resolved state so components can
 * consume it via signals until the shared NavigationService is available.
 */
import { Injectable, inject, signal } from '@angular/core';
import {
  COMP_NAV_CONFIG,
  CompNavScreen,
  ModuleNavConfig,
  resolveNavBreadcrumbs,
} from './comp-nav.config';
import { ObservabilityService } from '@cordele/comp/data-access';

@Injectable({ providedIn: 'root' })
export class CompShellIntegrationService {
  private readonly obs = inject(ObservabilityService);

  /** Registered nav config — readable by shell components during tests. */
  private _registeredConfig: ModuleNavConfig | null = null;

  /**
   * Resolved breadcrumbs keyed by screen.
   * Value is set by setActiveProject(); empty until first navigation.
   * Exposed as readonly signal so components can use it in templates without side effects.
   */
  private readonly _resolvedBreadcrumbs = signal<Record<CompNavScreen, string[]>>({
    configurar: [],
    edicao: [],
  });

  /** Readonly signal of resolved breadcrumbs — consume in components via `computed()`. */
  readonly resolvedBreadcrumbs = this._resolvedBreadcrumbs.asReadonly();

  get registeredConfig(): ModuleNavConfig | null {
    return this._registeredConfig;
  }

  /**
   * register() — called by compInit() on module activation.
   * Registers COMP_NAV_CONFIG with the shell navigation layer.
   * Full hub integration in INT-FE-COMP-001 (P4).
   */
  register(): void {
    this._registeredConfig = COMP_NAV_CONFIG;
    // TODO[INT-FE-COMP-001]: inject NavigationService from @cordele/shared/access-decision
    // and call: this.nav.registerModuleNav(COMP_NAV_CONFIG);
  }

  /**
   * setActiveProject() — resolves `{nome}` in breadcrumbs for a given projetoId.
   * FE-COMP-023: called by smart components (T05, T06) in ngOnInit once projetoId is known.
   * Uses projetoId as the display label when the project name store is unavailable.
   *
   * @param projetoId - route param; used as display label until ProjFacade exposes project name
   */
  setActiveProject(projetoId: string): void {
    this._resolvedBreadcrumbs.set({
      configurar: resolveNavBreadcrumbs('configurar', projetoId),
      edicao: resolveNavBreadcrumbs('edicao', projetoId),
    });
  }

  // ── Telemetry (FE-COMP-025 / P9) ─────────────────────────────────────────────

  /**
   * trackMetadataOpened() — emits telemetry when the user enters T05 (Configurações).
   * Called by ConfiguracoesComponent.ngOnInit().
   * Event: metadata-opened. No PII included.
   */
  trackMetadataOpened(projetoId: string): void {
    this.obs.track({
      name: 'metadata-opened',
      projetoId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * trackLayoutOpened() — emits telemetry when the user enters T06 (Editor de Layout).
   * Called by EditorDeLayoutPreviewComponent.ngOnInit().
   * Event: layout-opened. No PII included.
   */
  trackLayoutOpened(projetoId: string): void {
    this.obs.track({
      name: 'layout-opened',
      projetoId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * trackCompExported() — emits telemetry when the layout export completes successfully.
   * Called by LayoutFacade.onExport() on success (before navigation to PUB).
   * Event: comp-exported. No PII included.
   */
  trackCompExported(projetoId: string): void {
    this.obs.track({
      name: 'comp-exported',
      projetoId,
      timestamp: new Date().toISOString(),
    });
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────────

  /**
   * unregister() — called by compDestroy() on module deactivation.
   * Clears nav config and resolved breadcrumbs.
   */
  unregister(): void {
    this._registeredConfig = null;
    this._resolvedBreadcrumbs.set({ configurar: [], edicao: [] });
    // TODO[INT-FE-COMP-001]: this.nav.unregisterModuleNav(MODULE_KEY);
  }
}
