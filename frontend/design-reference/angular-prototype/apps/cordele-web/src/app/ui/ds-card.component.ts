import { Component, ChangeDetectionStrategy, input } from '@angular/core';

// ds-card — superfície. default = surface+shadow; elevated = elevated+shadow-md.
type Variant = 'default' | 'elevated' | 'surface-2';
const VARIANT: Record<Variant, string> = {
  default: 'bg-surface shadow-card',
  elevated: 'bg-elevated shadow-md',
  'surface-2': 'bg-surface-2',
};

@Component({
  selector: 'app-ds-card',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="rounded-card border border-line p-5" [class]="VARIANT[variant()]"><ng-content /></div>`,
})
export class DsCardComponent {
  readonly variant = input<Variant>('default');
  protected readonly VARIANT = VARIANT;
}
