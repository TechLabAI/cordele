/**
 * update-breadcrumb.token.ts — Injection token for the breadcrumb update function.
 * FE-PUB-023 (P6 Navigation).
 *
 * Decouples feature components (type:feature — pub-feature-export, pub-feature-history)
 * from PubShellIntegrationService (also type:feature — pub-integration).
 * Per Nx boundary rules, type:feature cannot import type:feature; components use this
 * token (type:data-access) instead and receive the real implementation via app.config.ts.
 *
 * Location: pub-data-access — mirrors PUB_EMPRESA_CHANGED (same lib, same pattern).
 * Feature components already import @cordele/pub-data-access, so no new cross-lib import needed.
 *
 * Wiring pattern (app.config.ts):
 *   {
 *     provide: PUB_UPDATE_BREADCRUMB,
 *     useFactory: () => (nomeProjeto: string) =>
 *       inject(PubShellIntegrationService).updateBreadcrumb(nomeProjeto),
 *   }
 *
 * Default factory: no-op — safe for test environments where PubShellIntegrationService
 * is not provided (breadcrumbs are not rendered in unit tests).
 *
 * Track D: FE-PUB-023 (P6 Navigation / Breadcrumbs).
 */
import { InjectionToken } from '@angular/core';

/** Callback type: receives the project name and updates the resolved breadcrumb signal. */
export type PubUpdateBreadcrumbFn = (nomeProjeto: string) => void;

/**
 * PUB_UPDATE_BREADCRUMB — token for the breadcrumb update callback.
 * Inject in feature components (T07, T08) to call updateBreadcrumb(projetoId) on enter.
 * Default: no-op. Real impl provided by app.config.ts via PubShellIntegrationService.
 */
export const PUB_UPDATE_BREADCRUMB = new InjectionToken<PubUpdateBreadcrumbFn>(
  'PubUpdateBreadcrumb',
  {
    providedIn: 'root',
    factory: () => (_nomeProjeto: string) => { /* no-op default */ },
  },
);
