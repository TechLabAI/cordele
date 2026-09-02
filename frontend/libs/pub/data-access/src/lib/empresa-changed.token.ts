/**
 * empresa-changed.token.ts — Injection token for the empresaChanged signal (FE-PUB-007).
 *
 * Provides the pub-data-access layer (ExportFacade) with a signal that increments
 * each time the active empresa changes. This decouples data-access from feature libs
 * (boundary rule: type:data-access only imports type:domain).
 *
 * Default factory: signal(0) — no empresa changes detected (no-op, safe default).
 * Override: PubShellIntegrationService (pub-integration, type:feature) provides
 * its own empresaChanged signal via route-level providers or environment providers
 * in app.config.ts (INT-FE-PUB-006, wired in P4).
 *
 * Wiring pattern (app.config.ts / providePub consumers):
 *   { provide: PUB_EMPRESA_CHANGED, useFactory: () => inject(PubShellIntegrationService).empresaChanged }
 */
import { InjectionToken, Signal, signal } from '@angular/core';

/**
 * Signal<number> that increments on each empresa switch.
 * ExportFacade watches this and cancels in-flight polls on change.
 * Default returns signal(0) (no empresa changes — safe for test environments).
 */
export const PUB_EMPRESA_CHANGED = new InjectionToken<Signal<number>>('PubEmpresaChanged', {
  providedIn: 'root',
  factory: () => signal(0),
});
