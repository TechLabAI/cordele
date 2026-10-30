/**
 * upload-progress-card.component.ts — Presentational (FE-IMP-014).
 * Shows upload/analysis in-progress state (indeterminate — POST is synchronous per D-A)
 * and error state with a retry action.
 *
 * Inputs:
 *   phase        — 'idle' | 'uploading' | 'done' | 'error'  (from ImportFacade)
 *   progressPct  — 0–100 (reserved for future async upload; ignored while phase='uploading')
 *   fileName     — name of the file being uploaded
 *   errorMessage — error description shown when phase='error'
 *
 * Output:
 *   retry — emitted when the user clicks "Tentar novamente"
 */
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { UploadPhase } from '@cordele/imp/data-access';

@Component({
  selector: 'imp-upload-progress-card',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Uploading / analysing (indeterminate — D-A synchronous POST) -->
    @if (phase === 'uploading') {
      <div class="rounded-xl p-5" style="background:var(--bg-surface);border:1px solid var(--border-subtle);">
        <div class="flex items-center gap-3 mb-3">
          <span class="material-symbols-outlined" style="color:var(--color-brand);font-size:20px;">description</span>
          <span class="text-sm font-medium flex-1" style="color:var(--text-primary)">{{ fileName }}</span>
          <span class="text-xs animate-pulse" style="color:var(--text-tertiary)">…</span>
        </div>
        <!-- Indeterminate bar -->
        <div class="h-1.5 rounded-full overflow-hidden" style="background:var(--bg-surface-active);">
          <div class="h-full rounded-full animate-pulse" style="background:var(--color-brand);width:100%;"></div>
        </div>
        <p class="mt-2 text-xs" style="color:var(--text-secondary)">Fazendo upload e analisando estrutura…</p>
      </div>
    }

    <!-- Error card with retry -->
    @if (phase === 'error') {
      <div class="rounded-xl p-4 flex items-start gap-3"
           style="background:oklch(52% 0.23 25 / 0.08);border:1px solid oklch(52% 0.23 25 / 0.3);">
        <span class="material-symbols-outlined mt-0.5 shrink-0" style="color:var(--color-error);font-size:18px;">error</span>
        <div class="flex-1 min-w-0">
          <p class="text-sm" style="color:var(--color-error)">{{ errorMessage }}</p>
        </div>
        <button
          (click)="retry.emit()"
          class="shrink-0 text-xs underline"
          style="color:var(--color-error)"
        >
          Tentar novamente
        </button>
      </div>
    }
  `,
})
export class UploadProgressCardComponent {
  @Input() phase: UploadPhase = 'idle';
  /** Percentage 0–100; reserved for future async progress (ignored while synchronous). */
  @Input() progressPct = 0;
  @Input() fileName = '';
  @Input() errorMessage: string | null = null;

  /** Emitted when the user clicks "Tentar novamente" in error state. */
  @Output() retry = new EventEmitter<void>();
}
