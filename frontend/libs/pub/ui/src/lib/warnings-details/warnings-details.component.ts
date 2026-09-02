/**
 * warnings-details.component.ts — FE-PUB-016 — Detalhes de Avisos / Erros do epubcheck.
 *
 * Entrega contagens apenas (totalErros, totalAvisos, resumoErro).
 * Lista detalhada BLOQUEADA: INT-FE-PUB-004 — endpoint §4.6 {code,msg,local}
 * não ratificado (aguarda PUB-016 BE).
 *
 * Boundary: type:ui — usa apenas primitivos como @Input; não importa type:data-access.
 * Renderiza estado vazio explícito quando todos os contadores são zero.
 *
 * Track D: FE-PUB-016 — P3 Feature Libs.
 */
import {
  ChangeDetectionStrategy,
  Component,
  Input,
} from '@angular/core';

@Component({
  selector: 'pub-warnings-details',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- FE-PUB-016: contagens do servidor (§6.1 totalAvisos / totalErros).
         Lista detalhada (§4.6): NÃO renderizada — INT-FE-PUB-004 BLOQUEADA aguardando PUB-016 BE.
         // BLOCKED: INT-FE-PUB-004 — PUB-016 BE pendente -->

    @if (totalErros > 0) {
      <!-- Erros críticos -->
      <div class="rounded-xl px-4 py-3 flex flex-col gap-1 text-sm mb-3"
           style="background:oklch(52% 0.23 25 / 0.08);border:1px solid oklch(52% 0.23 25 / 0.3);color:var(--color-error-ink)">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined" style="font-size:18px;">error</span>
          <span class="font-medium">{{ totalErros }} erro(s) crítico(s) — download bloqueado</span>
        </div>
        @if (resumoErro) {
          <p class="text-xs mt-0.5 pl-6" style="color:var(--color-error-ink)">
            {{ resumoErro }}
          </p>
        }
        <p class="text-xs pl-6" style="color:var(--text-tertiary)">
          (lista detalhada disponível após ratificação do endpoint — INT-FE-PUB-004)
        </p>
      </div>
    }

    @if (totalAvisos > 0) {
      <!-- Avisos não bloqueantes -->
      <div class="rounded-xl px-4 py-3 flex items-center gap-2 text-sm mb-3"
           style="background:oklch(78% 0.16 75 / 0.08);border:1px solid oklch(78% 0.16 75 / 0.35);color:var(--color-warning-ink)">
        <span class="material-symbols-outlined" style="font-size:18px;">warning</span>
        <span>
          {{ totalAvisos }} aviso(s) — não impedem a publicação
          <span class="text-xs ml-2" style="color:var(--text-tertiary)">
            (lista detalhada disponível após ratificação do endpoint — INT-FE-PUB-004)
          </span>
        </span>
      </div>
    }

    @if (totalErros === 0 && totalAvisos === 0) {
      <!-- Estado vazio explícito -->
      <div class="text-sm" style="color:var(--text-tertiary)">
        Nenhum aviso ou erro registrado.
      </div>
    }
  `,
})
export class WarningsDetailsComponent {
  /** Total de erros críticos reportados pelo epubcheck (api-contract §6.1). */
  @Input() totalErros = 0;
  /** Total de avisos não-bloqueantes reportados pelo epubcheck (api-contract §6.1). */
  @Input() totalAvisos = 0;
  /** Resumo do primeiro erro crítico (null se sem erros — api-contract §6.1). */
  @Input() resumoErro: string | null = null;
}
