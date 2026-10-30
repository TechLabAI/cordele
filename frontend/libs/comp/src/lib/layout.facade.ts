/**
 * layout.facade.ts — drives the T06 Editor de Layout / Preview screen (signals-based, ADR-007).
 * VM contract: SPEC-03 §2 LayoutVM / SPEC-04 §2 LayoutFacade state machine.
 * FE-COMP-009: forkJoin load, signals, canExport, pessimistic export, stale-override filtering.
 * FE-COMP-025: injects CompShellIntegrationService to emit comp-exported telemetry on success.
 * Track D: created by fe-architect-promote COMP @ cordele (D-494).
 * Updated: FE-COMP-009 (P2) — forkJoin; 409→empty; canExport; onExport pessimistic;
 *          onStyleChange/onAlignmentChange local-only (no network); stale override filtering;
 *          §7.2 defaults; error mapper integration.
 * Updated: FE-COMP-025 (P9) — trackCompExported on export success.
 */
import { DestroyRef, Injectable, inject, signal, computed } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { CompShellIntegrationService } from './comp-shell-integration.service';
import { forkJoin, catchError, of, throwError } from 'rxjs';
import {
  Alinhamento,
  ConfiguracaoLayoutDto,
  FonteCorpoFamilia,
  LayoutOverride,
  PreviewContextDto,
  PreviewNode,
  UpsertLayoutBody,
} from './models/comp.models';
import { LAYOUT_PORT } from './api/layout.port';
import { CompUiError, COMP_URNS, mapCompError, normalizeError } from './comp-error.mapper';

// ── Types ─────────────────────────────────────────────────────────────────────

export type LayoutStatus = 'idle' | 'loading' | 'ready' | 'error' | 'empty';

// ── Layout parameter limits (§7.2 / SPEC-04) ─────────────────────────────────

export const LAYOUT_LIMITS = {
  fonteCorpoTamanho: { min: 8,   max: 24  },
  espacamentoLinha:  { min: 1.0, max: 3.0 },
  margemLateral:     { min: 10,  max: 80  },
  headingTamanho:    { min: 10,  max: 40  },
} as const;

// ── Defaults (§7.2 — serif/12/1.5/20/28/22/18) ───────────────────────────────

const DEFAULT_LAYOUT: ConfiguracaoLayoutDto = {
  fonteCorpoFamilia: 'serif',
  fonteCorpoTamanho: 12,
  espacamentoLinha:  1.5,
  margemLateral:     20,
  h1Tamanho: 28,
  h2Tamanho: 22,
  h3Tamanho: 18,
  materialized: false,
};

// ── Facade ────────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class LayoutFacade {
  private readonly port            = inject(LAYOUT_PORT);
  private readonly router          = inject(Router);
  private readonly destroyRef      = inject(DestroyRef);
  private readonly shellIntegration = inject(CompShellIntegrationService);

  private _projetoId = '';

  // ── Raw state ─────────────────────────────────────────────────────────────
  private readonly _status    = signal<LayoutStatus>('idle');
  private readonly _paginas   = signal<PreviewNode[]>([]);
  private readonly _layout    = signal<ConfiguracaoLayoutDto>({ ...DEFAULT_LAYOUT });
  /** All overrides loaded from the server (some may be stale). */
  private readonly _overrides = signal<LayoutOverride[]>([]);
  private readonly _paginaIdx = signal(0);
  private readonly _saving    = signal(false);
  private readonly _error     = signal<CompUiError | null>(null);
  private readonly _toast     = signal<string | null>(null);

  // ── Public signals ────────────────────────────────────────────────────────
  readonly status    = this._status.asReadonly();
  readonly paginas   = this._paginas.asReadonly();
  readonly layout    = this._layout.asReadonly();
  readonly overrides = this._overrides.asReadonly();
  readonly paginaIdx = this._paginaIdx.asReadonly();
  readonly saving    = this._saving.asReadonly();
  readonly error     = this._error.asReadonly();
  readonly toast     = this._toast.asReadonly();

  readonly paginaAtual = computed(() => this._paginas()[this._paginaIdx()]);

  readonly paragrafos = computed(() => {
    const page = this._paginas()[this._paginaIdx()];
    return (page?.texto ?? '').split('\n\n').filter(Boolean);
  });

  /**
   * Non-stale overrides: those whose nodeId exists in the current page tree.
   * Only tipo='imagem' overrides are ever sent (D-H / ADR-COMP-001).
   */
  readonly nonStaleOverrides = computed(() => {
    const nodeIds = new Set(this._paginas().map(p => p.nodeId));
    return this._overrides().filter(
      (o): o is LayoutOverride & { tipo: 'imagem' } =>
        o.tipo === 'imagem' && nodeIds.has(o.nodeId),
    );
  });

  /**
   * canExport: layout params within limits AND heading hierarchy maintained (h1≥h2≥h3).
   * SPEC-04 §2 / FE-COMP-009.
   */
  readonly canExport = computed(() => {
    const l = this._layout();
    const lim = LAYOUT_LIMITS;
    return (
      l.fonteCorpoTamanho >= lim.fonteCorpoTamanho.min &&
      l.fonteCorpoTamanho <= lim.fonteCorpoTamanho.max &&
      l.espacamentoLinha  >= lim.espacamentoLinha.min  &&
      l.espacamentoLinha  <= lim.espacamentoLinha.max  &&
      l.margemLateral     >= lim.margemLateral.min     &&
      l.margemLateral     <= lim.margemLateral.max     &&
      l.h1Tamanho >= l.h2Tamanho &&
      l.h2Tamanho >= l.h3Tamanho
    );
  });

  // ── Actions ───────────────────────────────────────────────────────────────

  /**
   * Load layout + preview-context in parallel on T06 entry.
   * Uses forkJoin; 409 manuscript-missing on preview → empty state (panel still shown).
   * SPEC-04 §2 [comp-layout-refetch].
   */
  loadData(projetoId: string): void {
    this._projetoId = projetoId;
    this._status.set('loading');
    this._error.set(null);
    this._toast.set(null);
    this._paginaIdx.set(0);

    const layout$ = this.port.getLayout(projetoId);

    // Intercept 409 on preview-context: return null to signal "empty" (no manuscript).
    // Re-throw all other errors so forkJoin surfaces them in the error handler.
    const preview$ = this.port.getPreviewContext(projetoId).pipe(
      catchError((err: unknown) => {
        const appErr = normalizeError(err);
        if (appErr.code === COMP_URNS.manuscriptMissing) {
          return of(null as PreviewContextDto | null);
        }
        return throwError(() => appErr);
      }),
    );

    forkJoin([layout$, preview$])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ([layout, preview]) => {
          this._layout.set(layout);
          if (preview === null) {
            // 409 manuscript-missing → empty state; style panel remains usable.
            this._paginas.set([]);
            this._overrides.set([]);
            this._status.set('empty');
          } else {
            this._paginas.set(preview.arvore);
            this._overrides.set(preview.overrides);
            this._status.set('ready');
          }
        },
        error: (err: unknown) => {
          this._error.set(mapCompError(normalizeError(err)));
          this._status.set('error');
        },
      });
  }

  /** Re-issue the parallel load when the user presses "Tentar novamente". */
  onRetryPreview(): void {
    if (this._projetoId) {
      this.loadData(this._projetoId);
    }
  }

  /**
   * Update a typography parameter locally — NO network call.
   * Clamps to LAYOUT_LIMITS and enforces h1≥h2≥h3.
   * SPEC-04 §2 [comp-no-optimistic].
   */
  onStyleChange<K extends keyof ConfiguracaoLayoutDto>(
    param: K,
    value: ConfiguracaoLayoutDto[K],
  ): void {
    this._layout.update(l => {
      const updated = { ...l, [param]: value };
      return clampAndEnforceLayout(updated);
    });
  }

  /**
   * Update a fonteCorpoFamilia (convenience alias for onStyleChange).
   */
  onFonteFamiliaChange(value: FonteCorpoFamilia): void {
    this._layout.update(l => ({ ...l, fonteCorpoFamilia: value }));
  }

  /**
   * Update the alignment override for an image node — NO network call.
   * Persisted only when the user exports (onExport).
   * SPEC-04 §2 [comp-alignment-writeback] / [comp-no-optimistic].
   */
  onAlignmentChange(nodeId: string, alinhamento: Alinhamento): void {
    // Update the local paginas signal (live preview)
    this._paginas.update(pages =>
      pages.map(p => p.nodeId === nodeId ? { ...p, alinhamento } : p),
    );
    // Upsert the override in the local overrides list (only tipo='imagem')
    this._overrides.update(overrides => {
      const without = overrides.filter(o => o.nodeId !== nodeId);
      return [...without, { nodeId, tipo: 'imagem' as const, alinhamento }];
    });
    // NO network call here — write-back happens on onExport() only.
  }

  /** Navigate to previous page in the preview canvas (no network). */
  onPrevPage(): void {
    this._paginaIdx.update(i => Math.max(0, i - 1));
  }

  /** Navigate to next page in the preview canvas (no network). */
  onNextPage(): void {
    this._paginaIdx.update(i => Math.min(this._paginas().length - 1, i + 1));
  }

  // ── Legacy aliases (backward-compat with P1 prototype components) ─────────

  /** @deprecated Use loadData(). Kept for T06 prototype component compatibility. */
  load(projetoId: string): void { this.loadData(projetoId); }

  /** @deprecated Use onPrevPage(). Kept for T06 prototype component compatibility. */
  anterior(): void { this.onPrevPage(); }

  /** @deprecated Use onNextPage(). Kept for T06 prototype component compatibility. */
  proximo(): void { this.onNextPage(); }

  /** @deprecated Use onStyleChange(). Kept for T06 prototype component compatibility. */
  setLayoutParam<K extends keyof ConfiguracaoLayoutDto>(campo: K, valor: ConfiguracaoLayoutDto[K]): void {
    this.onStyleChange(campo, valor);
  }

  /** @deprecated Use onAlignmentChange(). Kept for T06 prototype component compatibility. */
  setAlinhamento(nodeId: string, alinhamento: Alinhamento): void {
    this.onAlignmentChange(nodeId, alinhamento);
  }

  /**
   * Pessimistic export: PUT layout with non-stale image overrides, then navigate to PUB.
   * Body never includes tipo='em-branco' (D-H / ADR-COMP-001).
   * SPEC-04 §2 [comp-export-persist] / [comp-export-persist-fail].
   */
  onExport(): void {
    if (!this.canExport()) return;

    this._saving.set(true);
    this._toast.set(null);

    const l = this._layout();
    const body: UpsertLayoutBody = {
      fonteCorpoFamilia: l.fonteCorpoFamilia,
      fonteCorpoTamanho: l.fonteCorpoTamanho,
      espacamentoLinha:  l.espacamentoLinha,
      margemLateral:     l.margemLateral,
      h1Tamanho: l.h1Tamanho,
      h2Tamanho: l.h2Tamanho,
      h3Tamanho: l.h3Tamanho,
      // Only non-stale, tipo='imagem' overrides — stale are excluded; never tipo='em-branco'.
      overrides: this.nonStaleOverrides(),
    };

    this.port.upsertLayout(this._projetoId, body)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this._saving.set(false);
          // FE-COMP-025: telemetry — export succeeded; emit before navigation.
          this.shellIntegration.trackCompExported(this._projetoId);
          // Navigate to PUB only after 200 is received (pessimistic).
          void this.router.navigate([
            '/pub', 'projetos', this._projetoId, 'exportacao-e-validacao',
          ]);
        },
        error: (err: unknown) => {
          const uiErr = mapCompError(normalizeError(err));
          this._saving.set(false);   // restore interactive state; local edits preserved
          this._toast.set(uiErr.message || 'Não foi possível exportar. Tente novamente.');
        },
      });
  }
}

// ── Clamping helpers ──────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Clamp layout params to LAYOUT_LIMITS and enforce h1≥h2≥h3 hierarchy.
 * Applied after every onStyleChange call.
 */
function clampAndEnforceLayout(l: ConfiguracaoLayoutDto): ConfiguracaoLayoutDto {
  const { min: hMin, max: hMax } = LAYOUT_LIMITS.headingTamanho;

  let h1 = clamp(l.h1Tamanho, hMin, hMax);
  let h2 = clamp(l.h2Tamanho, hMin, hMax);
  const h3Raw = clamp(l.h3Tamanho, hMin, hMax);

  // Enforce hierarchy: h1≥h2≥h3
  if (h2 < h3Raw) h2 = h3Raw;
  if (h1 < h2) h1 = h2;

  return {
    ...l,
    fonteCorpoTamanho: clamp(l.fonteCorpoTamanho, LAYOUT_LIMITS.fonteCorpoTamanho.min, LAYOUT_LIMITS.fonteCorpoTamanho.max),
    espacamentoLinha:  clamp(l.espacamentoLinha,  LAYOUT_LIMITS.espacamentoLinha.min,  LAYOUT_LIMITS.espacamentoLinha.max),
    margemLateral:     clamp(l.margemLateral,     LAYOUT_LIMITS.margemLateral.min,     LAYOUT_LIMITS.margemLateral.max),
    h1Tamanho: h1,
    h2Tamanho: h2,
    h3Tamanho: h3Raw,
  };
}
