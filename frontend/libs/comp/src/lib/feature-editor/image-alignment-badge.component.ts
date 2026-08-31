/**
 * image-alignment-badge.component.ts — alignment control for image pages in T06.
 * FE-COMP-017 / SPEC-02 §2 / SPEC-05 §3.
 *
 * Presentational:
 *   - 4 alignment options: full | centralizado | junto-esquerda | junto-direita.
 *   - Shows a subtle "stale" warning when stale=true (override references a changed node).
 *   - Hidden when canEdit=false (e.g. comp.imageAlignment flag off or no comp.edit permission).
 *   - No HTTP calls; alignment write-back happens on export via LayoutFacade.
 */
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { Alinhamento } from '../models/comp.models';

interface AlinhamentoOption {
  valor: Alinhamento;
  label: string;
  icon: string;
}

const OPTIONS: AlinhamentoOption[] = [
  { valor: 'full',           label: 'Página inteira',        icon: 'fullscreen' },
  { valor: 'centralizado',   label: 'Centralizado',          icon: 'align_justify_center' },
  { valor: 'junto-esquerda', label: 'Junto ao texto — esq', icon: 'format_image_left' },
  { valor: 'junto-direita',  label: 'Junto ao texto — dir', icon: 'format_image_right' },
];

@Component({
  selector: 'comp-image-alignment',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (canEdit()) {
      <div class="flex items-center gap-2">
        <!-- Stale indicator -->
        @if (stale()) {
          <span
            class="text-xs px-2 py-0.5 rounded"
            style="background:color-mix(in srgb,var(--color-warning) 15%,transparent);color:var(--color-warning-text);"
            title="Este alinhamento pode estar desatualizado"
          >
            ⚠ desatualizado
          </span>
        }

        <!-- 4 alignment option buttons -->
        @for (opt of options; track opt.valor) {
          <button
            type="button"
            (click)="onSelect(opt.valor)"
            class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border transition-colors"
            [style]="optionStyle(opt.valor)"
            [attr.aria-pressed]="opt.valor === alinhamento() ? 'true' : 'false'"
            [title]="opt.label"
          >
            <span class="material-symbols-outlined" style="font-size:14px;" aria-hidden="true">{{ opt.icon }}</span>
            <span class="hidden sm:inline">{{ opt.label }}</span>
          </button>
        }
      </div>
    }
  `,
})
export class ImageAlignmentBadgeComponent {
  readonly alinhamento = input.required<Alinhamento>();
  /** True when the override references a node that may have changed in the manuscript. */
  readonly stale    = input<boolean>(false);
  /**
   * Gates rendering: set to false when comp.imageAlignment flag is off OR
   * the principal lacks comp.edit (INT-FE-COMP-005, P4).
   */
  readonly canEdit  = input<boolean>(true);

  /** Emits the selected alignment value. */
  readonly alignmentSelect = output<Alinhamento>();

  readonly options = OPTIONS;

  optionStyle(valor: Alinhamento): string {
    const isActive = valor === this.alinhamento();
    return isActive
      ? 'background:color-mix(in srgb,var(--color-brand) 12%,transparent);color:var(--color-brand);border-color:var(--color-brand);'
      : 'background:transparent;color:var(--text-tertiary);border-color:var(--border-subtle);';
  }

  onSelect(valor: Alinhamento): void {
    if (valor !== this.alinhamento()) {
      this.alignmentSelect.emit(valor);
    }
  }
}
