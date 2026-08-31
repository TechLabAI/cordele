/**
 * error-state.component.ts — local placeholder for the shared ErrorStateComponent.
 * FE-COMP-024 / SPEC-07 §2 / P8 UX Polish.
 *
 * NOTE: @cordele/shared/ui-feedback does not yet export ErrorStateComponent (stub only,
 * Wave-0, D-328). This local implementation satisfies COMP's P8 UX requirement.
 * TODO: replace with import from @cordele/shared/ui-feedback when that lib ships ErrorStateComponent.
 *
 * Inputs:
 *   message       — human-readable error message (from CompUiError.message)
 *   correlationId — optional trace id for debugging (from CompUiError.correlationId)
 *
 * Outputs:
 *   retry — emitted when the user clicks "Tentar novamente"
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'comp-error-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="flex flex-col items-center gap-4 py-16 text-center"
      role="alert"
      aria-live="polite"
    >
      <span
        class="material-symbols-outlined text-4xl"
        style="color:var(--color-error)"
        aria-hidden="true"
      >error</span>

      <p class="text-sm" style="color:var(--color-error)">
        {{ message() }}
      </p>

      @if (correlationId()) {
        <p class="text-xs font-mono" style="color:var(--text-tertiary)">
          Ref: {{ correlationId() }}
        </p>
      }

      <button
        type="button"
        class="rounded-lg px-4 py-2 text-sm font-medium"
        style="background:var(--bg-surface-active);color:var(--text-secondary);"
        (click)="retry.emit()"
      >
        Tentar novamente
      </button>
    </div>
  `,
})
export class ErrorStateComponent {
  /** Human-readable error message. */
  readonly message = input.required<string>();

  /** Optional correlation/trace id shown for debugging. */
  readonly correlationId = input<string | null | undefined>(null);

  /** Emitted when the user clicks "Tentar novamente". */
  readonly retry = output<void>();
}
