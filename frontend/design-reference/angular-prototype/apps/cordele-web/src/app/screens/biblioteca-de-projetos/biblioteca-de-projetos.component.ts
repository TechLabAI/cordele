import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { projetos } from '../../shared/mock-data';
import { ProjetoEditorial, ProjetoEditorialStatus } from '../../shared/data-model';

// Contrato: .build-plans/biblioteca-de-projetos.plan.md
// T02 — Biblioteca de Projetos — grid de cards, badge de status, estado vazio

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

@Component({
  selector: 'app-biblioteca-de-projetos',
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
            {{ lista().length }} projeto(s) · Editora Aetós
          </p>
        </div>
        <a routerLink="/upload"
           class="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
           style="background:var(--color-brand);color:var(--text-on-brand);">
          <span class="material-symbols-outlined" style="font-size:18px;">add</span>
          Novo projeto
        </a>
      </div>

      <!-- Estado vazio -->
      @if (lista().length === 0) {
        <div class="flex flex-col items-center justify-center py-24 text-center rounded-xl"
             style="border:2px dashed var(--border-default);">
          <span class="material-symbols-outlined text-5xl mb-4" style="color:var(--text-tertiary)">library_books</span>
          <p class="font-medium" style="color:var(--text-secondary)">Nenhum projeto ainda</p>
          <p class="text-sm mt-1 mb-6" style="color:var(--text-tertiary)">
            Envie seu primeiro manuscrito para começar.
          </p>
          <a routerLink="/upload"
             class="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold"
             style="background:var(--color-brand);color:var(--text-on-brand);">
            <span class="material-symbols-outlined" style="font-size:18px;">upload_file</span>
            Enviar manuscrito
          </a>
        </div>
      }

      <!-- Grid de cards -->
      @if (lista().length > 0) {
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          @for (proj of lista(); track proj.id) {
            <div class="flex flex-col rounded-xl p-5 transition-shadow hover:shadow-md"
                 [style]="'background:var(--bg-surface);border:1px solid var(--border-subtle);box-shadow:var(--shadow-sm);border-left:4px solid ' + cardAccent(proj.status)">

              <div class="flex items-start justify-between gap-3 mb-1">
                <h2 class="font-display font-semibold text-base leading-snug"
                    style="color:var(--text-primary)">{{ proj.nome }}</h2>
                <span class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold shrink-0"
                      [style]="badgeStyle(proj.status)">
                  <span class="material-symbols-outlined" style="font-size:13px;">{{ statusIcon(proj.status) }}</span>
                  {{ statusLabel(proj.status) }}
                </span>
              </div>

              <p class="text-sm" style="color:var(--text-secondary)">{{ proj.editora }}</p>

              <div class="mt-4 flex items-center justify-between">
                <span class="text-xs" style="color:var(--text-tertiary)">
                  Atualizado {{ fmtDate(proj.ultimaAtividade) }}
                </span>
                <div class="flex items-center gap-2">
                  <button title="Baixar ePub"
                          class="inline-flex items-center justify-center size-8 rounded-lg transition-colors"
                          style="color:var(--text-secondary);"
                          onmouseenter="this.style.background='var(--bg-surface-hover)'"
                          onmouseleave="this.style.background='transparent'">
                    <span class="material-symbols-outlined" style="font-size:18px;">download</span>
                  </button>
                  <a routerLink="/editor-de-layout-preview"
                     class="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90"
                     style="background:var(--color-brand);color:var(--text-on-brand);">
                    Abrir
                  </a>
                </div>
              </div>

            </div>
          }
        </div>
      }

    </div>
  `,
})
export class BibliotecaDeProjetosComponent {
  readonly lista = signal<ProjetoEditorial[]>(projetos);
  fmtDate = fmtDate;

  statusLabel(s: ProjetoEditorialStatus): string {
    return { rascunho: 'Rascunho', em_composicao: 'Em andamento', publicado: 'Válido', com_erros: 'Erros' }[s];
  }
  statusIcon(s: ProjetoEditorialStatus): string {
    return { rascunho: 'edit_note', em_composicao: 'pending', publicado: 'check_circle', com_erros: 'error' }[s];
  }
  badgeStyle(s: ProjetoEditorialStatus): string {
    return {
      rascunho:      'background:oklch(78% 0.16 75 / 0.14);color:oklch(40% 0.14 75);border:1px solid oklch(78% 0.16 75 / 0.40)',
      em_composicao: 'background:oklch(58% 0.19 245 / 0.14);color:oklch(40% 0.19 245);border:1px solid oklch(58% 0.19 245 / 0.40)',
      publicado:     'background:oklch(58% 0.18 145 / 0.14);color:oklch(30% 0.14 145);border:1px solid oklch(58% 0.18 145 / 0.40)',
      com_erros:     'background:oklch(52% 0.23 25 / 0.14);color:oklch(32% 0.18 25);border:1px solid oklch(52% 0.23 25 / 0.40)',
    }[s];
  }
  cardAccent(s: ProjetoEditorialStatus): string {
    return {
      rascunho:      'oklch(78% 0.16 75)',
      em_composicao: 'oklch(58% 0.19 245)',
      publicado:     'oklch(58% 0.18 145)',
      com_erros:     'oklch(52% 0.23 25)',
    }[s];
  }
}
