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
import { tap } from 'rxjs';
import { ArtifactDownloadService } from './artifact-download.service';
import { PUB_BREADCRUMB } from './pub-breadcrumb.token';
import { PublicacaoApiService } from './publicacao-api.service';
import { ProjetoHeaderInfo, PublicacaoHistoryItem, PublicationStats } from './models/pub.models';

/**
 * Extract the X-Correlation-Id from a raw error object (FE-PUB-024).
 * Checks AppError.correlationId first; falls back to HttpErrorResponse.headers.
 * Returns null when neither is available (network errors without a backend response).
 */
function extractTraceId(err: unknown): string | null {
  if (!err || typeof err !== 'object') return null;
  const e = err as Record<string, unknown>;
  if (typeof e['correlationId'] === 'string') return e['correlationId'];
  const headers = e['headers'] as { get?: (k: string) => string | null } | undefined;
  if (headers && typeof headers.get === 'function') {
    return headers.get('x-correlation-id');
  }
  return null;
}

export type HistoryStatus = 'idle' | 'loading' | 'loaded' | 'error';

@Injectable({ providedIn: 'root' })
export class HistoryFacade {
  private readonly api        = inject(PublicacaoApiService);
  private readonly downloader = inject(ArtifactDownloadService);
  private readonly destroyRef = inject(DestroyRef);
  /**
   * Telemetry breadcrumb callback (FE-PUB-026 / P8).
   * Optional: no-op default factory in token; real impl wired in app.config.ts.
   * Called with 'downloaded' after ArtifactDownloadService emits {status:'success'}.
   */
  private readonly breadcrumb = inject(PUB_BREADCRUMB, { optional: true });

  // ── Raw state ─────────────────────────────────────────────────────────────
  private readonly _status          = signal<HistoryStatus>('idle');
  private readonly _lista           = signal<PublicacaoHistoryItem[]>([]);
  private readonly _stats           = signal<PublicationStats | null>(null);
  private readonly _error           = signal<string | null>(null);
  private readonly _errorTraceId    = signal<string | null>(null);
  private readonly _downloading     = signal<string | null>(null);
  private readonly _downloadError   = signal<string | null>(null);
  private readonly _downloadTraceId = signal<string | null>(null);
  /**
   * FE-PUB-025: inline notice shown while a signed-URL re-fetch is in progress.
   * ToastService is not available in @cordele/shared/ui-feedback (stub).
   * An inline signal is used instead — displayed in the component as a notice banner.
   * Set to null once the download succeeds or fails.
   */
  private readonly _refetchNotice   = signal<string | null>(null);
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
  /**
   * X-Correlation-Id from the last failed list/load request (FE-PUB-024 / SPEC-07 §4).
   * Null when no error is active or when the backend did not return a trace header.
   */
  readonly errorTraceId    = this._errorTraceId.asReadonly();
  /** publicacaoId currently requesting download, null otherwise. */
  readonly downloading     = this._downloading.asReadonly();
  /** Inline download error message (per-row, not a global banner). */
  readonly downloadError   = this._downloadError.asReadonly();
  /**
   * X-Correlation-Id from the last failed download request (FE-PUB-024).
   * Displayed in the download error banner for support reference.
   */
  readonly downloadTraceId = this._downloadTraceId.asReadonly();
  /**
   * FE-PUB-025: Non-null while a re-fetch of an expired signed URL is in progress.
   * Displayed as an informational inline notice (not an error).
   * Cleared once the download succeeds or fails.
   */
  readonly refetchNotice   = this._refetchNotice.asReadonly();
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
    this._errorTraceId.set(null);
    this._downloadError.set(null);
    this._downloadTraceId.set(null);
    this._refetchNotice.set(null);

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
          this._errorTraceId.set(extractTraceId(err));
          this._error.set(this._toMessage(err));
        },
      });
  }

  /**
   * Mint a signed URL and open the download in a new tab (D-F).
   * The SPA never proxies bytes. Gate: only called when podeBaixar is true.
   * On expiry, ArtifactDownloadService emits {status:'refetching'} before the re-fetch
   * so this facade can display an inline notice (FE-PUB-025; no ToastService available).
   * After the re-fetch, emits {status:'success'} or throws on second failure.
   */
  download(projetoId: string, publicacaoId: string): void {
    this._downloading.set(publicacaoId);
    this._downloadError.set(null);
    this._downloadTraceId.set(null);
    this._refetchNotice.set(null);

    this.downloader.download(projetoId, publicacaoId)
      .pipe(
        tap(result => {
          if (result.status === 'refetching') {
            // FE-PUB-025: signed URL expired — inform the user before the second attempt.
            // ToastService is absent from @cordele/shared/ui-feedback (stub v0.0.0);
            // inline signal displayed as a notice banner in the component.
            this._refetchNotice.set('O link de download expirou. Gerando um novo link…');
          }
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: result => {
          if (result.status === 'success') {
            this._downloading.set(null);
            this._refetchNotice.set(null);
            // FE-PUB-026 (P8): emit telemetry event when signed URL successfully opened.
            this.breadcrumb?.('downloaded', projetoId);
          }
          // 'refetching' emissions are handled by tap above; nothing to do in next for them.
        },
        error: err => {
          this._downloading.set(null);
          this._refetchNotice.set(null);
          this._downloadTraceId.set(extractTraceId(err));
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
