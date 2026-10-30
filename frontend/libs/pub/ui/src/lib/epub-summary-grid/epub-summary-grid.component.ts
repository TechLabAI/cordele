/**
 * epub-summary-grid.component.ts — FE-PUB-015 — Grid de KPIs do ePub.
 *
 * Tiles de KPI (Tamanho / Páginas / Capítulos / Imagens) BLOQUEADOS:
 * os campos correspondentes NÃO existem no api-contract §6 — aguarda decisão de produto.
 * // BLOCKED: INT-FE-PUB-005 — KPIs ePub sem campo-fonte no api-contract §6; aguarda PM/Tech Lead.
 *
 * Regra: NÃO fabricar dados. Renderizar estado vazio explícito enquanto bloqueado.
 * Quando INT-FE-PUB-005 for resolvido, adicionar @Input() com os campos ratificados
 * e substituir o empty-state pelo grid real.
 *
 * Inputs: total, publicadas, comAvisos, comErros — primitivos (nullable).
 * Se todos null → estado vazio explícito.
 *
 * Boundary: type:ui — usa apenas primitivos; não importa type:data-access.
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
    <!--
      KPI tiles BLOQUEADOS — INT-FE-PUB-005: campos Tamanho/Páginas/Capítulos/Imagens
      não existem no api-contract §6. Tiles ocultados por design até decisão de produto.
      Renderiza estado vazio explícito (nunca omite silenciosamente).
    -->
    @if (hasStats) {
      <!-- Grid de stats (total / publicadas / comAvisos / comErros) -->
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
    } @else {
      <!-- Estado vazio explícito: sem dados de estatísticas disponíveis -->
      <div class="rounded-xl p-4 mb-4 text-center text-sm"
           style="background:var(--bg-surface);border:1px dashed var(--border-subtle);color:var(--text-tertiary);"
           aria-label="Estatísticas indisponíveis">
        Estatísticas de ePub indisponíveis
        <span class="text-xs block mt-1">(INT-FE-PUB-005 — aguarda definição de campos no api-contract)</span>
      </div>
    }
  `,
})
export class EpubSummaryGridComponent {
  /** Total de publicações do projeto. null enquanto INT-FE-PUB-005 bloqueado. */
  @Input() total: number | null = null;
  /** Publicações com status valido|avisos. null enquanto INT-FE-PUB-005 bloqueado. */
  @Input() publicadas: number | null = null;
  /** Publicações com avisos não-bloqueantes. null enquanto INT-FE-PUB-005 bloqueado. */
  @Input() comAvisos: number | null = null;
  /** Publicações com erros críticos. null enquanto INT-FE-PUB-005 bloqueado. */
  @Input() comErros: number | null = null;

  /** Verdadeiro apenas quando todos os campos KPI estão presentes (não null). */
  get hasStats(): boolean {
    return (
      this.total !== null &&
      this.publicadas !== null &&
      this.comAvisos !== null &&
      this.comErros !== null
    );
  }
}
