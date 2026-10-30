/**
 * library.facade.ts — drives the T02 Biblioteca de Projetos screen (signals-based, ADR-007).
 * VM contract: SPEC-03 §1 LibraryVM.
 * P2: uses ProjetoApiService (standardised) + EmpresaContextService (empresa-switch).
 * Track D: created by fe-architect-promote PROJ @ cordele (D-494).
 *
 * Pagination (api-contract §4.2 keyset, 2026-09 contract fix):
 *   - load()     resets to page 1 (cursor=null), replaces cards
 *   - loadMore() fetches next page using nextCursor, appends cards
 *   - empresa switch resets pagination and reloads from page 1
 *
 * Degraded signal (api-contract §3):
 *   - _degraded is set from X-Degraded header via ProjetoListResult.degraded
 *   - degraded=true means cross-context aggregation may be incomplete
 *     (author, chapters, epubcheck) — projects themselves are always correct
 *   - UI shows a discrete, honest notice — never hides nor alarms
 */
import { DestroyRef, Injectable, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { lastValueFrom, skip } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { EmpresaContextService } from '@cordele/shared/empresa-context';
import { ProjetoApiService } from './api/projeto-api.service';
import {
  ProjetoCard,
  ProjetoCardVM,
  SignedDownloadUrl,
  deriveBadge,
  deriveOpenTarget,
} from './models/proj.models';

export type LibraryStatus = 'loading' | 'ready' | 'empty' | 'error' | 'loading-more';

@Injectable({ providedIn: 'root' })
export class LibraryFacade {
  private readonly projetoApi  = inject(ProjetoApiService);
  private readonly router      = inject(Router);
  private readonly destroyRef  = inject(DestroyRef);
  private readonly empresaCtx  = inject(EmpresaContextService);

  // ── Raw state ─────────────────────────────────────────────────────────────
  private readonly _status      = signal<LibraryStatus>('loading');
  private readonly _cards       = signal<ProjetoCard[]>([]);
  private readonly _error       = signal<string | null>(null);
  private readonly _degraded    = signal(false);
  private readonly _empresaNome = signal<string>('');
  /** Opaque keyset cursor from last page. null = no more pages (or not loaded yet). */
  private readonly _nextCursor  = signal<string | null>(null);

  // ── Public signals ────────────────────────────────────────────────────────
  readonly status      = this._status.asReadonly();
  readonly degraded    = this._degraded.asReadonly();
  readonly empresaNome = this._empresaNome.asReadonly();
  readonly error       = this._error.asReadonly();
  /** True when the last page has a non-null nextCursor (more pages available). */
  readonly hasMore     = computed(() => this._nextCursor() !== null);

  /** Cards enriched with badge + openTarget (SPEC-03 §1). */
  readonly projects = computed<ProjetoCardVM[]>(() =>
    this._cards().map(card => ({
      ...card,
      badge:            deriveBadge(card.status, card.ultimoEpubcheckStatus),
      canQuickDownload: card.ultimoEpubcheckStatus === 'valido' || card.ultimoEpubcheckStatus === 'avisos',
      openTarget:       deriveOpenTarget(card.status),
    })),
  );

  /**
   * True when status==='empty' (load completed with zero cards).
   * Previously 'ready' && cards.length===0, but those states are mutually exclusive —
   * load() sets status='empty' when cards===[], so isEmpty was always false (P2 tech-debt fix).
   */
  readonly isEmpty = computed(() => this._status() === 'empty');

  constructor() {
    // Empresa-switch: when the active empresa changes (after initial load), cancel in-flight
    // request and re-fetch from page 1 (INT-FE-PROJ-002, P2). skip(1) to avoid double-loading
    // on init since load() handles the initial fetch.
    toObservable(this.empresaCtx.current)
      .pipe(
        skip(1),
        switchMap(() => {
          this._status.set('loading');
          this._error.set(null);
          this._degraded.set(false);
          this._cards.set([]);
          this._nextCursor.set(null);
          return this.projetoApi.listProjetos();
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: result => {
          this._cards.set(result.page.items);
          this._nextCursor.set(result.page.nextCursor);
          this._degraded.set(result.degraded);
          this._status.set(result.page.items.length === 0 ? 'empty' : 'ready');
        },
        error: err => {
          this._error.set((err as { message?: string })?.message ?? 'Erro ao carregar projetos');
          this._status.set('error');
        },
      });
  }

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Initial load — resets to page 1, triggers API fetch for the current empresa.
   * Clears accumulated cards and cursor so retry/refresh always starts clean.
   */
  load(): void {
    this._status.set('loading');
    this._error.set(null);
    this._degraded.set(false);
    this._cards.set([]);
    this._nextCursor.set(null);

    this.projetoApi.listProjetos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this._cards.set(result.page.items);
          this._nextCursor.set(result.page.nextCursor);
          this._degraded.set(result.degraded);
          this._status.set(result.page.items.length === 0 ? 'empty' : 'ready');
        },
        error: err => {
          this._error.set((err as { message?: string })?.message ?? 'Erro ao carregar projetos');
          this._status.set('error');
        },
      });
  }

  retry(): void {
    this.load();
  }

  /**
   * Append the next page to the existing list (cursor-based "load more" pattern).
   * Does nothing when there is no next cursor or when already loading.
   * Degraded flag is OR'd — if any page had degraded data, the session stays degraded.
   */
  loadMore(): void {
    const cursor = this._nextCursor();
    if (!cursor || this._status() === 'loading' || this._status() === 'loading-more') {
      return;
    }

    this._status.set('loading-more');

    this.projetoApi.listProjetos({ cursor })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: result => {
          this._cards.update(prev => [...prev, ...result.page.items]);
          this._nextCursor.set(result.page.nextCursor);
          // Degrade is sticky within a session — if any page was degraded, keep it.
          if (result.degraded) {
            this._degraded.set(true);
          }
          this._status.set('ready');
        },
        error: err => {
          this._error.set((err as { message?: string })?.message ?? 'Erro ao carregar mais projetos');
          this._status.set('error');
        },
      });
  }

  /**
   * Navigate to the project's current stage (SPEC-03 §1 openTarget).
   * imp → /imp/projetos/:id/importar | comp → /comp | history → /proj/projetos/:id/historico
   */
  onOpen(card: ProjetoCardVM): void {
    switch (card.openTarget) {
      case 'imp':     this.router.navigate(['/imp', 'projetos', card.id, 'importar']); break;
      case 'comp':    this.router.navigate(['/comp']);                                   break;
      case 'history': this.router.navigate(['/proj', 'projetos', card.id, 'historico']); break;
    }
  }

  /**
   * Quick download: resolve signed URL and open directly in new tab (D-F — no byte proxy).
   * Only called when canQuickDownload=true (ultimoEpubcheckStatus valido|avisos).
   */
  async onQuickDownload(card: ProjetoCardVM): Promise<void> {
    try {
      // Latest publication ID is not in the card — resolve via publicacoes endpoint.
      const pubs = await lastValueFrom(this.projetoApi.listPublicacoes(card.id));
      const latest = pubs[0];
      if (!latest || !latest.arquivoUrl) return;

      const signed: SignedDownloadUrl = await lastValueFrom(
        this.projetoApi.resolveDownloadUrl(card.id, latest.publicacaoId),
      );
      window.open(signed.arquivoUrl, '_blank', 'noopener,noreferrer');
    // eslint-disable-next-line no-restricted-syntax -- quick-download failure is intentionally silent per UX spec (user retries from the full history view T08). A toast requires product decision about message text and is tracked separately.
    } catch {
      // Non-blocking: quick-download failure is silent (user can try from T08)
    }
  }

  onNewProject(): void {
    this.router.navigate(['/imp', 'upload']);
  }
}
