/**
 * step-bar.component.ts — IMP step-bar (FE-IMP-018 / FE-IMP-020).
 *
 * Production component (replaces the P4 stub in feature-upload).
 * Renders a horizontal step indicator for the IMP pipeline:
 *   Importar → Configurar → Visualizar → Exportar
 *
 * Inputs:
 *   steps       — labels for each step in order
 *   activeIndex — zero-based index of the currently active step
 *
 * Rules:
 *   - standalone: true  (Angular standalone API)
 *   - OnPush             (change-detection boundary)
 *   - Pure presentational (no HTTP or service injection)
 */
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'imp-step-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (steps.length) {
      <nav class="flex items-center gap-1 mb-10 text-sm" aria-label="Etapas">
        @for (step of steps; track $index) {
          <span class="flex items-center gap-1.5"
                [style]="$index === activeIndex
                  ? 'color:var(--color-brand);font-weight:600'
                  : 'color:var(--text-tertiary)'">
            <span
              class="inline-flex items-center justify-center size-5 rounded-full text-xs font-bold"
              [style]="$index === activeIndex
                ? 'background:var(--color-brand);color:var(--text-on-brand)'
                : 'background:var(--bg-surface-active);color:var(--text-tertiary)'"
              [attr.aria-current]="$index === activeIndex ? 'step' : null">
              {{ $index + 1 }}
            </span>
            {{ step }}
          </span>
          @if (!$last) {
            <span class="mx-2" style="color:var(--border-strong)" aria-hidden="true">›</span>
          }
        }
      </nav>
    }
  `,
})
export class StepBarComponent {
  /** Labels for each step, in order (e.g. ['Importar', 'Configurar', 'Visualizar', 'Exportar']). */
  @Input() steps: string[] = [];

  /** Zero-based index of the currently active step. */
  @Input() activeIndex = 0;
}
