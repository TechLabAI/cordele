/**
 * imp-shell-integration.service.ts — IMP shell bridge (INT-FE-IMP-005, INT-FE-IMP-006).
 *
 * Responsibilities:
 *   - init(): register IMP permissions + feature flags with AccessDecisionService.
 *   - Track empresa changes: exposes `empresaChanged` signal (increments on each switch).
 *   - Callers (e.g. ImportFacade via effect()) react to `empresaChanged` to cancel in-flight ops.
 *
 * Boundaries (RULE-NX-01 / RULE-NX-03):
 *   - type:domain — may import scope:shared type:domain libs only.
 *   - No HttpClient.
 *   - No imports from imp-data-access or imp-shell-entry.
 *
 * Bootstrap: call `init()` once at module bootstrap (e.g. in app.config.ts APP_INITIALIZER
 * or from the IMP route canActivate chain).
 *
 * Multi-empresa (multi-empresa.md §3):
 *   EmpresaContextService is the single source of truth. When the empresa switches,
 *   `empresaChanged` increments and callers cancel in-flight uploads/requests.
 */
import { Injectable, effect, inject, signal } from '@angular/core';
import { EmpresaContextService } from '@cordele/shared/empresa-context';
import { AccessDecisionService } from '@cordele/shared/access-decision';

/**
 * ImpShellIntegrationService — bridge between IMP module and shell infrastructure.
 *
 * Provided in root (singleton). Call `init()` once at module bootstrap.
 */
@Injectable({ providedIn: 'root' })
export class ImpShellIntegrationService {
  private readonly empresaCtx     = inject(EmpresaContextService);
  private readonly accessDecision = inject(AccessDecisionService);

  /**
   * Counter incremented on each empresa switch (skips the initial boot execution).
   * ImportFacade uses effect(() => { if (this.integrationSvc.empresaChanged()) { this.reset(); } })
   * to cancel any upload in-flight when the empresa changes.
   */
  private readonly _empresaChangedCount = signal(0);

  /** Public read-only signal: increments each time the active empresa changes (>0 = changed). */
  readonly empresaChanged = this._empresaChangedCount.asReadonly();

  /**
   * Flag to skip the first (boot-time) execution of the reactive effect.
   * The effect runs immediately on construction — that is NOT a "change".
   */
  private _bootstrapped = false;

  constructor() {
    // Signal-first approach: use effect() to track EmpresaContext.current.
    // The effect runs synchronously on construction (boot) — we skip that first run.
    // On each subsequent run (empresa switch), we increment the counter.
    effect(() => {
      // Read the signal to register the reactive dependency
      this.empresaCtx.current();

      if (this._bootstrapped) {
        // Empresa changed after boot — signal to callers
        this._empresaChangedCount.update(n => n + 1);
      } else {
        // First run = boot-time setup; skip counting
        this._bootstrapped = true;
      }
    });
  }

  /**
   * init() — call once at module bootstrap.
   *
   * Registers IMP permissions and feature flags so that
   * `accessGuard('imp.import')`, `accessGuard('imp.review')` etc. can evaluate correctly.
   *
   * Defined inline to avoid importing from imp-shell-entry (type:app) which would
   * violate the type:domain boundary (RULE-NX-01).
   */
  init(): void {
    // Register IMP FE→BE permission mappings
    this.accessDecision.registerPermissions({
      'imp.import':  { beScope: 'imp:write' },
      'imp.review':  { beScope: 'imp:read'  },
      'imp.confirm': { beScope: 'imp:write' },
    });

    // Register IMP feature flags with their default states
    this.accessDecision.registerFlags({
      'imp.reimport':        { defaultState: 'on' },
      'imp.ignoreFragment':  { defaultState: 'on' },
      'imp.existingProject': { defaultState: 'on' },
    });
  }

  /**
   * emitLifecycleEvent — publish an IMP lifecycle breadcrumb to the pipeline event stream.
   *
   * FE-IMP-023 / SPEC-06 §2: ImpShellIntegrationService publishes import lifecycle
   * breadcrumbs to the pipeline event stream. The correlation id is carried by the
   * `access-http-base` interceptor via `X-Correlation-Id` header.
   *
   * Current implementation uses console.info as a stub.
   * TODO[lote-X]: replace stub with real telemetry service once
   * `@cordele/shared/observability` exposes an injectable TelemetryService.
   *
   * Called by:
   *   - ImportFacade: imp.import.started, imp.import.succeeded, imp.import.failed
   *   - ReviewFacade: imp.structure.confirmed
   *
   * @param eventName - lifecycle event name (e.g. 'imp.import.started')
   * @param data      - optional payload (manuscritoId, errorType, traceId, …)
   */
  emitLifecycleEvent(eventName: string, data?: Record<string, unknown>): void {
    // TODO[lote-X]: replace with real TelemetryService from @cordele/shared/observability
    // eslint-disable-next-line no-console
    console.info('[IMP telemetry]', eventName, data ?? {});
  }
}
