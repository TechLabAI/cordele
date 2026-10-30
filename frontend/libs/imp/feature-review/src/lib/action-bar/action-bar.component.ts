/**
 * action-bar.component.ts — Presentational (FE-IMP-017).
 * Bottom action bar for T04: "Reimportar outro arquivo" link + "Confirmar estrutura" CTA.
 *
 * Inputs:
 *   canConfirm  — true when the structure is loaded and no confirmation is in flight
 *   canIgnore   — reserved (true when there are pending blocks that can be ignored)
 *
 * Outputs:
 *   confirm()      — emitted when the user clicks "Confirmar estrutura"
 *   cancelIgnore() — emitted when the user cancels an in-progress ignore action
 */
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'imp-action-bar',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center justify-between">
      <a
        routerLink="/imp/upload"
        class="text-sm flex items-center gap-1"
        style="color:var(--text-secondary);"
      >
        <span class="material-symbols-outlined" style="font-size:16px;">arrow_back</span>
        Reimportar outro arquivo
      </a>

      <button
        (click)="onConfirm()"
        [disabled]="!canConfirm"
        class="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
        [style]="canConfirm
          ? 'background:var(--color-brand);color:var(--text-on-brand);'
          : 'background:var(--bg-surface-active);color:var(--text-tertiary);cursor:not-allowed;'"
      >
        {{ canConfirm ? 'Confirmar estrutura' : 'Confirmando…' }}
        <span class="material-symbols-outlined" style="font-size:18px;">arrow_forward</span>
      </button>
    </div>
  `,
})
export class ActionBarComponent {
  /** True when confirmation can proceed (not already in flight and manuscrito is loaded). */
  @Input() canConfirm = false;
  /**
   * True when there are pending blocks available to ignore.
   * Reserved for future use (e.g. enabling/disabling ignore-all).
   */
  @Input() canIgnore = false;

  /** Emitted when the user clicks "Confirmar estrutura". */
  @Output() confirm = new EventEmitter<void>();
  /** Emitted when an in-progress ignore action is cancelled (future use). */
  @Output() cancelIgnore = new EventEmitter<void>();

  protected onConfirm(): void {
    if (this.canConfirm) {
      this.confirm.emit();
    }
  }
}
