import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';

// ds-button — variantes × tamanhos. Tokens: brand / line-strong / danger.
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'default' | 'sm' | 'icon';

const SIZE: Record<Size, string> = {
  default: 'h-9 px-3.5 text-sm',
  sm: 'h-[30px] px-3 text-xs',
  icon: 'size-9 p-0',
};
const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand text-brand-ink hover:bg-brand-strong shadow-card',
  secondary: 'border-[1.5px] border-line-strong text-ink-soft hover:bg-surface',
  ghost: 'text-ink-soft hover:bg-surface-2',
  danger: 'text-danger hover:bg-danger-bg',
};

@Component({
  selector: 'app-ds-button',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<button class="inline-flex items-center justify-center gap-2 rounded-md font-body font-medium transition-colors disabled:opacity-45 disabled:cursor-not-allowed" [class]="cls()" [disabled]="disabled()"><ng-content /></button>`,
})
export class DsButtonComponent {
  readonly variant = input<Variant>('primary');
  readonly size = input<Size>('default');
  readonly disabled = input(false);
  protected readonly cls = computed(() => `${SIZE[this.size()]} ${VARIANT[this.variant()]}`);
}
