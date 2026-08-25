/**
 * biblioteca-de-projetos.component.ts — T02 Biblioteca de Projetos.
 * Promoted from design-reference/angular-prototype (D-493/D-494).
 * Connected to LibraryFacade (signals-based, ADR-007). Mock data removed.
 * OnPush + standalone (required by policy).
 *
 * Behaviours preserved from prototype:
 *   - Badge derivation: rascunho/em_composicao → project status; publication exists → epubcheck (SPEC-03 §3)
 *   - degraded=true: renders identity + status, never error state (api-contract §4.2 + SPEC-03 §1)
 *   - Loading skeletons during 'loading' state (CLS-safe, SPEC-03 EARS)
 *   - Empty state only when status==='empty' (no flicker while loading)
 *   - Quick download opens signed URL directly in new tab (D-F)
 * Track D: promoted by fe-architect-promote PROJ @ cordele (D-494).
 */
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { LibraryFacade, LibraryStatus } from '../library.facade';
import { ProjetoCardVM } from '../models/proj.models';

@Component({
  selector: 'proj-biblioteca-de-projetos',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="px-8 py-8 max-w-[var(--content-max-width)] mx-auto">

      <!-- Header -->
      <div class="flex items-center justify-between mb-8">
        <div style="border-left:4px solid oklch(42% 0.20 245);padding-left:14px;">
          <h1 class="font-display font-semibold text-2xl" style="color:var(--text-primary)">Seus projetos</h1>
          <p class="mt-1 text-sm" style="color:var(--text-secondary)">
            @if (facade.status() === 'ready') {
              {{ facade.projects().length }} projeto(s)
              @if (facade.empresaNome()) { · {{ facade.empresaNome() }} }
              @if (facade.degraded()) {
                <span class="ml-2 text-xs" style="color:var(--color-warn-ink)">(dados parciais)</span>
              }
            }
          </p>
        </div>
        <button
          (click)="facade.onNewProject()"
          class="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
          style="background:var(--color-brand);color:var(--text-on-brand);">
          <span class="material-symbols-outlined" style="font-size:18px;">add</span>
          Novo projeto
        </button>
      </div>

      <!-- Loading skeletons (CLS-safe — never render empty state here) -->
      @if (facade.status() === 'loading') {
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          @for (_ of [1,2,3,4]; track $index) {
            <div class="rounded-xl p-5 animate-pulse" style="background:var(--bg-surface);border:1px solid var(--border-subtle);height:120px;"></div>
          }
        </div>
      }

      <!-- Error state -->
      @if (facade.status() === 'error') {
        <div class="flex flex-col items-center justify-center py-16 text-center">
          <span class="material-symbols-outlined text-4xl mb-3" style="color:var(--color-error-ink)">error_outline</span>
          <p class="font-medium mb-4" style="color:var(--text-primary)">Não foi possível carregar seus projetos.</p>
          <button (click)="facade.retry()"
                  class="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold"
                  style="background:var(--color-brand);color:var(--text-on-brand);">
            Tentar novamente
          </button>
        </div>
      }

      <!-- Estado vazio (only when ready + zero projects — no flicker while loading) -->
      @if (facade.isEmpty()) {
        <div class="flex flex-col items-center justify-center py-24 text-center rounded-xl"
             style="border:2px dashed var(--border-default);">
          <span class="material-symbols-outlined text-5xl mb-4" style="color:var(--text-tertiary)">library_books</span>
          <p class="font-medium" style="color:var(--text-secondary)">Nenhum projeto ainda</p>
          <p class="text-sm mt-1 mb-6" style="color:var(--text-tertiary)">
            Envie seu primeiro manuscrito para começar.
          </p>
          <button (click)="facade.onNewProject()"
                  class="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold"
                  style="background:var(--color-brand);color:var(--text-on-brand);">
            <span class="material-symbols-outlined" style="font-size:18px;">upload_file</span>
            Enviar manuscrito
          </button>
        </div>
      }

      <!-- Grid de cards -->
      @if (facade.status() === 'ready' && !facade.isEmpty()) {
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          @for (proj of facade.projects(); track proj.id) {
            <div class="flex flex-col rounded-xl p-5 transition-shadow hover:shadow-md"
                 [style]="'background:var(--bg-surface);border:1px solid var(--border-subtle);box-shadow:var(--shadow-sm);border-left:4px solid ' + cardAccent(proj)">

              <div class="flex items-start justify-between gap-3 mb-1">
                <h2 class="font-display font-semibold text-base leading-snug"
                    style="color:var(--text-primary)">{{ proj.nome }}</h2>
                <span class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shrink-0"
                      [style]="badgeStyle(proj)">
                  <span class="material-symbols-outlined" style="font-size:13px;">{{ proj.badge.icon }}</span>
                  {{ proj.badge.label }}
                </span>
              </div>

              @if (proj.autor) {
                <p class="text-sm" style="color:var(--text-secondary)">{{ proj.autor }}</p>
              } @else {
                <p class="text-sm italic" style="color:var(--text-tertiary)">Autor não definido</p>
              }

              <div class="mt-4 flex items-center justify-between">
                <span class="text-xs" style="color:var(--text-tertiary)">
                  Atualizado {{ fmtDate(proj.ultimaAtividadeEm) }}
                </span>
                <div class="flex items-center gap-2">
                  @if (proj.canQuickDownload) {
                    <button
                      (click)="facade.onQuickDownload(proj)"
                      title="Baixar ePub"
                      class="inline-flex items-center justify-center size-8 rounded-lg transition-colors"
                      style="color:var(--text-secondary);"
                      onmouseenter="this.style.background='var(--bg-surface-hover)'"
                      onmouseleave="this.style.background='transparent'">
                      <span class="material-symbols-outlined" style="font-size:18px;">download</span>
                    </button>
                  }
                  <button
                    (click)="facade.onOpen(proj)"
                    class="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90"
                    style="background:var(--color-brand);color:var(--text-on-brand);">
                    Abrir
                  </button>
                </div>
              </div>

            </div>
          }
        </div>
      }

    </div>
  `,
})
export class BibliotecaDeProjetosComponent implements OnInit {
  protected readonly facade = inject(LibraryFacade);

  ngOnInit(): void {
    this.facade.load();
  }

  fmtDate(iso: string | null): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  }

  /** Map badge tone → border-left accent colour (same palette as prototype). */
  cardAccent(proj: ProjetoCardVM): string {
    const map: Record<string, string> = {
      draft:    'oklch(78% 0.16 75)',
      progress: 'oklch(58% 0.19 245)',
      valid:    'oklch(58% 0.18 145)',
      warn:     'oklch(58% 0.18 145)',
      error:    'oklch(52% 0.23 25)',
      pending:  'var(--border-subtle)',
    };
    return map[proj.badge.tone] ?? 'var(--border-subtle)';
  }

  badgeStyle(proj: ProjetoCardVM): string {
    const map: Record<string, string> = {
      draft:    'background:oklch(78% 0.16 75 / 0.14);color:oklch(40% 0.14 75);border:1px solid oklch(78% 0.16 75 / 0.40)',
      progress: 'background:oklch(58% 0.19 245 / 0.14);color:oklch(40% 0.19 245);border:1px solid oklch(58% 0.19 245 / 0.40)',
      valid:    'background:oklch(58% 0.18 145 / 0.14);color:oklch(30% 0.14 145);border:1px solid oklch(58% 0.18 145 / 0.40)',
      warn:     'background:oklch(58% 0.18 145 / 0.14);color:oklch(30% 0.14 145);border:1px solid oklch(58% 0.18 145 / 0.40)',
      error:    'background:oklch(52% 0.23 25 / 0.14);color:oklch(32% 0.18 25);border:1px solid oklch(52% 0.23 25 / 0.40)',
      pending:  'background:var(--bg-surface-active);color:var(--text-tertiary);border:1px solid var(--border-subtle)',
    };
    return map[proj.badge.tone] ?? '';
  }
}
