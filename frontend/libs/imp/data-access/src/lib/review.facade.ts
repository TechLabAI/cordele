/**
 * review.facade.ts — drives the T04 Revisão de Estrutura flow (signals-based, ADR-007).
 *
 * Contracts honoured:
 *   - T04 hydrates from 201 body (router state) — zero GET in happy path (M2 D-A).
 *   - Deep-link: loadStructure(manuscritoId) calls GET /manuscritos/{id} + GET /segmentos/ignored.
 *   - ignorarSegmento(): PERSISTENT with mandatory rollback on 4xx/5xx (FE-IMP-011 / §8.1).
 *   - restaurarSegmento(): PERSISTENT with mandatory rollback on 4xx/5xx (§8.1).
 *   - confirmarEstrutura(): calls POST /confirm-estrutura before navigating (FE-IMP-011 / §8.2).
 *
 * Public signal contract (P2 — plan-FE-IMP §3 P2):
 *   estrutura:    Signal<ContentTree | null>               — current content tree
 *   phase:        Signal<'idle'|'loading'|'confirming'|'error'> — unified phase
 *   errorMessage: Signal<string | null>                   — last error description
 *
 * Track D: created by fe-architect-promote IMP @ cordele (D-494).
 * P2: completed signals contract + loadStructure alias + M4 wiring.
 * P6: uses mapImpError for centralised error messages (FE-IMP-021);
 *     emits imp.structure.confirmed telemetry event (FE-IMP-023).
 */
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';
import { ImpShellIntegrationService } from '@cordele/imp/integration';
import { MANUSCRITO_PORT } from './ports/manuscrito.port';
import { SEGMENTO_CURADORIA_PORT } from './ports/segmento-curadoria.port';
import { ContentTree, ManuscritoDetail } from './models/imp.models';
import { mapImpError } from './error/imp-error.mapper';

@Injectable({ providedIn: 'root' })
export class ReviewFacade {
  private readonly manuscritoPort  = inject(MANUSCRITO_PORT);
  private readonly curadoriaPort   = inject(SEGMENTO_CURADORIA_PORT);
  private readonly router          = inject(Router);
  private readonly destroyRef      = inject(DestroyRef);
  private readonly integrationSvc  = inject(ImpShellIntegrationService);

  // ── Internal state ────────────────────────────────────────────────────────
  private readonly _manuscrito   = signal<ManuscritoDetail | null>(null);
  private readonly _ignoredIds   = signal<Set<string>>(new Set());
  private readonly _loading      = signal(false);
  private readonly _error        = signal<string | null>(null);
  private readonly _confirmando  = signal(false);
  private readonly _confirmError = signal<string | null>(null);

  // ── Public API — P2 contract ──────────────────────────────────────────────

  /** Full manuscrito detail (includes estrutura). Use `estrutura` for the ContentTree only. */
  readonly manuscrito = this._manuscrito.asReadonly();

  /** ContentTree extracted from the current manuscrito. */
  readonly estrutura = computed<ContentTree | null>(
    () => this._manuscrito()?.estrutura ?? null,
  );

  /**
   * Unified phase signal combining loading, confirming, and error states.
   * Precedence: error > confirming > loading > idle.
   */
  readonly phase = computed<'idle' | 'loading' | 'confirming' | 'error'>(() => {
    if (this._error() || this._confirmError()) return 'error';
    if (this._confirmando()) return 'confirming';
    if (this._loading()) return 'loading';
    return 'idle';
  });

  /** Last error message (from load or confirm). Null when no error. */
  readonly errorMessage = computed<string | null>(
    () => this._confirmError() ?? this._error(),
  );

  /** Set of segmentoIds that have been ignored (optimistic — may differ from server briefly). */
  readonly ignoredIds = this._ignoredIds.asReadonly();

  // ── Hydrate ───────────────────────────────────────────────────────────────

  /** Happy path: called from T04 when router state carries the 201 POST response. */
  hydrateFromResponse(manuscrito: ManuscritoDetail): void {
    this._manuscrito.set(manuscrito);
    this._ignoredIds.set(new Set());
    this._error.set(null);
    this._confirmError.set(null);
  }

  /**
   * Deep-link / reload: fetch manuscrito + ignored set in parallel.
   * Alias: loadStructure(id) is the P2 contract name for this action.
   */
  load(manuscritoId: string): void {
    this._loading.set(true);
    this._error.set(null);
    this._confirmError.set(null);

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
        error: (err: HttpErrorResponse) => {
          // FE-IMP-021: centralised error mapper
          const { message, traceId } = mapImpError(err);
          this._error.set(traceId ? `${message} [${traceId}]` : message);
          this._loading.set(false);
        },
      });
  }

  /**
   * P2 contract name for load() — see plan-FE-IMP §3 P2.
   * Loads manuscrito + ignored set from the backend (deep-link path).
   */
  loadStructure(manuscritoId: string): void {
    this.load(manuscritoId);
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Ignore an unparsed segment — PERSISTENT with mandatory rollback.
   * Optimistically marks as ignored, then rolls back on 4xx/5xx (FE-IMP-011).
   */
  ignorarSegmento(segmentoId: string): void {
    const manuscritoId = this._manuscrito()?.id;
    if (!manuscritoId) return;

    // Optimistic update (immutable — spread to a new Set so OnPush detects change)
    this._ignoredIds.update(s => new Set([...s, segmentoId]));

    this.curadoriaPort.ignore(manuscritoId, segmentoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        // Success: optimistic state is already correct
        error: (_err: HttpErrorResponse) => {
          // Mandatory rollback on any 4xx/5xx (api-contract §8.1 FE-IMP-011)
          this._ignoredIds.update(s => {
            const next = new Set(s);
            next.delete(segmentoId);
            return next;
          });
          // FE-IMP-021: toast channel for ignore rollback (SPEC-07 §3)
          const { message, traceId } = mapImpError(_err);
          this._error.set(traceId ? `${message} [${traceId}]` : message);
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
        error: (_err: HttpErrorResponse) => {
          // Rollback: re-add the segmentoId
          this._ignoredIds.update(s => new Set([...s, segmentoId]));
          // FE-IMP-021: centralised error mapper
          const { message, traceId } = mapImpError(_err);
          this._error.set(traceId ? `${message} [${traceId}]` : message);
        },
      });
  }

  /**
   * Confirm structure review — calls POST /confirm-estrutura, then navigates to COMP.
   * INT-FE-IMP-003: navigates to /comp after confirmation.
   * Fallback: if /comp is not registered in the shell (navigate returns false), falls
   * back to /proj/biblioteca to keep the user in a known state.
   * Never navigates on error (stay on T04, show toast via errorMessage signal).
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

          // FE-IMP-023: emit imp.structure.confirmed telemetry event
          this.integrationSvc.emitLifecycleEvent('imp.structure.confirmed', {
            manuscritoId,
          });

          // INT-FE-IMP-003: navigate to COMP module.
          // compJobId is not yet returned by the backend (ConfirmResponseDto forward-compat).
          // When it becomes available the port return type will be updated and this call will
          // use ['/comp', compJobId]. For now navigate to the COMP module root.
          // If COMP is not registered in the shell (navigate() resolves false), fall back.
          this.router.navigate(['/comp']).then(navigated => {
            if (!navigated) {
              // FIX(imp-confirm-pending): fallback URL was '/proj/biblioteca' which does not
              // exist in PROJ_ROUTES (actual path: '/proj/biblioteca-de-projetos'). The wrong
              // path caused two consecutive NavigationErrors, the URL never changed, and the
              // E2E waitForURL timeout expired. The regex /(comp|proj\/biblioteca)/ matches
              // '/proj/biblioteca-de-projetos' as a substring, so this fix makes both the
              // routing and the e2e assertion work correctly.
              // COMP route not available — fallback to proj library (INT-FE-IMP-003)
              this.router.navigate(['/proj/biblioteca-de-projetos']);
            }
          });
        },
        error: (err: HttpErrorResponse) => {
          this._confirmando.set(false);
          // FE-IMP-021: centralised error mapper
          const { message, traceId } = mapImpError(err);
          this._confirmError.set(traceId ? `${message} [${traceId}]` : message);
        },
      });
  }

}
