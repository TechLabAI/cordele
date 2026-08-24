import { Component, ChangeDetectionStrategy, input } from '@angular/core';

// ds-badge — pílula de status. tone → par de tokens (-bg / -ink). pu = IA (roxo).
type Tone = 'ok' | 'wn' | 'er' | 'nf' | 'pu' | 'ac' | 'mu';
const TONE: Record<Tone, string> = {
  ok: 'bg-success-bg text-success-ink',
  wn: 'bg-warning-bg text-warning-ink',
  er: 'bg-danger-bg text-danger-ink',
  nf: 'bg-info-bg text-info-ink',
  pu: 'bg-ai-bg text-ai-ink',
  ac: 'bg-accent/15 text-accent',
  mu: 'bg-surface-2 text-ink-soft border border-line',
};

@Component({
  selector: 'app-ds-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium" [class]="TONE[tone()]"><ng-content /></span>`,
})
export class DsBadgeComponent {
  readonly tone = input<Tone>('mu');
  protected readonly TONE = TONE;
}
