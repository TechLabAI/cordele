/**
 * content-tree-skeleton.component.ts — Presentational skeleton (FE-IMP-022).
 * Shown while ReviewFacade.phase() === 'loading' (deep-link / reload path).
 * Pure pulse animation; no inputs or outputs.
 */
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'imp-content-tree-skeleton',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="space-y-4 animate-pulse" aria-busy="true" aria-label="Carregando estrutura…">

      <!-- Header skeleton -->
      <div class="h-8 w-1/3 rounded" style="background:var(--bg-surface-active);"></div>

      <!-- Counter cards skeleton -->
      <div class="grid grid-cols-3 gap-4">
        @for (i of [1, 2, 3]; track i) {
          <div class="rounded-xl p-4 flex flex-col items-center gap-2"
               style="border:1px solid var(--border-subtle);background:var(--bg-surface);">
            <div class="h-6 w-6 rounded-full" style="background:var(--bg-surface-active);"></div>
            <div class="h-7 w-12 rounded" style="background:var(--bg-surface-active);"></div>
            <div class="h-3 w-16 rounded" style="background:var(--bg-surface-active);"></div>
          </div>
        }
      </div>

      <!-- Pendências list skeleton -->
      <div class="rounded-xl overflow-hidden" style="border:1px solid var(--border-subtle);">
        <div class="px-4 py-2.5 h-9" style="background:var(--bg-surface-active);"></div>
        @for (i of [1, 2, 3]; track i) {
          <div class="px-4 py-3 flex items-start gap-3 border-t"
               style="background:var(--bg-surface);border-color:var(--border-subtle);">
            <div class="flex-1 space-y-1.5">
              <div class="h-4 w-2/3 rounded" style="background:var(--bg-surface-active);"></div>
              <div class="h-3 w-1/3 rounded" style="background:var(--bg-surface-active);"></div>
            </div>
            <div class="h-4 w-12 rounded" style="background:var(--bg-surface-active);"></div>
          </div>
        }
      </div>

    </div>
  `,
})
export class ContentTreeSkeletonComponent {}
