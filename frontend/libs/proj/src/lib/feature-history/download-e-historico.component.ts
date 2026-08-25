/**
 * download-e-historico.component.ts — T08 Download e Histórico.
 * Promoted from design-reference/angular-prototype (D-493/D-494).
 * Connected to HistoryFacade (signals-based, ADR-007). Mock data removed.
 * OnPush + standalone (required by policy).
 *
 * Route: /proj/projetos/:projetoId/historico (parametrized — replaces flat prototype route).
 *
 * Behaviours preserved from prompt specification:
 *   1. Reopen pessimistic: "Ajustar metadados"/"Ajustar layout" → POST .../reopen,
 *      await 200 ProjetoDetail, then navigate to COMP. 409 (rascunho) → reset pending, toast.
 *   2. Badge derived from header status + epubcheck fold (SPEC-03 §3).
 *   3. degraded=true: render identity + status, never error state (api-contract §4.3).
 *   4. Download via signed URL opened in new tab (D-F — no proxy).
 *   5. canDownload derived solely from arquivoUrl != null (SPEC-03 §2).
 *   6. reopenPending gates both reopen CTAs (SPEC-03 §2 — no double-click fire).
 * Track D: promoted by fe-architect-promote PROJ @ cordele (D-494).
 */
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HistoryFacade, PublicacaoRowVM } from '../history.facade';

function fmtDatetime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

@Component({
  selector: 'proj-download-e-historico',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="px-8 py-8 max-w-[var(--content-max-width)] mx-auto">

      <!-- Loading -->
      @if (facade.status() === 'loading') {
        <div class="animate-pulse">
          <div class="h-8 w-64 rounded mb-4" style="background:var(--bg-surface-active);"></div>
          <div class="h-4 w-48 rounded" style="background:var(--bg-surface-active);"></div>
        </div>
      }

      <!-- Not found -->
      @if (facade.status() === 'not-found') {
        <div class="py-24 text-center">
          <span class="material-symbols-outlined text-4xl mb-3" style="color:var(--text-tertiary)">search_off</span>
          <p style="color:var(--text-secondary)">Projeto não encontrado.</p>
        </div>
      }

      <!-- Error -->
      @if (facade.status() === 'error') {
        <div class="py-24 text-center">
          <span class="material-symbols-outlined text-4xl mb-3" style="color:var(--color-error-ink)">error_outline</span>
          <p style="color:var(--text-primary)">Não foi possível carregar o histórico.</p>
        </div>
      }

      @if (facade.status() === 'ready') {

        <!-- Reopen error toast -->
        @if (facade.reopenError()) {
          <div class="mb-4 flex items-center gap-2 rounded-lg px-4 py-3 text-sm"
               style="background:oklch(52% 0.23 25 / 0.12);border:1px solid oklch(52% 0.23 25 / 0.35);color:oklch(32% 0.18 25);">
            <span class="material-symbols-outlined" style="font-size:16px;">warning</span>
            {{ facade.reopenError() }}
          </div>
        }

        <!-- Header do projeto -->
        @if (facade.header(); as h) {
          <div class="flex items-start justify-between gap-4 mb-8 pb-6 border-b"
               style="border-color:var(--border-subtle);">
            <div>
              <div class="flex items-center gap-3 mb-1" style="border-left:4px solid oklch(42% 0.20 245);padding-left:14px;">
                <h1 class="font-display font-semibold text-2xl" style="color:var(--text-primary)">
                  {{ h.nome }}
                </h1>
                <!-- degraded: always show badge (identity + status preserved — api-contract §4.3) -->
                <span class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold"
                      [style]="headerBadgeStyle(h.badge.tone)">
                  <span class="material-symbols-outlined" style="font-size:13px;">{{ h.badge.icon }}</span>
                  {{ h.badge.label }}
                </span>
              </div>
              <p class="text-sm" style="color:var(--text-secondary)">
                {{ h.autor ?? 'Autor não definido' }}
                @if (facade.degraded()) {
                  <span class="ml-2 text-xs" style="color:var(--color-warn-ink)">(dados parciais)</span>
                }
              </p>
            </div>

            <!-- Reopen CTAs — visible only when canReopen; gated by reopenPending -->
            @if (h.canReopen) {
              <div class="flex items-center gap-2 shrink-0">
                <button
                  (click)="facade.onReopen('metadata')"
                  [disabled]="facade.reopenPending()"
                  class="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                  style="background:var(--bg-surface-active);color:var(--text-secondary);"
                  onmouseenter="if(!this.disabled) this.style.background='var(--bg-surface-hover)'"
                  onmouseleave="this.style.background='var(--bg-surface-active)'">
                  @if (facade.reopenPending()) {
                    <span class="material-symbols-outlined animate-spin" style="font-size:14px;">progress_activity</span>
                  } @else {
                    <span class="material-symbols-outlined" style="font-size:14px;">edit</span>
                  }
                  Ajustar metadados
                </button>
                <button
                  (click)="facade.onReopen('layout')"
                  [disabled]="facade.reopenPending()"
                  class="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                  style="background:var(--bg-surface-active);color:var(--text-secondary);"
                  onmouseenter="if(!this.disabled) this.style.background='var(--bg-surface-hover)'"
                  onmouseleave="this.style.background='var(--bg-surface-active)'">
                  <span class="material-symbols-outlined" style="font-size:14px;">palette</span>
                  Ajustar layout
                </button>
              </div>
            }
          </div>
        }

        <!-- Histórico de exportações -->
        <div class="mb-4 flex items-center justify-between">
          <h2 class="font-display font-semibold text-base" style="color:var(--text-primary)">
            Histórico de exportações
          </h2>
          @if (facade.header()?.canNewExport) {
            <button
              (click)="facade.onNewExport()"
              class="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
              style="background:var(--color-brand);color:var(--text-on-brand);">
              <span class="material-symbols-outlined" style="font-size:16px;">file_export</span>
              Nova exportação
            </button>
          }
        </div>

        <!-- Degraded notice for publication list -->
        @if (facade.degraded() && facade.publications().length === 0) {
          <div class="rounded-xl px-5 py-8 text-center" style="border:1px solid var(--border-subtle);">
            <span class="material-symbols-outlined text-3xl mb-2" style="color:var(--text-tertiary)">sync_problem</span>
            <p class="text-sm" style="color:var(--text-secondary)">Histórico temporariamente indisponível.</p>
          </div>
        }

        <!-- Lista de exportações -->
        @if (facade.publications().length > 0) {
          <div class="rounded-xl overflow-hidden" style="border:1px solid var(--border-subtle);">
            @for (pub of facade.publications(); track pub.publicacaoId; let first = $first) {
              <div class="flex items-center gap-4 px-5 py-4"
                   [style]="first
                     ? 'background:var(--bg-surface);border-bottom:1px solid var(--border-subtle)'
                     : 'background:var(--bg-base);border-top:1px solid var(--border-subtle)'">

                <!-- Status icon -->
                <span class="inline-flex items-center justify-center size-9 rounded-full shrink-0"
                      [style]="statusBg(pub)">
                  <span class="material-symbols-outlined text-lg"
                        [style.color]="statusColor(pub)">
                    {{ statusIcon(pub) }}
                  </span>
                </span>

                <!-- Info -->
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 mb-0.5">
                    <span class="text-sm font-medium" style="color:var(--text-primary)">
                      {{ fmtDatetime(pub.criadoEm) }}
                    </span>
                    @if (pub.isCurrent) {
                      <span class="text-xs px-1.5 py-0.5 rounded"
                            style="background:var(--color-brand-subtle);color:var(--color-brand);font-size:10px;font-weight:600;">
                        versão atual
                      </span>
                    }
                  </div>
                  <p class="text-xs" [style.color]="statusColor(pub)">{{ pub.statusLabel }}</p>
                  @if (pub.erros) {
                    <p class="text-xs mt-0.5 truncate" style="color:var(--color-error-ink)">{{ pub.erros }}</p>
                  }
                </div>

                <!-- Download button (D-F: opens signed URL directly, no proxy) -->
                @if (pub.canDownload) {
                  <button
                    (click)="facade.onDownload(pub)"
                    class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90 shrink-0"
                    style="background:var(--bg-surface-active);color:var(--text-primary);"
                    title="Baixar ePub">
                    <span class="material-symbols-outlined" style="font-size:16px;">download</span>
                    Baixar
                  </button>
                } @else {
                  <span class="text-xs shrink-0" style="color:var(--text-tertiary)">inválido</span>
                }

              </div>
            }
          </div>
        }

        <!-- Volta à biblioteca -->
        <div class="mt-8">
          <button (click)="facade.onBack()"
                  class="text-sm flex items-center gap-1"
                  style="color:var(--text-secondary);">
            <span class="material-symbols-outlined" style="font-size:16px;">arrow_back</span>
            Voltar à biblioteca de projetos
          </button>
        </div>

      }
    </div>
  `,
})
export class DownloadEHistoricoComponent implements OnInit {
  protected readonly facade = inject(HistoryFacade);
  private readonly route = inject(ActivatedRoute);
  protected readonly fmtDatetime = fmtDatetime;

  ngOnInit(): void {
    const projetoId = this.route.snapshot.paramMap.get('projetoId');
    if (projetoId) {
      this.facade.load(projetoId);
    }
  }

  headerBadgeStyle(tone: string): string {
    const map: Record<string, string> = {
      valid:    'background:oklch(58% 0.18 145 / 0.14);color:oklch(30% 0.14 145);border:1px solid oklch(58% 0.18 145 / 0.35)',
      warn:     'background:oklch(58% 0.18 145 / 0.14);color:oklch(30% 0.14 145);border:1px solid oklch(58% 0.18 145 / 0.35)',
      error:    'background:oklch(52% 0.23 25 / 0.14);color:oklch(32% 0.18 25);border:1px solid oklch(52% 0.23 25 / 0.35)',
      draft:    'background:oklch(78% 0.16 75 / 0.14);color:oklch(40% 0.14 75);border:1px solid oklch(78% 0.16 75 / 0.40)',
      progress: 'background:oklch(58% 0.19 245 / 0.14);color:oklch(40% 0.19 245);border:1px solid oklch(58% 0.19 245 / 0.40)',
      pending:  'background:var(--bg-surface-active);color:var(--text-tertiary);border:1px solid var(--border-subtle)',
    };
    return map[tone] ?? '';
  }

  statusIcon(pub: PublicacaoRowVM): string {
    return { valido: 'check_circle', avisos: 'check_circle', erros_criticos: 'cancel', pendente: 'hourglass_empty' }[pub.epubcheckStatus] ?? 'help';
  }

  statusColor(pub: PublicacaoRowVM): string {
    return {
      valido:         'oklch(32% 0.14 145)',
      avisos:         'oklch(32% 0.14 145)',
      erros_criticos: 'oklch(38% 0.20 25)',
      pendente:       'var(--text-tertiary)',
    }[pub.epubcheckStatus] ?? 'var(--text-secondary)';
  }

  statusBg(pub: PublicacaoRowVM): string {
    return {
      valido:         'background:oklch(58% 0.18 145 / 0.14)',
      avisos:         'background:oklch(58% 0.18 145 / 0.14)',
      erros_criticos: 'background:oklch(52% 0.23 25 / 0.12)',
      pendente:       'background:var(--bg-surface-active)',
    }[pub.epubcheckStatus] ?? '';
  }
}
