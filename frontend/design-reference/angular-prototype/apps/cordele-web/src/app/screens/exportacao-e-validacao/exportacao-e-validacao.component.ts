import { Component, ChangeDetectionStrategy, signal, computed, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { publicacao } from '../../shared/mock-data';
import { Publicacao, PublicacaoEpubcheckStatus } from '../../shared/data-model';

// Contrato: .build-plans/exportacao-e-validacao.plan.md
// T07 — Exportação e Validação — 3 estados: gerando / válido (com avisos) / erros críticos

type ViewState = 'gerando' | 'valido' | 'erros';
const STEPS = [
  { n: 1, label: 'Importar' }, { n: 2, label: 'Configurar' },
  { n: 3, label: 'Visualizar' }, { n: 4, label: 'Exportar' },
];
const AVISOS_MOCK = [
  { code: 'CSS-004', msg: 'Propriedade font-variant-numeric não amplamente suportada em leitores.', local: 'styles.css:12' },
  { code: 'NAV-002', msg: 'Documento NCX ausente (compatibilidade ePub 2). Opcional para ePub 3.', local: 'navegação' },
];

@Component({
  selector: 'app-exportacao-e-validacao',
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
              @if (step.n < 4) { <span class="material-symbols-outlined" style="font-size:12px;">check</span> }
              @else { {{ step.n }} }
            </span>
            {{ step.label }}
          </span>
          @if (!$last) { <span class="mx-2" style="color:var(--border-strong)">›</span> }
        }
      </nav>

      <!-- ESTADO: GERANDO -->
      @if (viewState() === 'gerando') {
        <div class="flex flex-col items-center justify-center py-16 text-center">
          <div class="relative mb-8">
            <div class="size-16 rounded-full border-4 border-t-transparent animate-spin"
                 style="border-color:oklch(58% 0.19 245 / 0.18);border-top-color:oklch(58% 0.19 245);"></div>
          </div>
          <h1 class="font-display font-semibold text-xl mb-2" style="color:var(--text-primary)">Gerando seu ePub…</h1>
          <p class="text-sm mb-6" style="color:var(--text-secondary)">
            Compilando capítulos e verificando estrutura
          </p>
          <div class="w-72 h-2 rounded-full overflow-hidden" style="background:var(--bg-surface-active);">
            <div class="h-full rounded-full transition-all duration-300"
                 style="background:linear-gradient(90deg,oklch(62% 0.19 245),oklch(68% 0.18 245));"
                 [style.width]="progresso() + '%'"></div>
          </div>
          <p class="text-xs mt-2" style="color:var(--text-tertiary)">{{ progresso() }}%</p>
        </div>
      }

      <!-- ESTADO: VÁLIDO (com avisos) -->
      @if (viewState() === 'valido') {
        <div>
          <!-- Resultado principal -->
          <div class="flex items-center gap-4 rounded-xl p-6 mb-6"
               style="background:oklch(58% 0.18 145 / 0.08);border:1px solid oklch(58% 0.18 145 / 0.3);">
            <span class="material-symbols-outlined text-4xl" style="color:oklch(58% 0.18 145)">check_circle</span>
            <div class="flex-1">
              <h1 class="font-display font-semibold text-lg" style="color:oklch(35% 0.14 145)">
                ePub válido e pronto para download
              </h1>
              <p class="text-sm mt-0.5" style="color:oklch(45% 0.12 145)">
                epubcheck: 0 erros · {{ pub().totalAvisos }} aviso(s) não bloqueante(s)
              </p>
            </div>
          </div>

          <!-- Resumo do ePub -->
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            @for (kpi of kpis; track kpi.label) {
              <div class="rounded-xl p-4 text-center" style="background:var(--bg-surface);border:1px solid var(--border-subtle);">
                <p class="font-display font-bold text-xl" style="color:var(--text-primary)">{{ kpi.value }}</p>
                <p class="text-xs" style="color:var(--text-secondary)">{{ kpi.label }}</p>
              </div>
            }
          </div>

          <!-- Avisos (não bloqueantes) -->
          @if (avisos.length > 0) {
            <details class="mb-6 rounded-xl overflow-hidden" style="border:1px solid oklch(78% 0.16 75 / 0.35);">
              <summary class="flex items-center gap-2 px-4 py-3 cursor-pointer text-sm font-medium"
                       style="background:oklch(78% 0.16 75 / 0.08);color:var(--color-warning-ink)">
                <span class="material-symbols-outlined" style="font-size:18px;">warning</span>
                {{ avisos.length }} aviso(s) — não impedem a publicação
                <span class="material-symbols-outlined ml-auto" style="font-size:18px;">expand_more</span>
              </summary>
              <ul class="divide-y" style="background:var(--bg-surface);">
                @for (av of avisos; track av.code) {
                  <li class="px-4 py-3" style="border-top:1px solid var(--border-subtle);">
                    <div class="flex items-start gap-3">
                      <code class="text-xs font-mono shrink-0 mt-0.5 px-1.5 py-0.5 rounded"
                            style="background:oklch(78% 0.16 75 / 0.12);color:var(--color-warning-ink)">{{ av.code }}</code>
                      <div>
                        <p class="text-sm" style="color:var(--text-primary)">{{ av.msg }}</p>
                        <p class="text-xs mt-0.5" style="color:var(--text-tertiary)">Local: {{ av.local }}</p>
                      </div>
                    </div>
                  </li>
                }
              </ul>
            </details>
          }

          <!-- CTAs -->
          <div class="flex items-center justify-between">
            <a routerLink="/editor-de-layout-preview" class="text-sm flex items-center gap-1"
               style="color:var(--text-secondary)">
              <span class="material-symbols-outlined" style="font-size:16px;">arrow_back</span>
              Ajustar layout
            </a>
            <a routerLink="/download-e-historico"
               class="inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90"
               style="background:var(--color-brand);color:var(--text-on-brand);">
              <span class="material-symbols-outlined" style="font-size:18px;">download</span>
              Baixar ePub
            </a>
          </div>
        </div>
      }

      <!-- ESTADO: ERROS CRÍTICOS (simulação) -->
      @if (viewState() === 'erros') {
        <div>
          <div class="flex items-center gap-4 rounded-xl p-6 mb-6"
               style="background:oklch(52% 0.23 25 / 0.08);border:1px solid oklch(52% 0.23 25 / 0.3);">
            <span class="material-symbols-outlined text-4xl" style="color:var(--color-error)">error</span>
            <div class="flex-1">
              <h1 class="font-display font-semibold text-lg" style="color:oklch(35% 0.18 25)">
                Erros críticos — download bloqueado
              </h1>
              <p class="text-sm mt-0.5" style="color:oklch(45% 0.15 25)">
                epubcheck: 3 erros · corrija antes de exportar
              </p>
            </div>
          </div>
          <p class="text-sm mb-6" style="color:var(--text-secondary)">
            (Estado de erro — alterne abaixo para simular)
          </p>
        </div>
      }

      <!-- Seletor de estado (prototype-only) -->
      <div class="mt-8 pt-6 border-t flex items-center gap-3 flex-wrap"
           style="border-color:var(--border-subtle);">
        <span class="text-xs font-medium" style="color:var(--text-tertiary)">Simular estado:</span>
        @for (s of ['gerando', 'valido', 'erros']; track s) {
          <button (click)="viewState.set($any(s))"
                  class="text-xs px-3 py-1.5 rounded-full transition-colors"
                  [style]="viewState() === s
                    ? 'background:var(--color-brand);color:var(--text-on-brand)'
                    : 'background:var(--bg-surface-active);color:var(--text-secondary)'">
            {{ s }}
          </button>
        }
      </div>

    </div>
  `,
})
export class ExportacaoEValidacaoComponent implements OnInit {
  readonly steps = STEPS;
  readonly avisos = AVISOS_MOCK;
  readonly kpis = [
    { label: 'Tamanho', value: '1,4 MB' },
    { label: 'Páginas', value: '156' },
    { label: 'Capítulos', value: '18' },
    { label: 'Imagens', value: '3' },
  ];

  pub       = signal<Publicacao>(publicacao[0]);
  progresso = signal(0);
  viewState = signal<ViewState>('gerando');

  ngOnInit() {
    let p = 0;
    const t = setInterval(() => {
      p += 10; this.progresso.set(p);
      if (p >= 100) { clearInterval(t); this.viewState.set('valido'); }
    }, 220);
  }

  stepStyle(n: number) {
    if (n < 4) return 'color:oklch(35% 0.14 145);font-weight:600';
    if (n === 4) return 'color:var(--color-brand);font-weight:600';
    return 'color:var(--text-tertiary)';
  }
  dotStyle(n: number) {
    if (n < 4) return 'background:oklch(58% 0.18 145);color:#fff';
    if (n === 4) return 'background:var(--color-brand);color:var(--text-on-brand)';
    return 'background:var(--bg-surface-active);color:var(--text-tertiary)';
  }
}
