/**
 * metadata-field.component.ts — generic text field for metadados form (T05).
 * FE-COMP-012 / SPEC-02 §1.
 *
 * Presentational only — receives value via input() and emits changes via output().
 * Covers: titulo, autor, isbn, categoria fields.
 */
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';

@Component({
  selector: 'comp-metadata-field',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <label class="block text-sm font-medium mb-1.5" style="color:var(--text-primary)">
        {{ label() }}
        @if (required()) {
          <span style="color:var(--color-error)" aria-hidden="true">*</span>
        }
      </label>
      <input
        [type]="type()"
        [value]="value()"
        [placeholder]="placeholder()"
        [attr.aria-required]="required() ? 'true' : null"
        (input)="onInput($event)"
        class="w-full rounded-lg px-4 py-2.5 text-sm outline-none"
        style="background:var(--bg-surface);border:1px solid var(--border-default);color:var(--text-primary);"
        onfocus="this.style.borderColor='var(--color-brand)'"
        onblur="this.style.borderColor='var(--border-default)'"
      />
      @if (error()) {
        <p class="mt-1 text-xs" style="color:var(--color-error)" role="alert">
          {{ error() }}
        </p>
      }
    </div>
  `,
})
export class MetadataFieldComponent {
  readonly label       = input.required<string>();
  readonly value       = input<string>('');
  readonly required    = input<boolean>(false);
  readonly error       = input<string | null | undefined>(null);
  readonly type        = input<string>('text');
  readonly placeholder = input<string>('');

  /** Emits the raw string value on every keystroke. */
  readonly valueChange = output<string>();

  onInput(event: Event): void {
    this.valueChange.emit((event.target as HTMLInputElement).value);
  }
}
