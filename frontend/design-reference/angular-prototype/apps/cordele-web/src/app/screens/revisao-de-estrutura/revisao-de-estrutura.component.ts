import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { manuscrito } from '../../shared/mock-data';

// Contrato: .build-plans/revisao-de-estrutura.plan.md
// T04 — Revisão de Estrutura — sumário + painel de pendências, princípio 2.1

interface Trecho { id: string; pagina: number; capitulo: string; tipo: string; descricao: string; ignorado: boolean; }

const TRECHOS: Trecho[] = [
  { id: 't1', pagina: 34, capitulo: 'Capítulo 1 — O Rio',     tipo: 'tabela',         descricao: 'Tabela de formatação não suportada. Elementos de célula ignorados.', ignorado: false },
  { id: 't2', pagina: 67, capitulo: 'Capítulo 3 — O Retorno', tipo: 'caixa de texto', descricao: 'Caixa de texto lateral (text box). Conteúdo não mapeado para ePub.',  ignorado: false },
];
const CAPS = Array.from({ length: 5 }, (_, i) => ({
  n: i + 1, titulo: ['O Rio', 'A Cidade', 'O Retorno', 'O Mercado', 'A Noite'][i],
}));
const STEPS = [
  { n: 1, label: 'Importar' }, { n: 2, label: 'Configurar' },
  { n: 3, label: 'Visualizar' }, { n: 4, label: 'Exportar' },
];

@Component({
  selector: 'app-revisao-de-estrutura',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="px-8 py-8 max-w-[var(--content-max-width)] mx-auto">

      <!-- Barra de etapas -->
      <nav class="flex items-center gap-1 mb-10 text-sm">
        @for (step of steps; track step.n) {
          <span class="flex items-center gap-1.5" [style]="stepStyle(step.n)">
            <span class="inline-flex items-center justify-center size-5 rounded-full text-xs font-bold"
                  [style]="dotStyle(step.n)">
              @if (step.n === 1) { <span class="material-symbols-outlined" style="font-size:12px;">check</span> }
              @else { {{ step.n }} }
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
          <p class="font-display font-bold text-2xl mt-1" style="color:var(--text-primary)">{{ ms.trechosNaoParseados }}</p>
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
          <ul class="divide-y" style="--tw-divide-opacity:1;">
            @for (cap of caps; track cap.n) {
              <li class="flex items-center gap-2 px-4 py-2.5 text-sm"
                  style="background:var(--bg-surface);border-top:1px solid var(--border-subtle);">
                <span class="material-symbols-outlined text-base" style="color:var(--color-brand)">arrow_right</span>
                <span style="color:var(--text-primary)">Capítulo {{ cap.n }} — {{ cap.titulo }}</span>
              </li>
            }
            <li class="px-4 py-2 text-xs" style="color:var(--text-tertiary);background:var(--bg-surface);border-top:1px solid var(--border-subtle);">
              + {{ ms.totalCapitulos - caps.length }} capítulos…
            </li>
          </ul>
        </div>

        <!-- Pendências -->
        <div class="rounded-xl overflow-hidden" style="border:1px solid var(--border-subtle);">
          <div class="px-4 py-2.5" style="background:var(--bg-surface-active);">
            <span class="text-xs font-bold uppercase tracking-wider" style="color:var(--text-tertiary)">Pendências</span>
          </div>
          @if (trechos().length === 0) {
            <div class="px-4 py-8 text-center text-sm" style="color:var(--text-tertiary);background:var(--bg-surface);">
              Nenhuma pendência detectada
            </div>
          }
          @for (t of trechos(); track t.id) {
            <div class="px-4 py-3 text-sm"
                 style="background:var(--bg-surface);border-top:1px solid var(--border-subtle);"
                 [style.opacity]="t.ignorado ? '0.45' : '1'">
              <div class="flex items-start justify-between gap-2">
                <div>
                  <p class="font-medium" style="color:var(--color-warning-ink)">
                    Pág. {{ t.pagina }}: {{ t.tipo }}
                  </p>
                  <p class="text-xs mt-0.5" style="color:var(--text-secondary)">{{ t.capitulo }}</p>
                  <p class="text-xs mt-0.5" style="color:var(--text-tertiary)">{{ t.descricao }}</p>
                </div>
                @if (!t.ignorado) {
                  <button (click)="ignorar(t.id)" class="text-xs underline shrink-0"
                          style="color:var(--text-tertiary)">Ignorar</button>
                } @else {
                  <span class="text-xs shrink-0" style="color:var(--text-tertiary)">Ignorado</span>
                }
              </div>
            </div>
          }
        </div>

      </div>

      <!-- CTAs -->
      <div class="flex items-center justify-between">
        <a routerLink="/upload" class="text-sm flex items-center gap-1"
           style="color:var(--text-secondary);">
          <span class="material-symbols-outlined" style="font-size:16px;">arrow_back</span>
          Reimportar outro arquivo
        </a>
        <a routerLink="/config"
           class="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
           style="background:var(--color-brand);color:var(--text-on-brand);">
          Confirmar estrutura
          <span class="material-symbols-outlined" style="font-size:18px;">arrow_forward</span>
        </a>
      </div>

    </div>
  `,
})
export class RevisaoDeEstruturaComponent {
  readonly ms     = manuscrito[0];
  readonly caps   = CAPS;
  readonly steps  = STEPS;
  readonly trechos = signal<Trecho[]>(TRECHOS);

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
  ignorar(id: string) {
    this.trechos.update(ts => ts.map(t => t.id === id ? { ...t, ignorado: true } : t));
  }
}
