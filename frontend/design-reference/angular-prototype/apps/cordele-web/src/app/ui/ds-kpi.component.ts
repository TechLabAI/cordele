import { Component, ChangeDetectionStrategy, input } from '@angular/core';

// ds-kpi — métrica. kind tint/vivid/glass. delta opcional vira pílula de sucesso.
type Kind = 'tint' | 'vivid' | 'glass';
const WRAP: Record<Kind, string> = {
  tint: 'bg-surface border border-line shadow-card',
  vivid: 'bg-brand',
  glass: 'bg-brand-subtle border border-brand',
};

@Component({
  selector: 'app-ds-kpi',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-1 rounded-card p-5" [class]="WRAP[kind()]">
      <span class="font-display text-2xs font-medium uppercase tracking-wide"
        [class]="kind() === 'vivid' ? 'text-brand-ink/65' : 'text-ink-faint'">{{ label() }}</span>
      <span class="font-display text-3xl font-bold leading-tight"
        [class]="kind() === 'vivid' ? 'text-brand-ink' : 'text-ink'">{{ value() }}</span>
      @if (delta()) {
        <span class="mt-1.5 inline-flex items-center gap-1 self-start rounded-full bg-success-bg px-1.5 py-0.5 text-xs font-medium text-success-ink">
          <span class="material-symbols-outlined text-[14px]">trending_up</span>{{ delta() }}
        </span>
      }
    </div>
  `,
})
export class DsKpiComponent {
  readonly label = input('');
  readonly value = input<string | number>('');
  readonly delta = input<string | null>(null);
  readonly kind = input<Kind>('tint');
  protected readonly WRAP = WRAP;
}
