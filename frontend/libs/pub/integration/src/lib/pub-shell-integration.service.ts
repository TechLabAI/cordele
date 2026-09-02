/**
 * pub-shell-integration.service.ts — PUB shell bridge (FE-PUB-006, INT-FE-PUB-006).
 *
 * Responsibilities:
 *   - start(): tracks empresa changes; exposes `empresaChanged` signal (increments on each switch).
 *   - stop(): called when navigating away from PUB; flushes breadcrumbs, resets state,
 *             and signals any in-flight poll to cancel (INT-FE-PUB-006).
 *   - Callers (ExportFacade via effect()) react to `empresaChanged` to cancel in-flight polls.
 *
 * INT-FE-PUB-006 (P4): empresaChanged is wired to ExportFacade via the PUB_EMPRESA_CHANGED
 * injection token in app.config.ts:
 *   { provide: PUB_EMPRESA_CHANGED, useFactory: () => inject(PubShellIntegrationService).empresaChanged }
 * This decouples ExportFacade (type:data-access) from this service (type:feature) via DI.
 *
 * Boundaries (RULE-NX-01 / RULE-NX-05):
 *   - scope:pub, type:feature — may import scope:shared type:domain libs only.
 *   - No HttpClient.
 *   - No imports from pub-data-access, pub-shell-entry, or pub-navigation.
 *
 * Multi-empresa (multi-empresa.md §3):
 *   EmpresaContextService is the single source of truth. When the empresa switches,
 *   `empresaChanged` increments and callers cancel in-flight polls / requests.
 *
 * Bootstrap: call `start()` once when PUB module is activated (e.g. in APP_INITIALIZER
 * or from the PUB route canActivate chain).
 *
 * Track D: FE-PUB-006 (P1 Foundation). Updated: INT-FE-PUB-006 (P4 — poll cancel wiring).
 */
import { Injectable, effect, inject, signal } from '@angular/core';
import { EmpresaContextService } from '@cordele/shared/empresa-context';

/**
 * PubShellIntegrationService — bridge between PUB module and shell infrastructure.
 *
 * Provided in root (singleton). Call `start()` once at module activation.
 */
@Injectable({ providedIn: 'root' })
export class PubShellIntegrationService {
  private readonly empresaCtx = inject(EmpresaContextService);

  /**
   * Counter incremented on each empresa switch (skips the initial boot execution).
   * ExportFacade (P2) uses effect(() => { if (svc.empresaChanged()) { this.cancelPoll(); } })
   * to cancel any in-flight export poll when the empresa changes.
   */
  private readonly _empresaChangedCount = signal(0);

  /** Public read-only signal: increments each time the active empresa changes (>0 = changed). */
  readonly empresaChanged = this._empresaChangedCount.asReadonly();

  /**
   * Flag to skip the first (boot-time) execution of the reactive effect.
   * The effect runs synchronously on construction — that is NOT a "change".
   */
  private _bootstrapped = false;

  /**
   * Flag indicating that `start()` has been called and the service is active.
   * Prevents double-start and allows `stop()` to be safely idempotent.
   */
  private _active = false;

  constructor() {
    // Signal-first approach: use effect() to track EmpresaContext.current.
    // The effect runs synchronously on construction (boot) — skip that first run.
    // On each subsequent run (empresa switch), increment the counter.
    effect(() => {
      // Register reactive dependency on the empresa signal
      this.empresaCtx.current();

      if (this._bootstrapped) {
        // Empresa changed after boot — notify callers
        this._empresaChangedCount.update(n => n + 1);
      } else {
        // First run = boot-time setup; skip counting
        this._bootstrapped = true;
      }
    });
  }

  /**
   * start() — activate PUB module integration.
   *
   * Called once when the PUB module is first activated (e.g. from an APP_INITIALIZER
   * or a canActivate guard that bootstraps the module).
   * Idempotent: calling start() more than once has no effect.
   */
  start(): void {
    if (this._active) return;
    this._active = true;
    // The effect in the constructor already tracks empresa changes.
    // Additional module-specific startup logic can be added here in P2.
  }

  /**
   * stop() — deactivate PUB module integration.
   *
   * Called when navigating away from PUB (e.g. from a canDeactivate guard).
   * Flushes breadcrumbs and signals all callers to cancel in-flight operations.
   *
   * INT-FE-PUB-006 (P4): increments _empresaChangedCount to cancel any in-flight
   * export poll via ExportFacade's effect. The ExportFacade listens on the
   * PUB_EMPRESA_CHANGED token (wired in app.config.ts to this.empresaChanged signal).
   * Any count increment, including from stop(), triggers _cancelPoll() in ExportFacade.
   *
   * Note: the cancellation message in ExportFacade refers to "empresa alterada" which is
   * technically incorrect when stop() is the trigger; this message will be refined in P7.
   */
  stop(): void {
    if (!this._active) return;
    this._active = false;
    // INT-FE-PUB-006: signal poll cancellation to all callers (e.g. ExportFacade).
    // Incrementing empresaChanged causes ExportFacade to cancel any in-flight poll.
    this._empresaChangedCount.update(n => n + 1);
    // Breadcrumb flush will be added in P6 (FE-PUB-023) when NavigationService is wired.
  }
}
