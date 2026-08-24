import { Component, ChangeDetectionStrategy, input, model } from '@angular/core';

// ds-input — campo. error/disabled/icon-prefixo. Foco usa token (zero hex).
@Component({
  selector: 'app-ds-input',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative">
      @if (icon()) {
        <span class="material-symbols-outlined pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[18px] text-ink-faint">{{ icon() }}</span>
      }
      <input
        class="h-9 w-full rounded-md border-[1.5px] bg-field px-3 font-body text-sm text-ink outline-none transition-colors placeholder:text-ink-faint disabled:cursor-not-allowed disabled:bg-surface-2 disabled:opacity-45"
        [class]="cls()"
        [type]="type()"
        [placeholder]="placeholder()"
        [disabled]="disabled()"
        [value]="value()"
        (input)="value.set($any($event.target).value)" />
    </div>
  `,
})
export class DsInputComponent {
  readonly error = input(false);
  readonly disabled = input(false);
  readonly placeholder = input('');
  readonly type = input('text');
  readonly icon = input<string | null>(null);
  readonly value = model('');
  protected cls(): string {
    const focus = this.error()
      ? 'border-danger focus:shadow-[0_0_0_3px_var(--color-danger-bg)]'
      : 'border-field-line focus:border-brand focus:shadow-[0_0_0_3px_var(--color-brand-subtle)]';
    return `${focus} ${this.icon() ? 'pl-9' : ''}`;
  }
}
