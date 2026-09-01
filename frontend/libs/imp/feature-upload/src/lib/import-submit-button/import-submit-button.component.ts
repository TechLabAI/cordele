/**
 * import-submit-button.component.ts — Presentational (FE-IMP-015).
 * Primary CTA for the Upload form. Shows busy state while the upload is in flight.
 *
 * Inputs:
 *   disabled — true when the form is not yet valid (no file + no project name)
 *   busy     — true while facade.phase() === 'uploading'
 *
 * Output:
 *   submit — emitted on click when not disabled and not busy
 */
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';

@Component({
  selector: 'imp-import-submit-button',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      [disabled]="disabled || busy"
      (click)="onCLick()"
      class="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity"
      [style]="(!disabled && !busy)
        ? 'background:var(--color-brand);color:var(--text-on-brand);'
        : 'background:var(--bg-surface-active);color:var(--text-tertiary);cursor:not-allowed;'"
    >
      <span class="material-symbols-outlined" style="font-size:18px;">arrow_forward</span>
      {{ busy ? 'Importando…' : 'Importar manuscrito' }}
    </button>
  `,
})
export class ImportSubmitButtonComponent {
  /** True when the form is invalid (no file or project name too short). */
  @Input() disabled = true;
  /** True while the upload POST is in flight. */
  @Input() busy = false;

  /** Emitted when the button is clicked and the form is valid and not busy. */
  @Output() importSubmit = new EventEmitter<void>();

  onCLick(): void {
    if (!this.disabled && !this.busy) {
      this.importSubmit.emit();
    }
  }
}
