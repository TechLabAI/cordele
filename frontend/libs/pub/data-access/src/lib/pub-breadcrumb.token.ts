/**
 * pub-breadcrumb.token.ts — Injection token for the telemetry breadcrumb callback.
 * FE-PUB-026 (P8 Observability).
 *
 * Decouples data-access facades (ExportFacade, HistoryFacade) and feature components
 * (ExportacaoEValidacaoComponent) from PubShellIntegrationService (type:feature).
 *
 * Nx boundary rules make it impossible to place this token in pub-integration:
 *   - type:data-access can only import type:domain — cannot import type:feature (pub-integration).
 *   - type:feature cannot import type:feature from another lib (same constraint applies to
 *     ExportacaoEValidacaoComponent importing from pub-integration).
 *
 * Placing the token in pub-data-access (same lib as ExportFacade / HistoryFacade) avoids all
 * cross-lib boundary issues while still allowing type:feature components to inject it
 * (feature → data-access is permitted).
 *
 * This is the same pattern used by PUB_EMPRESA_CHANGED and PUB_UPDATE_BREADCRUMB — all three
 * tokens live in pub-data-access for identical boundary reasons.
 *
 * Tech-debt note: three injection tokens with the same shape (callback fn) in the same lib
 * suggest a future "PubIntegrationCallbacks" abstraction, but consolidation is out of scope
 * for P8 (FE-PUB-026). Tracked here for future refactor.
 *
 * Wiring pattern (app.config.ts):
 *   {
 *     provide: PUB_BREADCRUMB,
 *     useFactory: () => {
 *       const svc = inject(PubShellIntegrationService);
 *       return (event: string, projetoId: string, correlationId?: string) =>
 *         svc.publishBreadcrumb(event, projetoId, correlationId);
 *     },
 *   }
 *
 * Default factory: no-op — safe for test environments where PubShellIntegrationService
 * is not provided.
 *
 * Track D: FE-PUB-026 (P8 Observability).
 */
import { InjectionToken } from '@angular/core';

/** Callback type for publishing a telemetry breadcrumb event. */
export type PubBreadcrumbFn = (event: string, projetoId: string, correlationId?: string) => void;

/**
 * PUB_BREADCRUMB — token for the telemetry breadcrumb callback.
 * Inject in data-access facades and feature components to emit lifecycle events.
 * Default: no-op. Real impl provided by app.config.ts via PubShellIntegrationService.
 */
export const PUB_BREADCRUMB = new InjectionToken<PubBreadcrumbFn>('PubBreadcrumb', {
  providedIn: 'root',
  factory: () => (_event: string, _projetoId: string, _correlationId?: string) => {
    /* no-op default — overridden in app.config.ts */
  },
});
