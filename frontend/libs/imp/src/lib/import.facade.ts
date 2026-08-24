/**
 * import.facade.ts — drives the T03 Upload flow (signals-based, ADR-007).
 * Contracts honoured:
 *   - POST /api/imp/manuscripts is SYNCHRONOUS (D-A): no polling, no parseJobId.
 *   - T03 sends file + EXACTLY ONE of {projetoTitulo | projetoId} (D-C).
 *   - UI shows indeterminate "analisando estrutura…" while POST is in flight (ADR-IMP-001 revised).
 * Track D: created by fe-architect-promote IMP @ cordele (D-494).
 */
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MANUSCRITO_PORT } from './api/manuscrito.port';
import { ManuscritoDetail, UploadParams } from './models/imp.models';

export type UploadPhase = 'idle' | 'uploading' | 'done' | 'error';

@Injectable({ providedIn: 'root' })
export class ImportFacade {
  private readonly port       = inject(MANUSCRITO_PORT);
  private readonly router     = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // ── State ─────────────────────────────────────────────────────────────────
  private readonly _phase    = signal<UploadPhase>('idle');
  private readonly _error    = signal<string | null>(null);
  private readonly _result   = signal<ManuscritoDetail | null>(null);

  readonly phase  = this._phase.asReadonly();
  readonly error  = this._error.asReadonly();
  readonly result = this._result.asReadonly();

  // ── Actions ───────────────────────────────────────────────────────────────

  importar(params: UploadParams): void {
    this._phase.set('uploading');
    this._error.set(null);

    this.port.create(params)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: manuscrito => {
          this._result.set(manuscrito);
          this._phase.set('done');
          // Navigate to T04 — pass manuscrito via router state (zero extra GET in happy path)
          this.router.navigate(
            ['/imp/manuscritos', manuscrito.id, 'revisao'],
            { state: { manuscrito } },
          );
        },
        error: err => {
          this._phase.set('error');
          this._error.set(this.toMessage(err));
        },
      });
  }

  reset(): void {
    this._phase.set('idle');
    this._error.set(null);
    this._result.set(null);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private toMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    const body = (err as { error?: { detail?: string; title?: string } })?.error;
    return body?.detail ?? body?.title ?? 'Erro inesperado. Tente novamente.';
  }
}
