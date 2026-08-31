/**
 * metadata-skeleton.component.ts — CLS-safe loading skeleton for T05 Configurações.
 * FE-COMP-024 / SPEC-02 §1 / P8 UX Polish.
 *
 * Matches the layout of ConfiguracoesComponent when status='loading':
 *   - Title placeholder (1/3 width)
 *   - 2-column field grid (4 placeholders)
 *   - Idioma and Categoria placeholders
 *   - Cover drop-zone placeholder
 *
 * CLS-safe: min-height set to match the real form height so no layout shift
 * occurs when content arrives. Animate-pulse provided by Tailwind utilities.
 */
import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'comp-metadata-skeleton',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="space-y-4 animate-pulse"
      role="status"
      aria-label="Carregando formulário de metadados"
      style="min-height:420px;"
    >
      <!-- Section title placeholder -->
      <div class="h-8 rounded bg-[var(--bg-surface-active)] w-1/3 mb-6"></div>

      <!-- Field grid: 4 fields in 2-column layout -->
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <!-- Título (full width) -->
        <div class="sm:col-span-2 flex flex-col gap-1.5">
          <div class="h-4 rounded bg-[var(--bg-surface-active)] w-16"></div>
          <div class="h-12 rounded-lg bg-[var(--bg-surface-active)]"></div>
        </div>

        <!-- Autor -->
        <div class="flex flex-col gap-1.5">
          <div class="h-4 rounded bg-[var(--bg-surface-active)] w-12"></div>
          <div class="h-12 rounded-lg bg-[var(--bg-surface-active)]"></div>
        </div>

        <!-- ISBN -->
        <div class="flex flex-col gap-1.5">
          <div class="h-4 rounded bg-[var(--bg-surface-active)] w-10"></div>
          <div class="h-12 rounded-lg bg-[var(--bg-surface-active)]"></div>
        </div>

        <!-- Idioma -->
        <div class="flex flex-col gap-1.5">
          <div class="h-4 rounded bg-[var(--bg-surface-active)] w-14"></div>
          <div class="h-12 rounded-lg bg-[var(--bg-surface-active)]"></div>
        </div>

        <!-- Categoria -->
        <div class="flex flex-col gap-1.5">
          <div class="h-4 rounded bg-[var(--bg-surface-active)] w-20"></div>
          <div class="h-12 rounded-lg bg-[var(--bg-surface-active)]"></div>
        </div>

        <!-- Cover drop-zone (full width) -->
        <div class="sm:col-span-2 flex flex-col gap-1.5">
          <div class="h-4 rounded bg-[var(--bg-surface-active)] w-24"></div>
          <div class="h-36 rounded-lg bg-[var(--bg-surface-active)]"></div>
        </div>
      </div>

      <!-- Advance bar placeholder -->
      <div class="h-12 rounded-lg bg-[var(--bg-surface-active)] w-full mt-4"></div>
    </div>
    <span class="sr-only">Carregando...</span>
  `,
})
export class MetadataSkeletonComponent {}
