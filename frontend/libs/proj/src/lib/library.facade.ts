/**
 * library.facade.ts — drives the T02 Biblioteca de Projetos screen (signals-based, ADR-007).
 * VM contract: SPEC-03 §1 LibraryVM.
 * Track D: created by fe-architect-promote PROJ @ cordele (D-494).
 */
import { DestroyRef, Injectable, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { lastValueFrom } from 'rxjs';
import { PROJETO_PORT } from './api/projeto.port';
import { PUBLICACAO_PORT } from './api/publicacao.port';
import {
  ProjetoCard,
  ProjetoCardVM,
  SignedDownloadUrl,
  deriveBadge,
  deriveOpenTarget,
} from './models/proj.models';

export type LibraryStatus = 'loading' | 'ready' | 'empty' | 'error';

@Injectable({ providedIn: 'root' })
export class LibraryFacade {
  private readonly projetoPort   = inject(PROJETO_PORT);
  private readonly publicacaoPort = inject(PUBLICACAO_PORT);
  private readonly router        = inject(Router);
  private readonly destroyRef    = inject(DestroyRef);

  // ── Raw state ─────────────────────────────────────────────────────────────
  private readonly _status    = signal<LibraryStatus>('loading');
  private readonly _cards     = signal<ProjetoCard[]>([]);
  private readonly _error     = signal<string | null>(null);
  private readonly _degraded  = signal(false);
  private readonly _empresaNome = signal<string>('');

  // ── Public signals ────────────────────────────────────────────────────────
  readonly status     = this._status.asReadonly();
  readonly degraded   = this._degraded.asReadonly();
  readonly empresaNome = this._empresaNome.asReadonly();
  readonly error      = this._error.asReadonly();

  /** Cards enriched with badge + openTarget (SPEC-03 §1). */
  readonly projects = computed<ProjetoCardVM[]>(() =>
    this._cards().map(card => ({
      ...card,
      badge:           deriveBadge(card.status, card.ultimoEpubcheckStatus),
      canQuickDownload: card.ultimoEpubcheckStatus === 'valido' || card.ultimoEpubcheckStatus === 'avisos',
      openTarget:      deriveOpenTarget(card.status),
    })),
  );

  /** True only when status==='ready' && projects empty — prevents empty-state flicker (SPEC-03 §1). */
  readonly isEmpty = computed(() => this._status() === 'ready' && this._cards().length === 0);

  // ── Actions ───────────────────────────────────────────────────────────────

  load(): void {
    this._status.set('loading');
    this._error.set(null);
    this._degraded.set(false);

    this.projetoPort.list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: cards => {
          this._cards.set(cards);
          this._status.set(cards.length === 0 ? 'empty' : 'ready');
        },
        error: err => {
          this._error.set(err?.message ?? 'Erro ao carregar projetos');
          this._status.set('error');
        },
      });
  }

  retry(): void {
    this.load();
  }

  /**
   * Navigate to the project's current stage (SPEC-03 §1 openTarget).
   * imp → /imp/upload | comp → /comp | history → /proj/projetos/:id/historico
   */
  onOpen(card: ProjetoCardVM): void {
    switch (card.openTarget) {
      case 'imp':     this.router.navigate(['/imp', 'projetos', card.id, 'importar']); break;
      case 'comp':    this.router.navigate(['/comp']);                                  break;
      case 'history': this.router.navigate(['/proj', 'projetos', card.id, 'historico']); break;
    }
  }

  /**
   * Quick download: resolve signed URL and open directly in new tab (D-F — no byte proxy).
   * Only called when canQuickDownload=true (arquivoUrl exists for latest publication).
   */
  async onQuickDownload(card: ProjetoCardVM): Promise<void> {
    try {
      // Latest publication ID is not in the card — we resolve via history endpoint.
      // For T02 quick-download we get the first publicacao from the list.
      const pubs = await lastValueFrom(this.publicacaoPort.list(card.id));
      const latest = pubs[0];
      if (!latest || !latest.arquivoUrl) return;

      const signed: SignedDownloadUrl = await lastValueFrom(
        this.publicacaoPort.getDownloadUrl(card.id, latest.publicacaoId),
      );
      window.open(signed.arquivoUrl, '_blank', 'noopener,noreferrer');
    } catch {
      // Non-blocking: quick-download failure is silent (user can try from T08)
    }
  }

  onNewProject(): void {
    this.router.navigate(['/imp', 'upload']);
  }
}
