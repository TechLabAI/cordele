/**
 * layout.facade.ts — drives the T06 Editor de Layout / Preview screen (signals-based, ADR-007).
 * VM contract: SPEC-03 §2 LayoutVM / PreviewVM.
 * Track D: created by fe-architect-promote COMP @ cordele (D-494).
 */
import { DestroyRef, Injectable, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  Alinhamento,
  ConfiguracaoLayoutDto,
  LayoutOverride,
  PreviewNode,
} from './models/comp.models';
import { LAYOUT_PORT } from './api/layout.port';

export type LayoutStatus = 'idle' | 'loading' | 'ready' | 'error';

const DEFAULT_LAYOUT: ConfiguracaoLayoutDto = {
  fonteCorpoFamilia: 'serif',
  fonteCorpoTamanho: 16,
  espacamentoLinha: 1.6,
  margemLateral: 48,
  h1Tamanho: 28,
  h2Tamanho: 22,
  h3Tamanho: 18,
  materialized: false,
};

@Injectable({ providedIn: 'root' })
export class LayoutFacade {
  private readonly port       = inject(LAYOUT_PORT);
  private readonly destroyRef = inject(DestroyRef);

  // ── Raw state ─────────────────────────────────────────────────────────────
  private readonly _status    = signal<LayoutStatus>('idle');
  private readonly _paginas   = signal<PreviewNode[]>([]);
  private readonly _layout    = signal<ConfiguracaoLayoutDto>({ ...DEFAULT_LAYOUT });
  private readonly _overrides = signal<LayoutOverride[]>([]);
  private readonly _error     = signal<string | null>(null);
  private _projetoId          = '';

  // ── Public signals ────────────────────────────────────────────────────────
  readonly status   = this._status.asReadonly();
  readonly paginas  = this._paginas.asReadonly();
  readonly layout   = this._layout.asReadonly();
  readonly error    = this._error.asReadonly();

  /** Paragraphs of the currently displayed page (capitulo only). */
  readonly paragrafos = computed(() => {
    const page = this._paginas()[this._paginaIdx()];
    return (page?.texto ?? '').split('\n\n').filter(Boolean);
  });

  private readonly _paginaIdx = signal(0);
  readonly paginaIdx  = this._paginaIdx.asReadonly();
  readonly paginaAtual = computed(() => this._paginas()[this._paginaIdx()]);

  // ── Actions ───────────────────────────────────────────────────────────────

  load(projetoId: string): void {
    this._projetoId = projetoId;
    this._status.set('loading');
    this._error.set(null);
    this._paginaIdx.set(0);

    this.port.getPreviewContext(projetoId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ctx => {
          this._paginas.set(ctx.arvore);
          this._layout.set(ctx.layout);
          this._overrides.set(ctx.overrides);
          this._status.set('ready');
        },
        error: err => {
          this._error.set(err?.message ?? 'Erro ao carregar preview');
          this._status.set('error');
        },
      });
  }

  anterior(): void {
    this._paginaIdx.update(i => Math.max(0, i - 1));
  }

  proximo(): void {
    this._paginaIdx.update(i => Math.min(this._paginas().length - 1, i + 1));
  }

  /**
   * Update image alignment override for the current page.
   * Persists via PUT /layout (SPEC-04 §2 alignment write).
   */
  setAlinhamento(nodeId: string, alinhamento: Alinhamento): void {
    // Update local paginas signal
    this._paginas.update(pages =>
      pages.map(p => p.nodeId === nodeId ? { ...p, alinhamento } : p),
    );

    // Persist to backend
    const existingOverrides = this._overrides().filter(o => o.nodeId !== nodeId);
    const newOverride: LayoutOverride = { nodeId, tipo: 'imagem', alinhamento };
    this._overrides.set([...existingOverrides, newOverride]);

    this.port.updateLayout(this._projetoId, this._layout())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => { /* non-blocking, optimistic */ } });
  }

  setLayoutParam<K extends keyof ConfiguracaoLayoutDto>(campo: K, valor: ConfiguracaoLayoutDto[K]): void {
    this._layout.update(l => ({ ...l, [campo]: valor }));
    // Debounce persistence handled by Layer 2 (FE-COMP-018)
  }

  /** Persist current layout config (called on navigation away / Exportar). */
  persistLayout(): void {
    if (!this._projetoId) return;
    this.port.updateLayout(this._projetoId, this._layout())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => { /* non-blocking */ } });
  }
}
