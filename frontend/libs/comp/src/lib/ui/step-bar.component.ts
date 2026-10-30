/**
 * step-bar.component.ts — pipeline step bar for COMP screens T05 and T06.
 * FE-COMP-018 / SPEC-02 §1–§2.
 *
 * Presentational — receives `steps` (from COMP_NAV_CONFIG.stepBar) and `current` (step key).
 * Computes state: done (before current), active (current), pending (after current).
 * Reused in T05 (current='configurar') and T06 (current='edicao').
 */
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export interface StepDef {
  key: string;
  label: string;
}

type StepState = 'done' | 'active' | 'pending';

interface StepWithState extends StepDef {
  state: StepState;
  index: number;
}

@Component({
  selector: 'comp-step-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <nav class="flex items-center gap-1 text-sm" aria-label="Etapas do pipeline">
      @for (step of stepsWithState(); track step.key) {
        <span class="flex items-center gap-1.5" [style]="stepStyle(step.state)">
          <span
            class="inline-flex items-center justify-center size-5 rounded-full text-xs font-bold"
            [style]="dotStyle(step.state)"
            [attr.aria-current]="step.state === 'active' ? 'step' : null"
          >
            @if (step.state === 'done') {
              <span class="material-symbols-outlined" style="font-size:12px;">check</span>
            } @else {
              {{ step.index }}
            }
          </span>
          {{ step.label }}
        </span>
        @if (!$last) {
          <span class="mx-2" style="color:var(--border-strong)" aria-hidden="true">›</span>
        }
      }
    </nav>
  `,
})
export class StepBarComponent {
  readonly steps = input.required<StepDef[]>();
  readonly current = input.required<string>();

  readonly stepsWithState = computed<StepWithState[]>(() => {
    const currentIdx = this.steps().findIndex(s => s.key === this.current());
    return this.steps().map((s, i) => ({
      ...s,
      index: i + 1,
      state: (i < currentIdx ? 'done' : i === currentIdx ? 'active' : 'pending') as StepState,
    }));
  });

  stepStyle(state: StepState): string {
    if (state === 'done') return 'color:var(--color-success);font-weight:600';
    if (state === 'active') return 'color:var(--color-brand);font-weight:600';
    return 'color:var(--text-tertiary)';
  }

  dotStyle(state: StepState): string {
    if (state === 'done') return 'background:var(--color-success-bg);color:var(--text-on-brand)';
    if (state === 'active') return 'background:var(--color-brand);color:var(--text-on-brand)';
    return 'background:var(--bg-surface-active);color:var(--text-tertiary)';
  }
}
