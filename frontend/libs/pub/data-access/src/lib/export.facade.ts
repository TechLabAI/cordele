/**
 * export.facade.ts — Drives the T07 Exportação e Validação flow (signals-based, ADR-007).
 * Migrated from libs/pub (flat lib) to libs/pub/data-access (P2 — FE-PUB-007).
 *
 * Contracts honoured:
 *   - Bounded poll: POST 202 + GET status with Retry-After (D-N; no SSE, no setInterval).
 *   - Progress is always indeterminate — PublicacaoStatus carries no percentage (D-N, SPEC-03).
 *   - podeBaixar = computed(epubcheckStatus ∈ {valido, avisos} AND arquivoDisponivel) — R4.
   *   - KPI tiles (INT-FE-PUB-005 resolved): tamanhoBytes/totalCapitulos/totalImagens in api-contract §6.1;
 *   - Avisos detail (§4.6): NOT called — INT-FE-PUB-004 BLOCKED (PUB-016 not ratified).
 *   - setInterval: never used — all async via timer() + switchMap.
 *   - empresaChanged: ExportFacade injects PUB_EMPRESA_CHANGED token (Signal<number>) and
 *     cancels any in-flight poll when the signal increments (INT-FE-PUB-006).
 *     Decoupled from PubShellIntegrationService (feature lib) via injection token
 *     to honour boundary rule (type:data-access may only import type:domain).
 *
 * Poll strategy: timer(retryAfterMs) → pollStatus → repeat until terminal.
 * Max 60 polls before self-cancelling (safety cap, never infinite).
 *
 * Resume on re-entry (SPEC-04 §3): resumeFromHistory() reads history list and
 * resumes polling if newest entry is non-terminal; otherwise renders terminal verdict.
 */
import { DestroyRef, Injectable, Signal, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Observable, Subject, switchMap, take, timer } from 'rxjs';
import { PUB_EMPRESA_CHANGED } from './empresa-changed.token';
import { PublicacaoApiService } from './publicacao-api.service';
import { EpubSummaryVM, ExportPhase, PublicacaoStatus, formatBytes } from './models/pub.models';

const DEFAULT_RETRY_MS = 2_000;
const MAX_POLLS       = 60;

function toPhase(s: PublicacaoStatus): ExportPhase {
  if (s.status === 'gerando' || s.status === 'validando') return 'gerando';
  if (s.status === 'publicado')  return 'valido';
  if (s.status === 'com_erros')  return 'erros';
  return 'error';
}

function isTerminal(s: PublicacaoStatus): boolean {
  return s.status === 'publicado' || s.status === 'com_erros';
}

@Injectable({ providedIn: 'root' })
export class ExportFacade {
  private readonly api           = inject(PublicacaoApiService);
  private readonly router        = inject(Router);
  private readonly destroyRef    = inject(DestroyRef);
  /** Signal<number>: increments on cada empresa switch. Default = signal(0) (no-op). */
  private readonly empresaChanged: Signal<number> = inject(PUB_EMPRESA_CHANGED);

  // ── Raw state ─────────────────────────────────────────────────────────────
  private readonly _phase     = signal<ExportPhase>('gerando');
  private readonly _status    = signal<PublicacaoStatus | null>(null);
  private readonly _error     = signal<string | null>(null);
  private readonly _projetoId = signal<string | null>(null);

  // ── Public readonly signals ───────────────────────────────────────────────
  readonly phase     = this._phase.asReadonly();
  readonly status    = this._status.asReadonly();
  readonly error     = this._error.asReadonly();
  readonly projetoId = this._projetoId.asReadonly();

  /** True iff epubcheckStatus ∈ {valido, avisos} AND arquivoDisponivel (api-contract D-Q / SPEC-03 R4). */
  readonly podeBaixar = computed(() => {
    const s = this._status();
    if (!s) return false;
    return (
      (s.epubcheckStatus === 'valido' || s.epubcheckStatus === 'avisos') &&
      s.arquivoDisponivel
    );
  });

  readonly totalAvisos = computed(() => this._status()?.totalAvisos ?? 0);
  readonly totalErros  = computed(() => this._status()?.totalErros  ?? 0);
  readonly resumoErro  = computed(() => this._status()?.resumoErro  ?? null);

  /**
   * ePub KPI tiles view model (INT-FE-PUB-005 / SPEC-03 §3).
   * Non-null only when status = 'publicado' (BE fields are non-null only then).
   * paginas is PERMANENTLY null — ADR-004: ePub reflowable has no fixed pagination.
   */
  readonly summary = computed<EpubSummaryVM | null>(() => {
    const s = this._status();
    if (!s || s.status !== 'publicado') return null;
    return {
      tamanho:   s.tamanhoBytes != null ? formatBytes(s.tamanhoBytes) : null,
      paginas:   null,  // ADR-004: ePub reflowable — sem paginação fixa; nunca exibir tile
      capitulos: s.totalCapitulos,
      imagens:   s.totalImagens,
    };
  });

  // ── Poll control ──────────────────────────────────────────────────────────
  private readonly _stop$ = new Subject<void>();

  constructor() {
    // INT-FE-PUB-006: react to empresa switch — cancel any in-flight poll.
    // empresaChanged increments on each switch; initial value = 0 (boot).
    effect(() => {
      const changed = this.empresaChanged();
      if (changed > 0) {
        this._cancelPoll();
      }
    });
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  /** Trigger a new export build, then start the bounded poll loop. */
  startExport(projetoId: string): void {
    this._projetoId.set(projetoId);
    this._phase.set('gerando');
    this._error.set(null);
    this._status.set(null);
    this._stop$.next(); // cancel any previous poll

    this.api.triggerExport(projetoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: status => {
          this._status.set(status);
          if (isTerminal(status)) {
            this._phase.set(toPhase(status));
          } else {
            this._beginPoll(projetoId, status.publicacaoId, DEFAULT_RETRY_MS);
          }
        },
        error: err => {
          this._phase.set('error');
          this._error.set(this._toMessage(err));
        },
      });
  }

  /**
   * Resume an in-flight export (e.g. deep-link / page reload into T07 with existing build).
   * Used when the caller already knows the publicacaoId (e.g. from route state).
   */
  resumeExport(projetoId: string, publicacaoId: string, retryAfterMs = DEFAULT_RETRY_MS): void {
    this._projetoId.set(projetoId);
    this._phase.set('gerando');
    this._error.set(null);
    this._stop$.next();
    this._beginPoll(projetoId, publicacaoId, retryAfterMs);
  }

  /**
   * Resume on re-entry from history list (SPEC-04 §3).
   * Reads history for the project; resumes poll if newest entry is non-terminal.
   * Never re-triggers a fresh export build.
   */
  resumeFromHistory(projetoId: string): void {
    this._projetoId.set(projetoId);
    this._phase.set('gerando');
    this._error.set(null);
    this._stop$.next();

    this.api.listByProjeto(projetoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: items => {
          if (!items.length) {
            this._phase.set('error');
            this._error.set('Nenhuma exportação anterior encontrada para este projeto.');
            return;
          }
          const newest = items[0]; // server-ordered newest-first
          if (newest.epubcheckStatus === 'erros_criticos') {
            this._phase.set('erros');
          } else if (newest.epubcheckStatus === 'valido' || newest.epubcheckStatus === 'avisos') {
            this._phase.set('valido');
          } else {
            // pendente = still in-flight — resume polling
            this.resumeExport(projetoId, newest.publicacaoId, DEFAULT_RETRY_MS);
          }
        },
        error: err => {
          this._phase.set('error');
          this._error.set(this._toMessage(err));
        },
      });
  }

  /** Navigate to T08 for the same projetoId after a valid export. */
  baixar(projetoId: string): void {
    this.router.navigate(['/pub/projetos', projetoId, 'download-e-historico']);
  }

  reset(): void {
    this._stop$.next();
    this._phase.set('gerando');
    this._status.set(null);
    this._error.set(null);
    this._projetoId.set(null);
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private _cancelPoll(): void {
    this._stop$.next();
    if (this._phase() === 'gerando') {
      this._phase.set('error');
      this._error.set('A exportação foi cancelada porque a empresa foi alterada. Tente novamente.');
    }
  }

  private _beginPoll(projetoId: string, publicacaoId: string, initialDelayMs: number): void {
    let polls = 0;

    const poll$ = (): Observable<PublicacaoStatus> =>
      timer(initialDelayMs).pipe(
        switchMap(() => this.api.pollStatus(projetoId, publicacaoId)),
        take(1),
      );

    const tick = () => {
      if (polls >= MAX_POLLS) {
        this._phase.set('error');
        this._error.set('Tempo limite de exportação excedido. Tente novamente.');
        return;
      }
      polls++;

      poll$()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: status => {
            this._status.set(status);
            if (isTerminal(status)) {
              this._phase.set(toPhase(status));
            } else {
              tick();
            }
          },
          error: err => {
            this._phase.set('error');
            this._error.set(this._toMessage(err));
          },
        });
    };

    tick();
  }

  private _toMessage(err: unknown): string {
    if (err && typeof err === 'object' && 'message' in err) {
      return String((err as { message: unknown }).message);
    }
    return 'Erro ao exportar. Tente novamente.';
  }
}
