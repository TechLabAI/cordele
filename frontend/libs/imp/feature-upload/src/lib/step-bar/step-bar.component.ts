/**
 * step-bar.component.ts — P4 stub (FE-IMP-018).
 * Real StepBarComponent lives in imp-navigation (P5) and will replace this stub.
 * Implements the minimum @Input() contract so UploadComponent can compile now.
 * Do NOT move this file to imp-navigation — it will be deleted in P5.
 */
import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'imp-step-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Stub template — styled minimally so the page is not visually broken
  template: `
    @if (steps.length) {
      <nav class="flex items-center gap-1 mb-10 text-sm" aria-label="Etapas">
        @for (step of steps; track $index) {
          <span class="flex items-center gap-1.5"
                [style]="$index === activeIndex
                  ? 'color:var(--color-brand);font-weight:600'
                  : 'color:var(--text-tertiary)'">
            <span class="inline-flex items-center justify-center size-5 rounded-full text-xs font-bold"
                  [style]="$index === activeIndex
                    ? 'background:var(--color-brand);color:var(--text-on-brand)'
                    : 'background:var(--bg-surface-active);color:var(--text-tertiary)'">
              {{ $index + 1 }}
            </span>
            {{ step }}
          </span>
          @if (!$last) {
            <span class="mx-2" style="color:var(--border-strong)">›</span>
          }
        }
      </nav>
    }
  `,
})
export class StepBarComponent {
  /** Labels for each step, in order. */
  @Input() steps: string[] = [];
  /** Zero-based index of the currently active step. */
  @Input() activeIndex = 0;
}
