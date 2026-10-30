/**
 * idioma-select.component.ts — language selector for metadados T05.
 * FE-COMP-012 / SPEC-02 §1.
 *
 * Presentational — lists pt|en|es|fr options; default value is 'pt'.
 * No business logic; delegates selection upstream via change output.
 */
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { MetadadosIdioma } from '../models/comp.models';

interface IdiomaOption {
  value: MetadadosIdioma;
  label: string;
}

/** Exactly the four idiomas honoured by the COMP/PUB pipeline (SPEC-02 §1). */
const IDIOMAS: IdiomaOption[] = [
  { value: 'pt', label: 'Português' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
];

@Component({
  selector: 'comp-idioma-select',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <label class="block text-sm font-medium mb-1.5" style="color:var(--text-primary)">
        Idioma <span style="color:var(--color-error)" aria-hidden="true">*</span>
      </label>
      <select
        [value]="value()"
        (change)="onChange($event)"
        class="w-full rounded-lg px-4 py-2.5 text-sm outline-none cursor-pointer"
        style="background:var(--bg-surface);border:1px solid var(--border-default);color:var(--text-primary);"
        aria-required="true"
      >
        @for (lang of idiomas; track lang.value) {
          <option [value]="lang.value">{{ lang.label }}</option>
        }
      </select>
    </div>
  `,
})
export class IdiomaSelectComponent {
  readonly value  = input<MetadadosIdioma>('pt');
  /** Emits the selected idioma on user interaction. */
  readonly idiomaChange = output<MetadadosIdioma>();

  readonly idiomas = IDIOMAS;

  onChange(event: Event): void {
    this.idiomaChange.emit((event.target as HTMLSelectElement).value as MetadadosIdioma);
  }
}
