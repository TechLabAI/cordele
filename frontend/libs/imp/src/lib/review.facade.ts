/**
 * review.facade.ts — drives the T04 Revisão de Estrutura flow (signals-based, ADR-007).
 * Contracts honoured:
 *   - T04 hydrates from 201 body (router state) — zero GET in happy path (M2 D-A).
 *   - Deep-link: load(manuscritoId) calls GET /manuscritos/{id} + GET /segmentos/ignored (forkJoin).
 *   - ignorarSegmento(): PERSISTENT with mandatory rollback on 4xx/5xx (FE-IMP-011 / §8.1).
 *   - confirmarEstrutura(): calls POST /confirm-estrutura before navigating (FE-IMP-011 / §8.2).
 * Track D: created by fe-architect-promote IMP @ cordele (D-494).
 */
import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { MANUSCRITO_PORT } from './api/manuscrito.port';
import { SEGMENTO_CURADORIA_PORT } from './api/segmento-curadoria.port';
import { ManuscritoDetail } from './models/imp.models';

@Injectable({ providedIn: 'root' })
export class ReviewFacade {
  private readonly manuscritoPort = inject(MANUSCRITO_PORT);
  private readonly curadoriaPort  = inject(SEGMENTO_CURADORIA_PORT);
  private readonly router         = inject(Router);
  private readonly destroyRef     = inject(DestroyRef);

  // ── State ─────────────────────────────────────────────────────────────────
  private readonly _manuscrito      = signal<ManuscritoDetail | null>(null);
  private readonly _ignoredIds      = signal<Set<string>>(new Set());
  private readonly _loading         = signal(false);
  private readonly _error           = signal<string | null>(null);
  private readonly _confirmando     = signal(false);
  private readonly _confirmError    = signal<string | null>(null);

  readonly manuscrito   = this._manuscrito.asReadonly();
  readonly ignoredIds   = this._ignoredIds.asReadonly();
  readonly loading      = this._loading.asReadonly();
  readonly error        = this._error.asReadonly();
  readonly confirmando  = this._confirmando.asReadonly();
  readonly confirmError = this._confirmError.asReadonly();

  // ── Hydrate ───────────────────────────────────────────────────────────────

  /** Happy path: called from T04 when router state carries the 201 response. */
  hydrateFromResponse(manuscrito: ManuscritoDetail): void {
    this._manuscrito.set(manuscrito);
    // ignored set starts empty — no segments were ignored yet (just uploaded)
    this._ignoredIds.set(new Set());
  }

  /** Deep-link / reload: fetch manuscript + ignored set in parallel (M5 warning: forkJoin). */
  load(manuscritoId: string): void {
    this._loading.set(true);
    this._error.set(null);

    forkJoin({
      manuscrito: this.manuscritoPort.get(manuscritoId),
      ignored:    this.curadoriaPort.getIgnored(manuscritoId),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ manuscrito, ignored }) => {
          this._manuscrito.set(manuscrito);
          this._ignoredIds.set(new Set(ignored.ignoredSegmentoIds));
          this._loading.set(false);
        },
        error: err => {
          this._error.set(this.toMessage(err));
          this._loading.set(false);
        },
      });
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Ignore an unparsed segment — PERSISTENT with mandatory rollback.
   * Optimistically marks as ignored, then rolls back on 4xx/5xx (FE-IMP-011).
   */
  ignorarSegmento(segmentoId: string): void {
    const manuscritoId = this._manuscrito()?.id;
    if (!manuscritoId) return;

    // Optimistic update
    this._ignoredIds.update(s => new Set([...s, segmentoId]));

    this.curadoriaPort.ignore(manuscritoId, segmentoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        // Success: optimistic state is already correct
        error: _err => {
          // Mandatory rollback on any 4xx/5xx (api-contract §8.1 FE-IMP-011)
          this._ignoredIds.update(s => {
            const next = new Set(s);
            next.delete(segmentoId);
            return next;
          });
        },
      });
  }

  /**
   * Restore (un-ignore) a segment — PERSISTENT with mandatory rollback.
   */
  restaurarSegmento(segmentoId: string): void {
    const manuscritoId = this._manuscrito()?.id;
    if (!manuscritoId) return;

    // Optimistic update
    this._ignoredIds.update(s => {
      const next = new Set(s);
      next.delete(segmentoId);
      return next;
    });

    this.curadoriaPort.restoreIgnore(manuscritoId, segmentoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        error: _err => {
          // Rollback: re-add the segmentoId
          this._ignoredIds.update(s => new Set([...s, segmentoId]));
        },
      });
  }

  /**
   * Confirm structure review — calls POST /confirm-estrutura, then navigates to COMP.
   * Never navigates on error (stay on T04, show toast via confirmError signal).
   */
  confirmarEstrutura(): void {
    const manuscritoId = this._manuscrito()?.id;
    if (!manuscritoId) return;

    this._confirmando.set(true);
    this._confirmError.set(null);

    this.curadoriaPort.confirmEstrutura(manuscritoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this._confirmando.set(false);
          this.router.navigate(['/comp']);
        },
        error: err => {
          this._confirmando.set(false);
          this._confirmError.set(this.toMessage(err));
        },
      });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private toMessage(err: unknown): string {
    if (err instanceof Error) return err.message;
    const body = (err as { error?: { detail?: string; title?: string } })?.error;
    return body?.detail ?? body?.title ?? 'Erro inesperado. Tente novamente.';
  }
}
