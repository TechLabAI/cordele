/**
 * export.facade.ts — Drives the T07 Exportação e Validação flow (signals-based, ADR-007).
 *
 * Contracts honoured:
 *   - Bounded poll: POST 202 + GET status with Retry-After (D-N; no SSE, no setInterval).
 *   - Progress is always indeterminate — PublicacaoStatus carries no percentage (D-N, SPEC-03).
 *   - podeBaixar = computed(epubcheckStatus ∈ {valido, avisos} AND arquivoDisponivel) — R4.
 *   - KPI tiles (Tamanho/Páginas/Capítulos/Imagens): no field in api-contract → always null → tiles hidden (INT-FE-PUB-005).
 *   - Avisos detail (§4.6): NOT called — INT-FE-PUB-004 BLOCKED (PUB-016 not ratified).
 *   - setInterval: never used — see FE-PUB-012 removal requirement.
 *
 * Poll strategy: timer(retryAfterMs) → pollStatus → repeat until terminal.
 * Max 60 polls before self-cancelling (safety cap, never infinite).
 *
 * Track D: created by fe-architect-promote PUB @ cordele (D-494).
 */
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Observable, Subject, switchMap, take, timer } from 'rxjs';
import { PUBLICACAO_PORT } from './api/publicacao.port';
import { ExportPhase, PublicacaoStatus } from './models/pub.models';

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
  private readonly port       = inject(PUBLICACAO_PORT);
  private readonly router     = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  // ── Raw state ─────────────────────────────────────────────────────────────
  private readonly _phase        = signal<ExportPhase>('gerando');
  private readonly _status       = signal<PublicacaoStatus | null>(null);
  private readonly _error        = signal<string | null>(null);
  private readonly _projetoId    = signal<string | null>(null);

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

  // ── Poll control ──────────────────────────────────────────────────────────
  private readonly _stop$ = new Subject<void>();

  // ── Actions ───────────────────────────────────────────────────────────────

  /** Trigger a new export build, then start the bounded poll loop. */
  startExport(projetoId: string): void {
    this._projetoId.set(projetoId);
    this._phase.set('gerando');
    this._error.set(null);
    this._status.set(null);
    this._stop$.next(); // cancel any previous poll

    this.port.triggerExport(projetoId)
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

  /** Resume an in-flight export (e.g. deep-link / page reload into T07 with existing build). */
  resumeExport(projetoId: string, publicacaoId: string, retryAfterMs = DEFAULT_RETRY_MS): void {
    this._projetoId.set(projetoId);
    this._phase.set('gerando');
    this._error.set(null);
    this._stop$.next();
    this._beginPoll(projetoId, publicacaoId, retryAfterMs);
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

  // ── Private poll loop ─────────────────────────────────────────────────────

  private _beginPoll(projetoId: string, publicacaoId: string, initialDelayMs: number): void {
    let polls = 0;

    const poll$ = (): Observable<PublicacaoStatus> =>
      timer(initialDelayMs).pipe(
        switchMap(() => this.port.pollStatus(projetoId, publicacaoId)),
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
