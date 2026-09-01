/**
 * import.facade.ts — drives the T03 Upload flow (signals-based, ADR-007).
 * Contracts honoured:
 *   - POST /api/imp/manuscripts is SYNCHRONOUS (D-A): no polling, no parseJobId.
 *   - T03 sends file + EXACTLY ONE of {projetoTitulo | projetoId} (D-C).
 *   - UI shows indeterminate "analisando estrutura…" while POST is in flight (ADR-IMP-001 revised).
 * P5: reacts to empresaChanged from ImpShellIntegrationService (INT-FE-IMP-005).
 * P6: uses mapImpError for centralised error messages (FE-IMP-021);
 *     emits lifecycle telemetry events via ImpShellIntegrationService (FE-IMP-023).
 * Track D: created by fe-architect-promote IMP @ cordele (D-494).
 */
import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ImpShellIntegrationService } from '@cordele/imp/integration';
import { MANUSCRITO_PORT } from './ports/manuscrito.port';
import { ManuscritoDetail, UploadParams } from './models/imp.models';
import { mapImpError } from './error/imp-error.mapper';

export type UploadPhase = 'idle' | 'uploading' | 'done' | 'error';

@Injectable({ providedIn: 'root' })
export class ImportFacade {
  private readonly port             = inject(MANUSCRITO_PORT);
  private readonly router           = inject(Router);
  private readonly destroyRef       = inject(DestroyRef);
  private readonly integrationSvc   = inject(ImpShellIntegrationService);

  // ── Cancellation (P7: empresa-cancel e2e contract) ────────────────────────
  // Emitting on this Subject cancels any in-flight importar() subscription.
  // Called from reset() so that when the empresa changes mid-upload the ongoing
  // HTTP request is abandoned and navigation to T04 does NOT happen (INT-FE-IMP-005).
  private readonly _cancel$ = new Subject<void>();

  // ── State ─────────────────────────────────────────────────────────────────
  private readonly _phase    = signal<UploadPhase>('idle');
  private readonly _error    = signal<string | null>(null);
  private readonly _result   = signal<ManuscritoDetail | null>(null);

  readonly phase  = this._phase.asReadonly();
  readonly error  = this._error.asReadonly();
  readonly result = this._result.asReadonly();

  constructor() {
    // Cancel any upload in-flight when the active empresa changes (INT-FE-IMP-005).
    // empresaChanged() starts at 0 on boot — only reacts when it increments (> 0).
    effect(() => {
      if (this.integrationSvc.empresaChanged() > 0) {
        this.reset();
      }
    });
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  importar(params: UploadParams): void {
    this._phase.set('uploading');
    this._error.set(null);

    // FE-IMP-023: emit import:started lifecycle event
    this.integrationSvc.emitLifecycleEvent('imp.import.started');

    this.port.create(params)
      .pipe(
        takeUntil(this._cancel$),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: manuscrito => {
          this._result.set(manuscrito);
          this._phase.set('done');

          // FE-IMP-023: emit import:succeeded lifecycle event
          this.integrationSvc.emitLifecycleEvent('imp.import.succeeded', {
            manuscritoId: manuscrito.id,
          });

          // Navigate to T04 — pass manuscrito via router state (zero extra GET in happy path)
          this.router.navigate(
            ['/imp/manuscritos', manuscrito.id, 'revisao'],
            { state: { manuscrito } },
          );
        },
        error: (err: HttpErrorResponse) => {
          this._phase.set('error');

          // FE-IMP-021: use centralised error mapper (SPEC-07)
          const { message, traceId } = mapImpError(err);
          this._error.set(traceId ? `${message} [${traceId}]` : message);

          // FE-IMP-023: emit import:failed lifecycle event
          const urnType = (err.error as { type?: string } | null)?.type;
          this.integrationSvc.emitLifecycleEvent('imp.import.failed', {
            errorType: urnType ?? `http-${err.status}`,
            traceId,
          });
        },
      });
  }

  reset(): void {
    // Cancel any in-flight importar() subscription so that a POST response
    // arriving after reset() (e.g. empresa change mid-upload) does NOT
    // trigger navigation to T04 (INT-FE-IMP-005 / imp-empresa-cancel e2e).
    this._cancel$.next();
    this._phase.set('idle');
    this._error.set(null);
    this._result.set(null);
  }

}
