/**
 * warnings-details.component.ts — FE-PUB-016 — Detalhes de Avisos / Erros do epubcheck.
 *
 * INT-FE-PUB-004 (2026-09-03): lista detalhada de avisos DESBLOQUEADA.
 * PUB-016 BE entregue; ratificação FE dispensada (autorização 2026-08-29).
 * - Recebe `avisos: AvisoRow[]` (mapeados de ValidationMessageItem via toAvisoVM).
 * - Renderiza a lista detalhada quando avisos.length > 0.
 * - Renderiza contagens + resumoErro quando avisos está vazio (fallback de compatibilidade).
 * - location: null → exibido como "—" (nunca "null").
 *
 * Boundary: type:ui — usa apenas primitivos e interface local como @Input;
 * NÃO importa type:data-access (enforce-module-boundaries).
 * `AvisoRow` é compatível structurally com `AvisoVM` de @cordele/pub-data-access.
 *
 * Renderiza estado vazio explícito quando totalErros=0 E totalAvisos=0 E avisos=[].
 *
 * Track D: FE-PUB-016 — P3 Feature Libs / INT-FE-PUB-004 — P4 Hub Integrations.
 */
import {
  ChangeDetectionStrategy,
  Component,
  Input,
} from '@angular/core';

/**
 * One row in the validation detail list.
 * Structurally compatible with `AvisoVM` from @cordele/pub-data-access
 * (no direct import to respect type:ui → type:domain-only boundary).
 */
export interface AvisoRow {
  code: string;
  msg: string;
  local: string | null;
  severity: 'error' | 'warning' | 'info';
}

@Component({
  selector: 'pub-warnings-details',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (totalErros > 0) {
      <!-- Erros críticos: banner de contagem + resumo -->
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
      </div>
    }

    @if (totalAvisos > 0 && avisos.length === 0) {
      <!-- Avisos não bloqueantes: banner de contagem quando lista ainda não carregou -->
      <div class="rounded-xl px-4 py-3 flex items-center gap-2 text-sm mb-3"
           style="background:oklch(78% 0.16 75 / 0.08);border:1px solid oklch(78% 0.16 75 / 0.35);color:var(--color-warning-ink)">
        <span class="material-symbols-outlined" style="font-size:18px;">warning</span>
        <span>{{ totalAvisos }} aviso(s) — não impedem a publicação</span>
      </div>
    }

    @if (avisos.length > 0) {
      <!-- Lista detalhada de mensagens do epubcheck (§4.6 / INT-FE-PUB-004) -->
      <div class="rounded-xl overflow-hidden mb-3"
           style="border:1px solid var(--border-default)">
        <table class="w-full text-xs">
          <thead>
            <tr style="background:var(--bg-surface-raised);color:var(--text-secondary)">
              <th class="text-left px-3 py-2 font-medium w-16">Tipo</th>
              <th class="text-left px-3 py-2 font-medium w-24">Código</th>
              <th class="text-left px-3 py-2 font-medium">Mensagem</th>
              <th class="text-left px-3 py-2 font-medium w-36">Local</th>
            </tr>
          </thead>
          <tbody>
            @for (aviso of avisos; track aviso.code + aviso.local + $index) {
              <tr [style]="rowStyle(aviso.severity)"
                  class="border-t" style="border-color:var(--border-default)">
                <td class="px-3 py-2">
                  <span class="inline-flex items-center justify-center size-5 rounded-full"
                        [style]="badgeStyle(aviso.severity)"
                        [title]="aviso.severity">
                    <span class="material-symbols-outlined" style="font-size:12px;">
                      {{ severityIcon(aviso.severity) }}
                    </span>
                  </span>
                </td>
                <td class="px-3 py-2 font-mono" style="color:var(--text-secondary)">
                  {{ aviso.code }}
                </td>
                <td class="px-3 py-2" style="color:var(--text-primary)">{{ aviso.msg }}</td>
                <td class="px-3 py-2 font-mono" style="color:var(--text-tertiary)">
                  {{ aviso.local ?? '—' }}
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }

    @if (totalErros === 0 && totalAvisos === 0 && avisos.length === 0) {
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
  /**
   * Lista detalhada de mensagens do epubcheck (api-contract §4.6 / INT-FE-PUB-004).
   * Mapeado de ValidationMessageItem[] → AvisoVM[] → AvisoRow[] via facade.
   * `local: null` é renderizado como "—" no template (nunca exibe "null").
   */
  @Input() avisos: AvisoRow[] = [];

  severityIcon(severity: AvisoRow['severity']): string {
    if (severity === 'error')   return 'error';
    if (severity === 'warning') return 'warning';
    return 'info';
  }

  rowStyle(severity: AvisoRow['severity']): string {
    if (severity === 'error')   return 'background:oklch(52% 0.23 25 / 0.03)';
    if (severity === 'warning') return 'background:oklch(78% 0.16 75 / 0.03)';
    return '';
  }

  badgeStyle(severity: AvisoRow['severity']): string {
    if (severity === 'error')   return 'background:oklch(52% 0.23 25 / 0.12);color:var(--color-error)';
    if (severity === 'warning') return 'background:oklch(78% 0.16 75 / 0.12);color:var(--color-warning-ink)';
    return 'background:oklch(58% 0.19 245 / 0.12);color:var(--text-secondary)';
  }
}
