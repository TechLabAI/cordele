/**
 * epub-summary-grid.component.ts — FE-PUB-015 — Grid de KPIs do ePub.
 *
 * Section A — Publication stats (total / publicadas / comAvisos / comErros):
 *   Shown when ALL four inputs are non-null. Inputs come from PublicationStats (§6.3).
 *
 * Section B — ePub KPI tiles (INT-FE-PUB-005 resolved — ADR-004 / api-contract §6.1):
 *   tamanho: formatted size string (e.g. "1.4 MB"); null → tile hidden.
 *   capitulos: chapter count; null → tile hidden.
 *   imagens: image count; null → tile hidden.
 *   paginas: PERMANENTLY absent from the grid — ADR-004 (ePub reflowable, no fixed pagination).
 *   Each tile is null-safe: shown only when its value is non-null (never "N/D" or "--").
 *
 * Boundary: type:ui — accepts only primitives; does NOT import type:data-access.
 *
 * Track D: FE-PUB-015 — P3 Feature Libs.
 */
import {
  ChangeDetectionStrategy,
  Component,
  Input,
} from '@angular/core';

@Component({
  selector: 'pub-epub-summary-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Section A: Publication stats (total / publicadas / comAvisos / comErros) -->
    @if (hasStats) {
      <div class="grid grid-cols-2 gap-3 mb-6" role="list" aria-label="Estatísticas de publicação">
        <div class="rounded-xl p-4" style="background:var(--bg-surface);border:1px solid var(--border-subtle);" role="listitem">
          <p class="text-xs font-medium mb-1" style="color:var(--text-tertiary)">Total de exportações</p>
          <p class="text-2xl font-bold" style="color:var(--text-primary)">{{ total }}</p>
        </div>
        <div class="rounded-xl p-4" style="background:var(--bg-surface);border:1px solid var(--border-subtle);" role="listitem">
          <p class="text-xs font-medium mb-1" style="color:var(--text-tertiary)">Publicadas com sucesso</p>
          <p class="text-2xl font-bold" style="color:oklch(32% 0.14 145)">{{ publicadas }}</p>
        </div>
        <div class="rounded-xl p-4" style="background:var(--bg-surface);border:1px solid var(--border-subtle);" role="listitem">
          <p class="text-xs font-medium mb-1" style="color:var(--text-tertiary)">Com avisos</p>
          <p class="text-2xl font-bold" style="color:oklch(45% 0.14 75)">{{ comAvisos }}</p>
        </div>
        <div class="rounded-xl p-4" style="background:var(--bg-surface);border:1px solid var(--border-subtle);" role="listitem">
          <p class="text-xs font-medium mb-1" style="color:var(--text-tertiary)">Com erros</p>
          <p class="text-2xl font-bold" style="color:var(--color-error)">{{ comErros }}</p>
        </div>
      </div>
    }

    <!-- Section B: ePub KPI tiles (INT-FE-PUB-005 — each tile hidden when null) -->
    @if (hasKpis) {
      <div class="grid grid-cols-2 gap-3 mb-4" role="list" aria-label="KPIs do ePub gerado">
        @if (tamanho !== null) {
          <div class="rounded-xl p-4" style="background:var(--bg-surface);border:1px solid var(--border-subtle);" role="listitem">
            <p class="text-xs font-medium mb-1" style="color:var(--text-tertiary)">Tamanho do arquivo</p>
            <p class="text-2xl font-bold" style="color:var(--text-primary)">{{ tamanho }}</p>
          </div>
        }
        @if (capitulos !== null) {
          <div class="rounded-xl p-4" style="background:var(--bg-surface);border:1px solid var(--border-subtle);" role="listitem">
            <p class="text-xs font-medium mb-1" style="color:var(--text-tertiary)">Capítulos</p>
            <p class="text-2xl font-bold" style="color:var(--text-primary)">{{ capitulos }}</p>
          </div>
        }
        @if (imagens !== null) {
          <div class="rounded-xl p-4" style="background:var(--bg-surface);border:1px solid var(--border-subtle);" role="listitem">
            <p class="text-xs font-medium mb-1" style="color:var(--text-tertiary)">Imagens</p>
            <p class="text-2xl font-bold" style="color:var(--text-primary)">{{ imagens }}</p>
          </div>
        }
        <!-- paginas tile ABSENT by design — ADR-004: ePub reflowable has no fixed pagination -->
      </div>
    }

    <!-- Empty state — shown when NEITHER stats NOR KPI tiles have data to display.
         Never omit silently (plan P3 rule: "renderizar estado vazio explícito"). -->
    @if (isEmpty) {
      <div class="rounded-xl p-4 mb-4 text-center text-sm"
           style="background:var(--bg-surface);border:1px dashed var(--border-subtle);color:var(--text-tertiary);"
           aria-label="Estatísticas indisponíveis">
        Estatísticas de ePub indisponíveis
      </div>
    }
  `,
})
export class EpubSummaryGridComponent {
  // ── Section A: Publication stats ─────────────────────────────────────────
  /** Total de publicações do projeto. */
  @Input() total:      number | null = null;
  /** Publicações com status valido|avisos. */
  @Input() publicadas: number | null = null;
  /** Publicações com avisos não-bloqueantes. */
  @Input() comAvisos:  number | null = null;
  /** Publicações com erros críticos. */
  @Input() comErros:   number | null = null;

  // ── Section B: ePub KPI tiles (INT-FE-PUB-005) ───────────────────────────
  /** Formatted file size (e.g. "1.4 MB"). null → tile hidden (not "N/D"). */
  @Input() tamanho:   string | null = null;
  /** Chapter count. null → tile hidden. */
  @Input() capitulos: number | null = null;
  /** Image count. null → tile hidden. */
  @Input() imagens:   number | null = null;
  // paginas: PERMANENTLY absent — ADR-004; no @Input() provided intentionally.

  /** True when ALL four publication stats are present (Section A). */
  get hasStats(): boolean {
    return (
      this.total      !== null &&
      this.publicadas !== null &&
      this.comAvisos  !== null &&
      this.comErros   !== null
    );
  }

  /** True when at least one ePub KPI tile is available (Section B). */
  get hasKpis(): boolean {
    return this.tamanho !== null || this.capitulos !== null || this.imagens !== null;
  }

  /**
   * True when NEITHER section A (stats) NOR section B (KPI tiles) has data.
   * Drives the explicit empty state — never renders a blank area (plan P3 rule).
   */
  get isEmpty(): boolean {
    return !this.hasStats && !this.hasKpis;
  }
}
