/**
 * history.facade.ts — Drives the T08 Download e Histórico flow (signals-based, ADR-007).
 *
 * Contracts honoured:
 *   - Download via signed URL (D-F): getDownloadUrl → window.open(arquivoUrl, '_blank').
 *   - podeBaixar per row: epubcheckStatus ∈ {valido, avisos} (no arquivoDisponivel flag on history items).
 *   - KPI tiles: getStats() called to load PublicationStats; null fields → tile hidden (INT-FE-PUB-005).
 *   - INT-FE-PUB-004: avisos detail NOT called (§4.6 blocked).
 *
 * Track D: created by fe-architect-promote PUB @ cordele (D-494).
 */
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PUBLICACAO_PORT } from './api/publicacao.port';
import { PublicacaoHistoryItem, PublicationStats } from './models/pub.models';

export type HistoryStatus = 'idle' | 'loading' | 'loaded' | 'error';

@Injectable({ providedIn: 'root' })
export class HistoryFacade {
  private readonly port       = inject(PUBLICACAO_PORT);
  private readonly destroyRef = inject(DestroyRef);

  // ── Raw state ─────────────────────────────────────────────────────────────
  private readonly _status      = signal<HistoryStatus>('idle');
  private readonly _lista       = signal<PublicacaoHistoryItem[]>([]);
  private readonly _stats       = signal<PublicationStats | null>(null);
  private readonly _error       = signal<string | null>(null);
  private readonly _downloading = signal<string | null>(null);

  // ── Public readonly signals ───────────────────────────────────────────────
  readonly status      = this._status.asReadonly();
  readonly lista       = this._lista.asReadonly();
  readonly stats       = this._stats.asReadonly();
  readonly error       = this._error.asReadonly();
  /** publicacaoId currently requesting download, null otherwise. */
  readonly downloading = this._downloading.asReadonly();

  readonly isEmpty = computed(() => this._lista().length === 0 && this._status() === 'loaded');

  // ── Actions ───────────────────────────────────────────────────────────────

  /** Load publication history + live stats for a project. */
  load(projetoId: string): void {
    this._status.set('loading');
    this._error.set(null);

    this.port.list(projetoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: lista => {
          this._lista.set(lista);
          this._status.set('loaded');
          // Load stats independently (non-blocking; tiles hidden if null — INT-FE-PUB-005)
          this._loadStats(projetoId);
        },
        error: err => {
          this._status.set('error');
          this._error.set(this._toMessage(err));
        },
      });
  }

  /**
   * Mint a signed URL and open the download in a new tab (D-F).
   * The SPA never proxies bytes.
   */
  download(projetoId: string, publicacaoId: string): void {
    this._downloading.set(publicacaoId);

    this.port.getDownloadUrl(projetoId, publicacaoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: signed => {
          this._downloading.set(null);
          window.open(signed.arquivoUrl, '_blank', 'noopener,noreferrer');
        },
        error: err => {
          this._downloading.set(null);
          // Non-fatal — row stays actionable; error surfaced via toast (FE-PUB-024, Layer 2)
          console.error('[HistoryFacade] download error', err);
        },
      });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _loadStats(projetoId: string): void {
    this.port.getStats(projetoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  stats => this._stats.set(stats),
        error: ()    => this._stats.set(null),  // tiles silently hidden on error (INT-FE-PUB-005)
      });
  }

  private _toMessage(err: unknown): string {
    if (err && typeof err === 'object' && 'message' in err) {
      return String((err as { message: unknown }).message);
    }
    return 'Erro ao carregar histórico. Tente novamente.';
  }
}
