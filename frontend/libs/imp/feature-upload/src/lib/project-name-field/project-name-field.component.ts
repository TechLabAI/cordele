/**
 * project-name-field.component.ts — Presentational (FE-IMP-012).
 * Renders the "Nome do projeto" input for the new-project upload flow.
 * Validation: required, minlength=3.
 * Emits valueChange on every keystroke so the smart UploadComponent keeps
 * the canonical value in its own signal.
 */
import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'imp-project-name-field',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <label class="block text-sm font-medium mb-1.5" style="color:var(--text-primary)">
        Nome do projeto <span style="color:var(--color-error)">*</span>
      </label>
      <input
        type="text"
        placeholder="ex.: Romance das Cidades — Aetós 2026"
        [value]="value"
        (input)="onInput($event)"
        class="w-full rounded-lg px-4 py-2.5 text-sm outline-none transition-colors"
        style="background:var(--bg-surface);border:1px solid var(--border-default);color:var(--text-primary);"
        onfocus="this.style.borderColor='var(--color-brand)'"
        onblur="this.style.borderColor='var(--border-default)'"
      />
      @if (value.length > 0 && value.trim().length < 3) {
        <p class="mt-1 text-xs flex items-center gap-1" style="color:var(--color-error)">
          <span class="material-symbols-outlined" style="font-size:13px;">error</span>
          Informe pelo menos 3 caracteres.
        </p>
      }
    </div>
  `,
})
export class ProjectNameFieldComponent {
  /** Current value — controlled from the parent UploadComponent signal. */
  @Input() value = '';

  /** Emits on every keystroke with the new string value. */
  @Output() valueChange = new EventEmitter<string>();

  onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }
}
