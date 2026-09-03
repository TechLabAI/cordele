/**
 * exportacao-e-validacao.component.ts — T07 — Exportação e Validação.
 * Migrated from libs/pub (flat lib) to libs/pub/feature-export (P3 — FE-PUB-012).
 *
 * Removals vs prototype (FE-PUB-012):
 *   ✗ setInterval timer                — replaced by ExportFacade bounded poll (ADR-PUB-001)
 *   ✗ AVISOS_MOCK hard-coded array     — avisos detail not called (INT-FE-PUB-004 BLOCKED)
 *   ✗ "Simular estado" selector        — FE-PUB-018 removal; state driven by facade only
 *   ✗ progresso% numeric bar           — indeterminate only (SPEC-03)
 *   ✗ kpis[] with hard-coded values    — KPI tiles omitted (INT-FE-PUB-005 BLOCKED)
 *   ✗ mock-data imports               — zero; consumes ExportFacade from @cordele/pub-data-access
 *
 * podeBaixar = ExportFacade.podeBaixar (computed signal — R4, SPEC-03).
 * baixar() navigates to T08; never directly downloads bytes.
 * startExport() on ngOnInit always triggers a fresh build (SPEC-04 §1).
 *
 * Warnings / Errors: delegated to <pub-warnings-details> (FE-PUB-016, pub-ui).
 *
 * Boundary: type:feature → imports type:data-access (@cordele/pub-data-access)
 *           and type:ui (@cordele/pub-ui). No mock adapters in production path.
 *
 * Multi-empresa: ExportFacade injects PUB_EMPRESA_CHANGED token; cancels poll on
 * empresa switch (INT-FE-PUB-006, P2). No additional wiring needed here.
 *
 * Track D: FE-PUB-012 — P3 Feature Libs.
 */
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ExportFacade } from '@cordele/pub-data-access';
import { EpubSummaryGridComponent, WarningsDetailsComponent } from '@cordele/pub-ui';

const STEPS = [
  { n: 1, label: 'Importar' },
  { n: 2, label: 'Configurar' },
  { n: 3, label: 'Visualizar' },
  { n: 4, label: 'Exportar' },
];

@Component({
  selector: 'pub-exportacao-e-validacao',
  standalone: true,
  imports: [RouterLink, WarningsDetailsComponent, EpubSummaryGridComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="px-8 py-8 max-w-[var(--content-max-width)] mx-auto">

      <!-- Barra de etapas -->
      <nav class="flex items-center gap-1 mb-10 text-sm" aria-label="Etapas do pipeline editorial">
        @for (step of steps; track step.n) {
          <span class="flex items-center gap-1.5" [style]="stepStyle(step.n)">
            <span class="inline-flex items-center justify-center size-5 rounded-full text-xs font-bold"
                  [style]="dotStyle(step.n)">
              @if (step.n < 4) {
                <span class="material-symbols-outlined" style="font-size:12px;">check</span>
              } @else {
                {{ step.n }}
              }
            </span>
            {{ step.label }}
          </span>
          @if (!$last) {
            <span class="mx-2" style="color:var(--border-strong)">›</span>
          }
        }
      </nav>

      <!-- ESTADO: GERANDO (indeterminate — sem barra de progresso percentual, SPEC-03) -->
      @if (facade.phase() === 'gerando') {
        <div class="flex flex-col items-center justify-center py-16 text-center">
          <div class="relative mb-8">
            <div class="size-16 rounded-full border-4 border-t-transparent animate-spin"
                 style="border-color:oklch(58% 0.19 245 / 0.18);border-top-color:oklch(58% 0.19 245);"
                 role="progressbar" aria-label="Gerando ePub"></div>
          </div>
          <h1 class="font-display font-semibold text-xl mb-2" style="color:var(--text-primary)">
            Gerando seu ePub…
          </h1>
          <p class="text-sm" style="color:var(--text-secondary)">
            Compilando capítulos e verificando estrutura
          </p>
        </div>
      }

      <!-- ESTADO: VÁLIDO (epubcheckStatus = valido | avisos) -->
      @if (facade.phase() === 'valido') {
        <div>
          <!-- Resultado principal -->
          <div class="flex items-center gap-4 rounded-xl p-6 mb-6"
               style="background:oklch(58% 0.18 145 / 0.08);border:1px solid oklch(58% 0.18 145 / 0.3);">
            <span class="material-symbols-outlined text-4xl" style="color:oklch(58% 0.18 145)"
                  aria-hidden="true">
              check_circle
            </span>
            <div class="flex-1">
              <h1 class="font-display font-semibold text-lg" style="color:oklch(35% 0.14 145)">
                ePub válido e pronto para download
              </h1>
              <p class="text-sm mt-0.5" style="color:oklch(45% 0.12 145)">
                epubcheck: 0 erros · {{ facade.totalAvisos() }} aviso(s) não bloqueante(s)
              </p>
            </div>
          </div>

          <!-- KPI grid: ePub summary (INT-FE-PUB-005 resolved — ADR-004) -->
          <pub-epub-summary-grid
            [tamanho]="facade.summary()?.tamanho ?? null"
            [capitulos]="facade.summary()?.capitulos ?? null"
            [imagens]="facade.summary()?.imagens ?? null"
          />

          <!-- Avisos / Erros: delegados a WarningsDetailsComponent (FE-PUB-016) -->
          <pub-warnings-details
            [totalErros]="facade.totalErros()"
            [totalAvisos]="facade.totalAvisos()"
            [resumoErro]="facade.resumoErro()"
          />

          <!-- CTAs -->
          <div class="flex items-center justify-between mt-6">
            <a [routerLink]="['/comp/projetos', projetoId, 'editor-de-layout-preview']"
               class="text-sm flex items-center gap-1"
               style="color:var(--text-secondary)">
              <span class="material-symbols-outlined" style="font-size:16px;">arrow_back</span>
              Ajustar layout
            </a>
            <button
              [disabled]="!facade.podeBaixar()"
              (click)="baixar()"
              class="inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
              style="background:var(--color-brand);color:var(--text-on-brand);">
              <span class="material-symbols-outlined" style="font-size:18px;">download</span>
              Baixar ePub
            </button>
          </div>
        </div>
      }

      <!-- ESTADO: ERROS CRÍTICOS (epubcheckStatus = erros_criticos) -->
      @if (facade.phase() === 'erros') {
        <div>
          <div class="flex items-center gap-4 rounded-xl p-6 mb-6"
               style="background:oklch(52% 0.23 25 / 0.08);border:1px solid oklch(52% 0.23 25 / 0.3);">
            <span class="material-symbols-outlined text-4xl" style="color:var(--color-error)"
                  aria-hidden="true">error</span>
            <div class="flex-1">
              <h1 class="font-display font-semibold text-lg" style="color:oklch(35% 0.18 25)">
                Erros críticos — download bloqueado
              </h1>
              <p class="text-sm mt-0.5" style="color:oklch(45% 0.15 25)">
                epubcheck: {{ facade.totalErros() }} erro(s) · corrija antes de exportar
              </p>
            </div>
          </div>

          <!-- Avisos / Erros detalhados (contagens apenas — FE-PUB-016) -->
          <pub-warnings-details
            [totalErros]="facade.totalErros()"
            [totalAvisos]="facade.totalAvisos()"
            [resumoErro]="facade.resumoErro()"
          />

          <div class="flex items-center justify-between mt-6">
            <a [routerLink]="['/comp/projetos', projetoId, 'editor-de-layout-preview']"
               class="text-sm flex items-center gap-1"
               style="color:var(--text-secondary)">
              <span class="material-symbols-outlined" style="font-size:16px;">arrow_back</span>
              Ajustar layout
            </a>
            <span class="text-sm px-6 py-2.5 rounded-lg opacity-40"
                  style="background:var(--bg-surface-active);color:var(--text-tertiary)"
                  aria-disabled="true">
              Download indisponível
            </span>
          </div>
        </div>
      }

      <!-- ESTADO: ERRO DE REDE / TIMEOUT -->
      @if (facade.phase() === 'error') {
        <div class="flex flex-col items-center justify-center py-16 text-center gap-4">
          <span class="material-symbols-outlined text-4xl" style="color:var(--color-error)"
                aria-hidden="true">
            cloud_off
          </span>
          <p class="text-sm" style="color:var(--text-secondary)">
            {{ facade.error() ?? 'Erro ao exportar. Tente novamente.' }}
          </p>
          <button
            (click)="startExport()"
            class="inline-flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-semibold"
            style="background:var(--color-brand);color:var(--text-on-brand);">
            <span class="material-symbols-outlined" style="font-size:16px;">refresh</span>
            Tentar novamente
          </button>
        </div>
      }

    </div>
  `,
})
export class ExportacaoEValidacaoComponent implements OnInit {
  protected readonly facade = inject(ExportFacade);
  private  readonly  route  = inject(ActivatedRoute);

  readonly steps = STEPS;

  get projetoId(): string {
    return this.route.snapshot.paramMap.get('projetoId') ?? '';
  }

  ngOnInit(): void {
    this.startExport();
  }

  startExport(): void {
    this.facade.startExport(this.projetoId);
  }

  baixar(): void {
    this.facade.baixar(this.projetoId);
  }

  stepStyle(n: number): string {
    if (n < 4) return 'color:oklch(35% 0.14 145);font-weight:600';
    if (n === 4) return 'color:var(--color-brand);font-weight:600';
    return 'color:var(--text-tertiary)';
  }

  dotStyle(n: number): string {
    if (n < 4) return 'background:oklch(58% 0.18 145);color:#fff';
    if (n === 4) return 'background:var(--color-brand);color:var(--text-on-brand)';
    return 'background:var(--bg-surface-active);color:var(--text-tertiary)';
  }
}
