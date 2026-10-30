/**
 * advance-bar.component.ts — "Ir para preview" CTA for T05 Configurações.
 * FE-COMP-012 / SPEC-02 §1.
 *
 * Presentational — button disabled when canAdvance=false or saving=true.
 * The back-navigation slot is projected via <ng-content>.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';

@Component({
  selector: 'comp-advance-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mt-8 flex items-center justify-between">
      <!-- Back-navigation link projected by parent -->
      <ng-content />

      <button
        type="button"
        (click)="onButtonClick()"
        [disabled]="!canAdvance() || saving()"
        class="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity"
        [style]="buttonStyle()"
        [attr.aria-busy]="saving() ? 'true' : null"
      >
        @if (saving()) {
          <span class="material-symbols-outlined animate-spin" style="font-size:18px;" aria-hidden="true">
            progress_activity
          </span>
          Salvando...
        } @else {
          Ir para preview
          <span class="material-symbols-outlined" style="font-size:18px;" aria-hidden="true">
            arrow_forward
          </span>
        }
      </button>
    </div>
  `,
})
export class AdvanceBarComponent {
  readonly canAdvance = input<boolean>(false);
  readonly saving     = input<boolean>(false);

  /** Emits when the advance button is clicked (and action is valid). */
  readonly advance = output<void>();

  readonly buttonStyle = computed(() => {
    if (this.canAdvance() && !this.saving()) {
      return 'background:var(--color-brand);color:var(--text-on-brand);';
    }
    return 'background:var(--bg-surface-active);color:var(--text-tertiary);cursor:not-allowed;';
  });

  onButtonClick(): void {
    if (this.canAdvance() && !this.saving()) {
      this.advance.emit();
    }
  }
}
