/**
 * preview-skeleton.component.ts — CLS-safe loading skeleton for T06 Editor de Layout / Preview.
 * FE-COMP-024 / SPEC-02 §2 / P8 UX Polish.
 *
 * Replaces the inline spinner in EditorDeLayoutPreviewComponent when status='loading'.
 * Rendered inside the canvas area (flex-1 overflow-auto) — fills the available space.
 *
 * The style panel is rendered separately (always visible, even during load),
 * so this skeleton only covers the canvas area.
 *
 * CLS-safe: uses w-full h-full to fill the canvas container without changing its dimensions.
 */
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'comp-preview-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
  template: `
    <div
      class="flex flex-col items-center gap-4 w-full h-full px-8 py-10 animate-pulse"
      role="status"
      aria-label="Carregando preview do manuscrito"
    >
      <!-- Simulated paper page skeleton -->
      <div
        class="w-full max-w-[600px] flex-1 rounded-lg bg-[var(--bg-surface-active)]"
        style="min-height:320px;max-height:640px;"
      ></div>

      <!-- Pagination placeholder -->
      <div class="flex items-center gap-3">
        <div class="h-8 w-16 rounded bg-[var(--bg-surface-active)]"></div>
        <div class="h-4 w-12 rounded bg-[var(--bg-surface-active)]"></div>
        <div class="h-8 w-16 rounded bg-[var(--bg-surface-active)]"></div>
      </div>
    </div>
    <span class="sr-only">Carregando...</span>
  `,
})
export class PreviewSkeletonComponent {}
