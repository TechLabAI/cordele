/**
 * revisao-de-estrutura.component.ts — T04 Revisão de Estrutura (promoted, connected to ReviewFacade).
 * Prototype source: design-reference/.../screens/revisao-de-estrutura/revisao-de-estrutura.component.ts
 * Contracts honoured:
 *   - Hydrates from 201 body (router state) in happy path — zero GET (M2 D-A).
 *   - Deep-link path: load() via ManuscritoPort.get + SegmentoCuradoriaPort.getIgnored (forkJoin).
 *   - Ignorar: PERSISTENT with mandatory rollback on 4xx/5xx (FE-IMP-011 / §8.1).
 *   - Confirmar: calls POST /confirm-estrutura before navigating (FE-IMP-011 / §8.2).
 *   - 7 UnparsedReason values mapped to pt-BR labels (UNPARSED_REASON_LABEL).
 * Track D: promoted by fe-architect-promote IMP @ cordele (D-494).
 */
import {
  ChangeDetectionStrategy, Component, OnInit, computed, inject,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ReviewFacade } from '../review.facade';
import { UNPARSED_REASON_LABEL, UnparsedBlock } from '../models/imp.models';

const STEPS = [
  { n: 1, label: 'Importar' }, { n: 2, label: 'Configurar' },
  { n: 3, label: 'Visualizar' }, { n: 4, label: 'Exportar' },
];

@Component({
  selector: 'imp-revisao-de-estrutura',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="px-8 py-8 max-w-[var(--content-max-width)] mx-auto">

      <!-- Loading state (deep-link) -->
      @if (facade.loading()) {
        <div class="flex items-center justify-center py-24">
          <span class="material-symbols-outlined animate-spin text-4xl" style="color:var(--color-brand)">progress_activity</span>
        </div>
      }

      <!-- Error state -->
      @if (facade.error()) {
        <div class="rounded-xl p-6 text-center" style="background:oklch(52% 0.23 25 / 0.08);border:1px solid oklch(52% 0.23 25 / 0.3);">
          <span class="material-symbols-outlined text-3xl mb-2" style="color:var(--color-error)">error</span>
          <p class="text-sm" style="color:var(--color-error)">{{ facade.error() }}</p>
        </div>
      }

      @if (facade.manuscrito(); as ms) {

        <!-- Barra de etapas -->
        <nav class="flex items-center gap-1 mb-10 text-sm">
          @for (step of steps; track step.n) {
            <span class="flex items-center gap-1.5" [style]="stepStyle(step.n)">
              <span class="inline-flex items-center justify-center size-5 rounded-full text-xs font-bold"
                    [style]="dotStyle(step.n)">
                @if (step.n === 1) {
                  <span class="material-symbols-outlined" style="font-size:12px;">check</span>
                } @else {
                  {{ step.n }}
                }
              </span>
              {{ step.label }}
            </span>
            @if (!$last) { <span class="mx-2" style="color:var(--border-strong)">›</span> }
          }
        </nav>

        <div class="mb-8" style="border-left:4px solid oklch(42% 0.20 245);padding-left:14px;">
          <h1 class="font-display font-semibold text-2xl mb-1" style="color:var(--text-primary)">Estrutura detectada</h1>
          <p class="text-sm" style="color:var(--text-secondary)">{{ ms.nomeArquivo }}</p>
        </div>

        <!-- Contadores -->
        <div class="grid grid-cols-3 gap-4 mb-8">
          <div class="rounded-xl p-4 text-center"
               style="background:oklch(58% 0.18 145 / 0.08);border:1px solid oklch(58% 0.18 145 / 0.30);border-top:3px solid oklch(58% 0.18 145);">
            <span class="material-symbols-outlined text-2xl" style="color:oklch(42% 0.16 145)">check_circle</span>
            <p class="font-display font-bold text-2xl mt-1" style="color:var(--text-primary)">{{ ms.totalCapitulos }}</p>
            <p class="text-xs" style="color:var(--color-success-ink)">capítulos</p>
          </div>
          <div class="rounded-xl p-4 text-center"
               style="background:oklch(58% 0.19 245 / 0.08);border:1px solid oklch(58% 0.19 245 / 0.30);border-top:3px solid var(--color-brand);">
            <span class="material-symbols-outlined text-2xl" style="color:var(--color-brand)">image</span>
            <p class="font-display font-bold text-2xl mt-1" style="color:var(--text-primary)">{{ ms.totalImagens }}</p>
            <p class="text-xs" style="color:var(--color-brand-strong)">imagens</p>
          </div>
          <div class="rounded-xl p-4 text-center"
               style="background:oklch(78% 0.16 75 / 0.08);border:1px solid oklch(78% 0.16 75 / 0.35);border-top:3px solid var(--color-warning);">
            <span class="material-symbols-outlined text-2xl" style="color:oklch(55% 0.14 75)">warning</span>
            <p class="font-display font-bold text-2xl mt-1" style="color:var(--text-primary)">{{ pendenciasAtivas() }}</p>
            <p class="text-xs" style="color:var(--color-warning-ink)">pendências</p>
          </div>
        </div>

        <!-- Sumário + Pendências -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">

          <!-- Sumário -->
          <div class="rounded-xl overflow-hidden" style="border:1px solid var(--border-subtle);">
            <div class="px-4 py-2.5" style="background:var(--bg-surface-active);">
              <span class="text-xs font-bold uppercase tracking-wider" style="color:var(--text-tertiary)">Sumário</span>
            </div>
            <ul class="divide-y">
              @for (cap of previewChapters(); track cap.id) {
                <li class="flex items-center gap-2 px-4 py-2.5 text-sm"
                    style="background:var(--bg-surface);border-top:1px solid var(--border-subtle);">
                  <span class="material-symbols-outlined text-base" style="color:var(--color-brand)">arrow_right</span>
                  <span style="color:var(--text-primary)">{{ cap.title }}</span>
                </li>
              }
              @if (ms.totalCapitulos > previewChapters().length) {
                <li class="px-4 py-2 text-xs"
                    style="color:var(--text-tertiary);background:var(--bg-surface);border-top:1px solid var(--border-subtle);">
                  + {{ ms.totalCapitulos - previewChapters().length }} capítulos…
                </li>
              }
            </ul>
          </div>

          <!-- Pendências -->
          <div class="rounded-xl overflow-hidden" style="border:1px solid var(--border-subtle);">
            <div class="px-4 py-2.5" style="background:var(--bg-surface-active);">
              <span class="text-xs font-bold uppercase tracking-wider" style="color:var(--text-tertiary)">Pendências</span>
            </div>
            @if (unparsedBlocks().length === 0) {
              <div class="px-4 py-8 text-center text-sm"
                   style="color:var(--text-tertiary);background:var(--bg-surface);">
                Nenhuma pendência detectada
              </div>
            }
            @for (blk of unparsedBlocks(); track blk.id) {
              <div class="px-4 py-3 text-sm"
                   style="background:var(--bg-surface);border-top:1px solid var(--border-subtle);"
                   [style.opacity]="isIgnored(blk.id) ? '0.45' : '1'">
                <div class="flex items-start justify-between gap-2">
                  <div>
                    <p class="font-medium" style="color:var(--color-warning-ink)">
                      {{ reasonLabel(blk) }}
                    </p>
                    <p class="text-xs mt-0.5" style="color:var(--text-secondary)">
                      Pág. ~{{ sourceRef(blk) }}
                    </p>
                    <p class="text-xs mt-0.5" style="color:var(--text-tertiary)">
                      Segmento {{ blk.id }}
                    </p>
                  </div>
                  @if (!isIgnored(blk.id)) {
                    <button (click)="ignorar(blk.id)"
                            class="text-xs underline shrink-0"
                            style="color:var(--text-tertiary)">Ignorar</button>
                  } @else {
                    <button (click)="restaurar(blk.id)"
                            class="text-xs underline shrink-0"
                            style="color:var(--text-tertiary)">Restaurar</button>
                  }
                </div>
              </div>
            }
          </div>

        </div>

        <!-- Confirm error toast -->
        @if (facade.confirmError()) {
          <div class="mb-4 rounded-lg px-4 py-3 text-sm flex items-center gap-2"
               style="background:oklch(52% 0.23 25 / 0.08);border:1px solid oklch(52% 0.23 25 / 0.3);color:var(--color-error);">
            <span class="material-symbols-outlined" style="font-size:16px;">error</span>
            {{ facade.confirmError() }}
          </div>
        }

        <!-- CTAs -->
        <div class="flex items-center justify-between">
          <a routerLink="/imp/upload" class="text-sm flex items-center gap-1"
             style="color:var(--text-secondary);">
            <span class="material-symbols-outlined" style="font-size:16px;">arrow_back</span>
            Reimportar outro arquivo
          </a>
          <button (click)="confirmar()"
                  [disabled]="facade.confirmando()"
                  class="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
                  [style]="!facade.confirmando()
                    ? 'background:var(--color-brand);color:var(--text-on-brand);'
                    : 'background:var(--bg-surface-active);color:var(--text-tertiary);cursor:not-allowed;'">
            {{ facade.confirmando() ? 'Confirmando…' : 'Confirmar estrutura' }}
            <span class="material-symbols-outlined" style="font-size:18px;">arrow_forward</span>
          </button>
        </div>

      }
    </div>
  `,
})
export class RevisaoDeEstruturaComponent implements OnInit {
  readonly facade = inject(ReviewFacade);
  readonly route  = inject(ActivatedRoute);
  readonly steps  = STEPS;

  // ── Derived views ─────────────────────────────────────────────────────────

  previewChapters = computed(() => {
    const ms = this.facade.manuscrito();
    return ms?.estrutura.chapters.slice(0, 5) ?? [];
  });

  unparsedBlocks = computed((): UnparsedBlock[] => {
    const ms = this.facade.manuscrito();
    if (!ms) return [];
    const blocks: UnparsedBlock[] = [];
    for (const ch of ms.estrutura.chapters) {
      for (const b of ch.blocks) {
        if (b.type === 'unparsed') blocks.push(b as UnparsedBlock);
      }
      for (const sec of ch.sections) {
        for (const b of sec.blocks) {
          if (b.type === 'unparsed') blocks.push(b as UnparsedBlock);
        }
      }
    }
    return blocks;
  });

  pendenciasAtivas = computed(() =>
    this.unparsedBlocks().filter(b => !this.isIgnored(b.id)).length,
  );

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const nav = history.state as { manuscrito?: unknown };
    if (nav?.manuscrito) {
      // Happy path: hydrate from 201 response (zero GET)
      this.facade.hydrateFromResponse(nav.manuscrito as Parameters<ReviewFacade['hydrateFromResponse']>[0]);
    } else {
      // Deep-link / reload: fetch from API (forkJoin manuscrito + ignored)
      const manuscritoId = this.route.snapshot.paramMap.get('manuscritoId');
      if (manuscritoId) this.facade.load(manuscritoId);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  isIgnored(id: string): boolean {
    return this.facade.ignoredIds().has(id);
  }

  ignorar(id: string): void {
    this.facade.ignorarSegmento(id);
  }

  restaurar(id: string): void {
    this.facade.restaurarSegmento(id);
  }

  confirmar(): void {
    this.facade.confirmarEstrutura();
  }

  reasonLabel(blk: UnparsedBlock): string {
    return UNPARSED_REASON_LABEL[blk.reason] ?? blk.reason;
  }

  sourceRef(blk: UnparsedBlock): string {
    const loc = blk.sourceLocation;
    if (loc.kind === 'docx') return `par. ${loc.paragraphIndex}`;
    if (loc.kind === 'markdown') return `linha ${loc.line}`;
    return '?';
  }

  stepStyle(n: number) {
    if (n === 1) return 'color:oklch(35% 0.14 145);font-weight:600';
    if (n === 2) return 'color:var(--color-brand);font-weight:600';
    return 'color:var(--text-tertiary)';
  }
  dotStyle(n: number) {
    if (n === 1) return 'background:oklch(58% 0.18 145);color:#fff';
    if (n === 2) return 'background:var(--color-brand);color:var(--text-on-brand)';
    return 'background:var(--bg-surface-active);color:var(--text-tertiary)';
  }
}
