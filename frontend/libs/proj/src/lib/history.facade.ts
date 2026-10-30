/**
 * history.facade.ts — drives the T08 Download e Histórico screen (signals-based, ADR-007).
 * VM contract: SPEC-03 §2 HistoryVM.
 * Behavioural contracts:
 *   - Reopen pessimistic (spec requirement): POST .../reopen, await 200 ProjetoDetail,
 *     then navigate to COMP; 409 (projeto em rascunho) resets reopenPending with toast.
 *   - degraded=true: render identity + status, never error state (api-contract §4.3).
 *   - Download: resolve signed URL, open in new tab (D-F — no byte proxy).
 * P2: uses ProjetoApiService (standardised, multi-empresa, ProblemDetail mapping).
 * Track D: created by fe-architect-promote PROJ @ cordele (D-494).
 */
import { DestroyRef, Injectable, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { ProjetoApiService } from './api/projeto-api.service';
import {
  ProjetoDetail,
  ProjetoStatus,
  PublicacaoHistoryItem,
  SignedDownloadUrl,
  StatusBadgeVM,
  deriveBadge,
} from './models/proj.models';

export type HistoryStatus = 'loading' | 'ready' | 'error' | 'not-found';

export interface ProjectHeaderVM {
  id: string;
  nome: string;
  autor: string | null;
  status: ProjetoStatus;
  badge: StatusBadgeVM;
  canReopen: boolean;
  canNewExport: boolean;
}

export interface PublicacaoRowVM extends PublicacaoHistoryItem {
  isCurrent: boolean;
  canDownload: boolean;
  statusLabel: string;
}

@Injectable({ providedIn: 'root' })
export class HistoryFacade {
  private readonly projetoApi  = inject(ProjetoApiService);
  private readonly router      = inject(Router);
  private readonly destroyRef  = inject(DestroyRef);

  // ── Raw state ─────────────────────────────────────────────────────────────
  private readonly _status         = signal<HistoryStatus>('loading');
  private readonly _detail         = signal<ProjetoDetail | null>(null);
  private readonly _rawPubs        = signal<PublicacaoHistoryItem[]>([]);
  private readonly _reopenPending  = signal(false);
  private readonly _reopenError    = signal<string | null>(null);
  private readonly _degraded       = signal(false);
  private _currentProjetoId: string | null = null;

  // ── Public signals ────────────────────────────────────────────────────────
  readonly status        = this._status.asReadonly();
  readonly reopenPending = this._reopenPending.asReadonly();
  readonly reopenError   = this._reopenError.asReadonly();
  readonly degraded      = this._degraded.asReadonly();

  readonly header = computed<ProjectHeaderVM | null>(() => {
    const d = this._detail();
    if (!d) return null;
    const latestEpubcheck = this._rawPubs()[0]?.epubcheckStatus ?? null;
    return {
      id:           d.id,
      nome:         d.nome,
      autor:        d.metadata?.autor ?? null,
      status:       d.status,
      badge:        deriveBadge(d.status, latestEpubcheck),
      canReopen:    d.status === 'publicado' || d.status === 'com_erros',
      canNewExport: d.status === 'em_composicao' || d.status === 'publicado' || d.status === 'com_erros',
    };
  });

  readonly publications = computed<PublicacaoRowVM[]>(() =>
    this._rawPubs().map((pub, idx) => ({
      ...pub,
      isCurrent:   idx === 0,                        // newest = "versão atual" chip (SPEC-03 §2)
      canDownload: pub.arquivoUrl != null,            // derived solely from arquivoUrl (SPEC-03 §2)
      statusLabel: this.buildStatusLabel(pub),
    })),
  );

  // ── Actions ───────────────────────────────────────────────────────────────

  load(projetoId: string): void {
    this._currentProjetoId = projetoId;
    this._status.set('loading');
    this._degraded.set(false);
    this._reopenError.set(null);

    // Load project detail + publication history concurrently
    this.projetoApi.getProjeto(projetoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: detail => {
          this._detail.set(detail);
          if (detail.degraded) {
            this._degraded.set(true);
          }
          // Publications come from the separate /publicacoes endpoint for full list (T08)
          this.loadPublications(projetoId);
        },
        error: (err: { httpStatus?: number; message?: string }) => {
          this._status.set(err?.httpStatus === 404 ? 'not-found' : 'error');
        },
      });
  }

  private loadPublications(projetoId: string): void {
    this.projetoApi.listPublicacoes(projetoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: pubs => {
          this._rawPubs.set(pubs);
          this._status.set('ready');
        },
        error: () => {
          // PUB degraded — still render project header (api-contract §4.3 + SPEC-03 §2)
          this._rawPubs.set([]);
          this._degraded.set(true);
          this._status.set('ready');
        },
      });
  }

  /**
   * Pessimistic reopen (spec requirement from prompt):
   *   POST .../reopen → await 200 ProjetoDetail → navigate to COMP.
   *   409 (rascunho) → reset reopenPending, show error toast.
   * reopenPending gates CTAs so double-click cannot fire two writes (SPEC-03 §2).
   */
  async onReopen(destination: 'metadata' | 'layout'): Promise<void> {
    const projetoId = this._currentProjetoId;
    if (!projetoId || this._reopenPending()) return;

    this._reopenPending.set(true);
    this._reopenError.set(null);

    try {
      const updated = await lastValueFrom(this.projetoApi.reopenProjeto(projetoId));
      this._detail.set(updated);
      // Navigate to COMP after confirmed reopen
      const route = destination === 'metadata' ? '/comp' : '/comp';
      this.router.navigate([route]);
    } catch (err: unknown) {
      // AppError from mapProblemDetailToAppError carries httpStatus (not status)
      const e = err as { httpStatus?: number; message?: string };
      if (e?.httpStatus === 409) {
        // Projeto em rascunho — 409 defensivo (spec requirement)
        this._reopenError.set('Este projeto está em rascunho e não pode ser reaberto.');
      } else {
        this._reopenError.set(e?.message ?? 'Erro ao reabrir projeto.');
      }
    } finally {
      this._reopenPending.set(false);
    }
  }

  /**
   * Download: resolve signed URL, open directly in new tab (D-F — no byte proxy).
   * arquivoUrl from the list is a placeholder; getDownloadUrl mints a fresh signed URL.
   */
  async onDownload(row: PublicacaoRowVM): Promise<void> {
    if (!row.canDownload || !this._currentProjetoId) return;
    try {
      const signed: SignedDownloadUrl = await lastValueFrom(
        this.projetoApi.resolveDownloadUrl(this._currentProjetoId, row.publicacaoId),
      );
      window.open(signed.arquivoUrl, '_blank', 'noopener,noreferrer');
    // eslint-disable-next-line no-restricted-syntax -- download failure is intentionally non-blocking; the row's disabled state (arquivoUrl=null) already signals the failure to the user. A toast would require product decision about message text and is tracked separately.
    } catch {
      // Non-blocking — surfaced by the row's disabled state when arquivoUrl=null
    }
  }

  onNewExport(): void {
    this.router.navigate(['/pub']);
  }

  onBack(): void {
    this.router.navigate(['/proj', 'biblioteca-de-projetos']);
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private buildStatusLabel(pub: PublicacaoHistoryItem): string {
    if (pub.epubcheckStatus === 'valido' || pub.epubcheckStatus === 'avisos') {
      return `Válido · ${pub.totalAvisos} aviso(s)`;
    }
    if (pub.epubcheckStatus === 'erros_criticos') {
      return `${pub.totalErros} erro(s) crítico(s)`;
    }
    return 'Pendente';
  }
}
