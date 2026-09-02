/**
 * history.facade.ts — Drives the T08 Download e Histórico flow (signals-based, ADR-007).
 * Migrated from libs/pub (flat lib) to libs/pub/data-access (P2 — FE-PUB-007).
 *
 * Contracts honoured:
 *   - Download via signed URL (D-F): ArtifactDownloadService → window.open(arquivoUrl, '_blank').
 *   - podeBaixar per row: epubcheckStatus ∈ {valido, avisos} (no arquivoDisponivel flag on history items).
 *   - KPI tiles: getStats() called to load PublicationStats; null fields → tile hidden (INT-FE-PUB-005).
 *   - INT-FE-PUB-004: avisos detail NOT called (§4.6 blocked).
 *
 * Cross-context (INT-FE-PUB-002/003, P4):
 *   - projetoHeader loaded lazily via PublicacaoApiService.getProjetoHeader() (INT-FE-PUB-002).
 *     Returns null from the default stub; real wiring requires injection token in app.config.ts
 *     (cannot import scope:proj from scope:pub per Nx boundary rules).
 *   - autor loaded lazily via PublicacaoApiService.getAutor() (INT-FE-PUB-003).
 *     Returns null from the default stub; real wiring requires injection token in app.config.ts
 *     (cannot import scope:comp from scope:pub per Nx boundary rules).
 *   Both signals degrade gracefully to null — components render without header/autor.
 */
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ArtifactDownloadService } from './artifact-download.service';
import { PublicacaoApiService } from './publicacao-api.service';
import { ProjetoHeaderInfo, PublicacaoHistoryItem, PublicationStats } from './models/pub.models';

export type HistoryStatus = 'idle' | 'loading' | 'loaded' | 'error';

@Injectable({ providedIn: 'root' })
export class HistoryFacade {
  private readonly api        = inject(PublicacaoApiService);
  private readonly downloader = inject(ArtifactDownloadService);
  private readonly destroyRef = inject(DestroyRef);

  // ── Raw state ─────────────────────────────────────────────────────────────
  private readonly _status        = signal<HistoryStatus>('idle');
  private readonly _lista         = signal<PublicacaoHistoryItem[]>([]);
  private readonly _stats         = signal<PublicationStats | null>(null);
  private readonly _error         = signal<string | null>(null);
  private readonly _downloading   = signal<string | null>(null);
  private readonly _downloadError = signal<string | null>(null);
  /**
   * INT-FE-PUB-002 (P4): project header info from cross-context call to proj-service.
   * Loaded lazily in load(). Null when stub is active (no override injection token in app.config.ts).
   * Components must render gracefully when null.
   */
  private readonly _projetoHeader = signal<ProjetoHeaderInfo | null>(null);
  /**
   * INT-FE-PUB-003 (P4): autor string from cross-context call to comp-service.
   * Loaded lazily in load(). Null when stub is active (no override injection token in app.config.ts).
   * Components must render gracefully when null.
   */
  private readonly _autor         = signal<string | null>(null);

  // ── Public readonly signals ───────────────────────────────────────────────
  readonly status        = this._status.asReadonly();
  readonly lista         = this._lista.asReadonly();
  readonly stats         = this._stats.asReadonly();
  readonly error         = this._error.asReadonly();
  /** publicacaoId currently requesting download, null otherwise. */
  readonly downloading   = this._downloading.asReadonly();
  /** Inline download error message (per-row, not a global banner). */
  readonly downloadError = this._downloadError.asReadonly();
  /**
   * INT-FE-PUB-002 (P4): project header from proj-service cross-context call.
   * Null until real wiring is provided via injection token in app.config.ts.
   */
  readonly projetoHeader = this._projetoHeader.asReadonly();
  /**
   * INT-FE-PUB-003 (P4): autor from comp-service cross-context call.
   * Null until real wiring is provided via injection token in app.config.ts.
   */
  readonly autor         = this._autor.asReadonly();

  readonly isEmpty = computed(() => this._lista().length === 0 && this._status() === 'loaded');

  // ── Actions ───────────────────────────────────────────────────────────────

  /** Load publication history + live stats + cross-context header/autor for a project. */
  load(projetoId: string): void {
    this._status.set('loading');
    this._error.set(null);
    this._downloadError.set(null);

    this.api.listByProjeto(projetoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: lista => {
          this._lista.set(lista);
          this._status.set('loaded');
          // Load stats independently (non-blocking; tiles hidden if null — INT-FE-PUB-005)
          this._loadStats(projetoId);
          // INT-FE-PUB-002/003 (P4): lazy cross-context calls — non-blocking, graceful null.
          this._loadProjetoHeader(projetoId);
          this._loadAutor(projetoId);
        },
        error: err => {
          this._status.set('error');
          this._error.set(this._toMessage(err));
        },
      });
  }

  /**
   * Mint a signed URL and open the download in a new tab (D-F).
   * The SPA never proxies bytes. Gate: only called when podeBaixar is true.
   * On expiry, ArtifactDownloadService auto-refetches once (SPEC-04 §4.4).
   */
  download(projetoId: string, publicacaoId: string): void {
    this._downloading.set(publicacaoId);
    this._downloadError.set(null);

    this.downloader.download(projetoId, publicacaoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: _result => {
          this._downloading.set(null);
        },
        error: err => {
          this._downloading.set(null);
          // Inline error on the row (SPEC-07: artifact-not-available or expired link)
          this._downloadError.set(this._toMessage(err));
        },
      });
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private _loadStats(projetoId: string): void {
    this.api.getStats(projetoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  stats => this._stats.set(stats),
        error: ()    => this._stats.set(null),  // tiles silently hidden on error (INT-FE-PUB-005)
      });
  }

  /**
   * INT-FE-PUB-002 (P4): lazy cross-context call for project header.
   * Calls PublicacaoApiService.getProjetoHeader() which defaults to null stub.
   * Components render gracefully when projetoHeader() is null.
   */
  private _loadProjetoHeader(projetoId: string): void {
    this.api.getProjetoHeader(projetoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  header => this._projetoHeader.set(header),
        error: ()      => this._projetoHeader.set(null),  // non-critical — degrade gracefully
      });
  }

  /**
   * INT-FE-PUB-003 (P4): lazy cross-context call for autor from comp-service metadados.
   * Calls PublicacaoApiService.getAutor() which defaults to null stub.
   * Components render gracefully when autor() is null.
   */
  private _loadAutor(projetoId: string): void {
    this.api.getAutor(projetoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next:  autor => this._autor.set(autor),
        error: ()     => this._autor.set(null),  // non-critical — degrade gracefully
      });
  }

  private _toMessage(err: unknown): string {
    if (err && typeof err === 'object' && 'message' in err) {
      return String((err as { message: unknown }).message);
    }
    return 'Erro ao carregar histórico. Tente novamente.';
  }
}
