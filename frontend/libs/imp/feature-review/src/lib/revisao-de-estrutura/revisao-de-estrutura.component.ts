/**
 * revisao-de-estrutura.component.ts — T04 Revisão de Estrutura (smart component).
 * Promoted from prototype (D-494).
 *
 * Contracts honoured:
 *   - Hydrates from 201 body (router state) in happy path — zero GET (M2 D-A).
 *   - Deep-link path: loadStructure(manuscritoId) via ReviewFacade.
 *   - ignorarSegmento / restaurarSegmento: PERSISTENT with rollback on 4xx/5xx (FE-IMP-011).
 *   - confirmarEstrutura: calls POST /confirm-estrutura before navigating (FE-IMP-011).
 *   - INT-FE-IMP-003: confirmarEstrutura navigates to /comp (fallback /proj/biblioteca).
 *
 * P4 update: uses presentational sub-components (FE-IMP-017, FE-IMP-022).
 */
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ReviewFacade } from '@cordele/imp/data-access';
import { ContentTreeComponent } from '../content-tree/content-tree.component';
import { ContentTreeSkeletonComponent } from '../content-tree-skeleton/content-tree-skeleton.component';
import { ActionBarComponent } from '../action-bar/action-bar.component';

const STEPS = ['Importar', 'Configurar', 'Visualizar', 'Exportar'];

@Component({
  selector: 'imp-revisao-de-estrutura',
  standalone: true,
  imports: [
    ContentTreeComponent,
    ContentTreeSkeletonComponent,
    ActionBarComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="px-8 py-8 max-w-[var(--content-max-width)] mx-auto">

      <!-- Loading skeleton (deep-link path) -->
      @if (facade.phase() === 'loading') {
        <imp-content-tree-skeleton />
      }

      <!-- Top-level error (load or ignore error) -->
      @if (facade.errorMessage() && facade.phase() === 'error') {
        <div class="rounded-xl p-6 text-center mb-6"
             style="background:oklch(52% 0.23 25 / 0.08);border:1px solid oklch(52% 0.23 25 / 0.3);">
          <span class="material-symbols-outlined text-3xl mb-2" style="color:var(--color-error)">error</span>
          <p class="text-sm" style="color:var(--color-error)">{{ facade.errorMessage() }}</p>
        </div>
      }

      @if (facade.manuscrito(); as ms) {

        <!-- Step progress bar (inline — StepBarComponent from imp-navigation goes here in P5) -->
        <nav class="flex items-center gap-1 mb-10 text-sm">
          @for (step of steps; track $index) {
            <span class="flex items-center gap-1.5" [style]="stepStyle($index)">
              <span class="inline-flex items-center justify-center size-5 rounded-full text-xs font-bold"
                    [style]="dotStyle($index)">
                @if ($index === 0) {
                  <span class="material-symbols-outlined" style="font-size:12px;">check</span>
                } @else {
                  {{ $index + 1 }}
                }
              </span>
              {{ step }}
            </span>
            @if (!$last) { <span class="mx-2" style="color:var(--border-strong)">›</span> }
          }
        </nav>

        <div class="mb-8" style="border-left:4px solid oklch(42% 0.20 245);padding-left:14px;">
          <h1 class="font-display font-semibold text-2xl mb-1" style="color:var(--text-primary)">Estrutura detectada</h1>
          <p class="text-sm" style="color:var(--text-secondary)">{{ ms.nomeArquivo }}</p>
        </div>

        <!-- Summary counters -->
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

        <!-- Sumário + Pendências (ContentTree) -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">

          <!-- Sumário de capítulos (inline — no sub-component needed) -->
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

          <!-- Pendências list via ContentTreeComponent -->
          <imp-content-tree
            [tree]="ms.estrutura"
            [ignoredIds]="facade.ignoredIds()"
            (ignore)="ignorar($event)"
            (restore)="restaurar($event)"
          />

        </div>

        <!-- Confirm error toast -->
        @if (facade.errorMessage() && facade.phase() === 'confirming') {
          <div class="mb-4 rounded-lg px-4 py-3 text-sm flex items-center gap-2"
               style="background:oklch(52% 0.23 25 / 0.08);border:1px solid oklch(52% 0.23 25 / 0.3);color:var(--color-error);">
            <span class="material-symbols-outlined" style="font-size:16px;">error</span>
            {{ facade.errorMessage() }}
          </div>
        }

        <!-- Action bar (Reimportar / Confirmar) -->
        <imp-action-bar
          [canConfirm]="facade.phase() !== 'confirming'"
          [canIgnore]="pendenciasAtivas() > 0"
          (confirm)="confirmar()"
        />

      }

      <!-- Zero-chapters warning modal (imp-zero-chapters EARS / FE-IMP-011) -->
      @if (showZeroChaptersModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center"
             style="background:oklch(0% 0 0 / 0.5);">
          <div class="rounded-2xl p-8 shadow-xl max-w-sm w-full mx-4"
               style="background:var(--bg-surface);border:1px solid var(--border-subtle);">
            <div class="flex items-center gap-3 mb-4">
              <span class="material-symbols-outlined text-3xl" style="color:var(--color-warning)">warning</span>
              <h2 class="font-display font-semibold text-lg" style="color:var(--text-primary)">
                Nenhum capítulo detectado
              </h2>
            </div>
            <p class="text-sm mb-6" style="color:var(--text-secondary)">
              O manuscrito não possui capítulos identificados. Confirmar a estrutura sem capítulos
              pode produzir um ePub vazio. Deseja prosseguir mesmo assim?
            </p>
            <div class="flex justify-end gap-3">
              <button
                (click)="showZeroChaptersModal.set(false)"
                class="rounded-lg px-4 py-2 text-sm"
                style="background:var(--bg-surface-active);color:var(--text-secondary);"
              >
                Cancelar
              </button>
              <button
                (click)="confirmarMesmoAssim()"
                class="rounded-lg px-4 py-2 text-sm font-semibold"
                style="background:var(--color-brand);color:var(--text-on-brand);"
              >
                Confirmar mesmo assim
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class RevisaoDeEstruturaComponent implements OnInit {
  readonly facade = inject(ReviewFacade);
  readonly route  = inject(ActivatedRoute);
  readonly steps  = STEPS;

  // ── Zero-chapters modal state (imp-zero-chapters EARS / FE-IMP-011) ───────
  /** True when the zero-chapters warning modal is visible. */
  readonly showZeroChaptersModal = signal(false);

  // ── Derived views ─────────────────────────────────────────────────────────

  previewChapters = computed(() => {
    const ms = this.facade.manuscrito();
    return ms?.estrutura.chapters.slice(0, 5) ?? [];
  });

  pendenciasAtivas = computed(() => {
    const ms = this.facade.manuscrito();
    if (!ms) return 0;
    let count = 0;
    for (const ch of ms.estrutura.chapters) {
      for (const b of ch.blocks) {
        if (b.type === 'unparsed' && !this.facade.ignoredIds().has(b.id)) count++;
      }
      for (const sec of ch.sections) {
        for (const b of sec.blocks) {
          if (b.type === 'unparsed' && !this.facade.ignoredIds().has(b.id)) count++;
        }
      }
    }
    return count;
  });

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const nav = history.state as { manuscrito?: unknown };
    if (nav?.manuscrito) {
      // Happy path: hydrate from 201 response (zero GET)
      this.facade.hydrateFromResponse(nav.manuscrito as Parameters<ReviewFacade['hydrateFromResponse']>[0]);
    } else {
      // Deep-link / reload: fetch from API
      const manuscritoId = this.route.snapshot.paramMap.get('manuscritoId');
      if (manuscritoId) this.facade.loadStructure(manuscritoId);
    }
  }

  // ── Handlers (wired to sub-component outputs) ─────────────────────────────

  ignorar(id: string): void {
    this.facade.ignorarSegmento(id);
  }

  restaurar(id: string): void {
    this.facade.restaurarSegmento(id);
  }

  /**
   * Handles "Confirmar estrutura" click from ActionBarComponent.
   * If the manuscrito has zero chapters, shows the zero-chapters warning modal
   * instead of proceeding immediately (EARS criterion imp-zero-chapters).
   * Otherwise calls confirmarEstrutura() directly.
   */
  confirmar(): void {
    const ms = this.facade.manuscrito();
    if (ms && ms.totalCapitulos === 0) {
      this.showZeroChaptersModal.set(true);
      return;
    }
    this.facade.confirmarEstrutura();
  }

  /**
   * Called by the "Confirmar mesmo assim" button in the zero-chapters modal.
   * Bypasses the zero-chapters check and proceeds with structure confirmation.
   */
  confirmarMesmoAssim(): void {
    this.showZeroChaptersModal.set(false);
    this.facade.confirmarEstrutura();
  }

  // ── Style helpers ─────────────────────────────────────────────────────────

  stepStyle(index: number): string {
    if (index === 0) return 'color:oklch(35% 0.14 145);font-weight:600';
    if (index === 1) return 'color:var(--color-brand);font-weight:600';
    return 'color:var(--text-tertiary)';
  }

  dotStyle(index: number): string {
    if (index === 0) return 'background:oklch(58% 0.18 145);color:#fff';
    if (index === 1) return 'background:var(--color-brand);color:var(--text-on-brand)';
    return 'background:var(--bg-surface-active);color:var(--text-tertiary)';
  }
}
