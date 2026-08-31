/**
 * preview-canvas.component.ts — renders a single PreviewNode as a "paper page".
 * FE-COMP-016 / SPEC-02 §2 / SPEC-03 §2.
 *
 * Presentational:
 *   - One page at a time (never the full book in the DOM — perf, SPEC-03 §2).
 *   - Paper surface remains light regardless of the app's dark theme (ADR-COMP-001).
 *   - For tipo='imagem': renders the 4 alignment layouts and embeds ImageAlignmentBadgeComponent.
 *   - Does NOT make HTTP calls; page navigation is external (PagePaginatorComponent).
 */
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { Alinhamento, ConfiguracaoLayoutDto, PreviewNode } from '../models/comp.models';
import { ImageAlignmentBadgeComponent } from './image-alignment-badge.component';

@Component({
  selector: 'comp-preview-canvas',
  standalone: true,
  imports: [ImageAlignmentBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`:host {
    /* Paper-surface tokens — light regardless of app chrome (ADR-COMP-001). */
    --paper-surface:     #ffffff;
    --paper-text:        var(--paper-text-override, #1a1a2e);
    /* D-H / FE-COMP-022: oklch() literals replaced by design-system token references.
     * Image placeholder accent maps to brand colour family (design-tokens.md §3). */
    --paper-img-accent:      var(--color-brand);
    --paper-img-accent-dark: var(--color-brand-subtle);
  }`],
  template: `
    @if (page(); as p) {
      <div
        class="rounded-xl overflow-hidden mx-auto"
        style="background:var(--paper-surface);width:min(680px,100%);box-shadow:var(--shadow-lg);"
        [style.padding.px]="layout().margemLateral"
      >
        <!-- Capítulo -->
        @if (p.tipo === 'capitulo') {
          <h2
            class="font-display mb-6"
            [style.fontFamily]="fontFamily()"
            [style.fontSize.px]="layout().h1Tamanho"
            style="color:var(--paper-text);"
          >
            Capítulo {{ p.n }} — {{ p.titulo }}
          </h2>
          @for (para of paragrafos(); track $index) {
            <p
              class="mb-4"
              [style.fontFamily]="fontFamily()"
              [style.fontSize.px]="layout().fonteCorpoTamanho"
              [style.lineHeight]="layout().espacamentoLinha"
              style="color:var(--paper-text);"
            >
              {{ para }}
            </p>
          }
        }

        <!-- Imagem -->
        @if (p.tipo === 'imagem') {
          @let al = p.alinhamento ?? 'centralizado';

          @if (al === 'full') {
            <div class="rounded-lg overflow-hidden w-full"
                 style="background:var(--bg-surface-active);border:2px dashed color-mix(in srgb,var(--paper-img-accent) 50%,transparent);min-height:240px;display:flex;align-items:center;justify-content:center;">
              <div class="text-center">
                <span class="material-symbols-outlined text-5xl mb-2 block" style="color:var(--paper-img-accent)">image</span>
                <p class="text-xs font-medium" style="color:var(--paper-img-accent-dark)">Página inteira</p>
              </div>
            </div>
          }

          @if (al === 'centralizado') {
            <div class="flex justify-center py-4">
              <div class="rounded-lg overflow-hidden"
                   style="width:70%;background:var(--bg-surface-active);border:2px dashed color-mix(in srgb,var(--paper-img-accent) 50%,transparent);min-height:180px;display:flex;align-items:center;justify-content:center;">
                <div class="text-center">
                  <span class="material-symbols-outlined text-4xl mb-2 block" style="color:var(--paper-img-accent)">image</span>
                  <p class="text-xs font-medium" style="color:var(--paper-img-accent-dark)">Centralizado</p>
                </div>
              </div>
            </div>
          }

          @if (al === 'junto-esquerda') {
            <div class="flex gap-4 py-2">
              <div class="rounded-lg shrink-0"
                   style="width:40%;background:var(--bg-surface-active);border:2px dashed color-mix(in srgb,var(--paper-img-accent) 50%,transparent);min-height:140px;display:flex;align-items:center;justify-content:center;">
                <div class="text-center">
                  <span class="material-symbols-outlined text-3xl" style="color:var(--paper-img-accent)">image</span>
                  <p class="text-xs" style="color:var(--paper-img-accent-dark)">Esq.</p>
                </div>
              </div>
              <div class="flex-1 space-y-2 pt-1">
                <div class="h-2.5 rounded" style="background:var(--border-subtle);width:100%"></div>
                <div class="h-2.5 rounded" style="background:var(--border-subtle);width:100%"></div>
                <div class="h-2.5 rounded" style="background:var(--border-subtle);width:60%"></div>
                <p class="text-xs" style="color:var(--text-tertiary)">Texto flui à direita</p>
              </div>
            </div>
          }

          @if (al === 'junto-direita') {
            <div class="flex gap-4 py-2">
              <div class="flex-1 space-y-2 pt-1">
                <div class="h-2.5 rounded" style="background:var(--border-subtle);width:100%"></div>
                <div class="h-2.5 rounded" style="background:var(--border-subtle);width:100%"></div>
                <div class="h-2.5 rounded" style="background:var(--border-subtle);width:60%"></div>
                <p class="text-xs" style="color:var(--text-tertiary)">Texto flui à esquerda</p>
              </div>
              <div class="rounded-lg shrink-0"
                   style="width:40%;background:var(--bg-surface-active);border:2px dashed color-mix(in srgb,var(--paper-img-accent) 50%,transparent);min-height:140px;display:flex;align-items:center;justify-content:center;">
                <div class="text-center">
                  <span class="material-symbols-outlined text-3xl" style="color:var(--paper-img-accent)">image</span>
                  <p class="text-xs" style="color:var(--paper-img-accent-dark)">Dir.</p>
                </div>
              </div>
            </div>
          }

          <!-- Alignment badge — shown for image pages only -->
          <div class="mt-3 flex items-center justify-end">
            <comp-image-alignment
              [alinhamento]="al"
              [stale]="false"
              [canEdit]="true"
              (alignmentSelect)="onAlignmentChange(p.nodeId, $event)"
            />
          </div>
        }
      </div>
    }
  `,
})
export class PreviewCanvasComponent {
  readonly page   = input.required<PreviewNode>();
  readonly layout = input.required<ConfiguracaoLayoutDto>();

  /** Emits when the user changes alignment via the ImageAlignmentBadge. */
  readonly alignmentChange = output<{ nodeRef: string; alinhamento: Alinhamento }>();

  fontFamily(): string {
    return this.layout().fonteCorpoFamilia === 'serif' ? 'Georgia, serif' : 'var(--font-body)';
  }

  paragrafos(): string[] {
    return (this.page().texto ?? '').split('\n\n').filter(Boolean);
  }

  onAlignmentChange(nodeRef: string, alinhamento: Alinhamento): void {
    this.alignmentChange.emit({ nodeRef, alinhamento });
  }
}
