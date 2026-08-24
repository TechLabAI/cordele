import { Component, ChangeDetectionStrategy, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { publicacoes, projetos, metadados } from '../../shared/mock-data';
import { Publicacao, PublicacaoEpubcheckStatus } from '../../shared/data-model';

// Contrato: .build-plans/download-e-historico.plan.md
// T08 — Download e Histórico — header do projeto + histórico de exportações

function fmtDatetime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

@Component({
  selector: 'app-download-e-historico',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="px-8 py-8 max-w-[var(--content-max-width)] mx-auto">

      <!-- Header do projeto -->
      <div class="flex items-start justify-between gap-4 mb-8 pb-6 border-b"
           style="border-color:var(--border-subtle);">
        <div>
          <div class="flex items-center gap-3 mb-1" style="border-left:4px solid oklch(42% 0.20 245);padding-left:14px;">
            <h1 class="font-display font-semibold text-2xl" style="color:var(--text-primary)">
              {{ projeto.nome }}
            </h1>
            <span class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold"
                  style="background:oklch(58% 0.18 145 / 0.14);color:oklch(30% 0.14 145);border:1px solid oklch(58% 0.18 145 / 0.35);">
              <span class="material-symbols-outlined" style="font-size:13px;">check_circle</span>
              Publicado
            </span>
          </div>
          <p class="text-sm" style="color:var(--text-secondary)">{{ meta.autor }} · {{ projeto.editora }}</p>
        </div>
        <div class="flex items-center gap-2 shrink-0">
          <a routerLink="/config"
             class="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
             style="background:var(--bg-surface-active);color:var(--text-secondary);"
             onmouseenter="this.style.background='var(--bg-surface-hover)'"
             onmouseleave="this.style.background='var(--bg-surface-active)'">
            <span class="material-symbols-outlined" style="font-size:14px;">edit</span>
            Ajustar metadados
          </a>
          <a routerLink="/editor-de-layout-preview"
             class="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
             style="background:var(--bg-surface-active);color:var(--text-secondary);"
             onmouseenter="this.style.background='var(--bg-surface-hover)'"
             onmouseleave="this.style.background='var(--bg-surface-active)'">
            <span class="material-symbols-outlined" style="font-size:14px;">palette</span>
            Ajustar layout
          </a>
        </div>
      </div>

      <!-- Histórico de exportações -->
      <div class="mb-4 flex items-center justify-between">
        <h2 class="font-display font-semibold text-base" style="color:var(--text-primary)">
          Histórico de exportações
        </h2>
        <a routerLink="/exportacao-e-validacao"
           class="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
           style="background:var(--color-brand);color:var(--text-on-brand);">
          <span class="material-symbols-outlined" style="font-size:16px;">file_export</span>
          Nova exportação
        </a>
      </div>

      <!-- Lista de exportações -->
      <div class="rounded-xl overflow-hidden" style="border:1px solid var(--border-subtle);">
        @for (pub of lista(); track pub.id; let first = $first) {
          <div class="flex items-center gap-4 px-5 py-4"
               [style]="first
                 ? 'background:var(--bg-surface);border-bottom:1px solid var(--border-subtle)'
                 : 'background:var(--bg-base);border-top:1px solid var(--border-subtle)'">

            <!-- Ícone de status com fundo colorido -->
            <span class="inline-flex items-center justify-center size-9 rounded-full shrink-0"
                  [style]="statusBg(pub.epubcheckStatus)">
              <span class="material-symbols-outlined text-lg"
                    [style.color]="statusColor(pub.epubcheckStatus)">
                {{ statusIcon(pub.epubcheckStatus) }}
              </span>
            </span>

            <!-- Info da exportação -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-0.5">
                <span class="text-sm font-medium" style="color:var(--text-primary)">
                  {{ fmtDatetime(pub.criadoEm) }}
                </span>
                @if (first) {
                  <span class="text-xs px-1.5 py-0.5 rounded"
                        style="background:var(--color-brand-subtle);color:var(--color-brand);font-size:10px;font-weight:600;">
                    versão atual
                  </span>
                }
              </div>
              <p class="text-xs" [style.color]="statusColor(pub.epubcheckStatus)">
                {{ statusLabel(pub) }}
              </p>
              @if (pub.erros) {
                <p class="text-xs mt-0.5 truncate" style="color:var(--color-error-ink)">
                  {{ pub.erros }}
                </p>
              }
            </div>

            <!-- Download -->
            @if (pub.arquivoUrl) {
              <button class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90 shrink-0"
                      style="background:var(--bg-surface-active);color:var(--text-primary);"
                      title="Baixar {{ pub.arquivoUrl.split('/').pop() }}">
                <span class="material-symbols-outlined" style="font-size:16px;">download</span>
                Baixar
              </button>
            } @else {
              <span class="text-xs shrink-0" style="color:var(--text-tertiary)">inválido</span>
            }

          </div>
        }
      </div>

      <!-- Volta à biblioteca -->
      <div class="mt-8">
        <a routerLink="/biblioteca-de-projetos" class="text-sm flex items-center gap-1"
           style="color:var(--text-secondary);">
          <span class="material-symbols-outlined" style="font-size:16px;">arrow_back</span>
          Voltar à biblioteca de projetos
        </a>
      </div>

    </div>
  `,
})
export class DownloadEHistoricoComponent {
  readonly projeto = projetos[0];
  readonly meta    = metadados[0];
  readonly lista   = signal<Publicacao[]>(publicacoes);
  fmtDatetime = fmtDatetime;

  statusIcon(s: PublicacaoEpubcheckStatus): string {
    return { valido: 'check_circle', avisos: 'check_circle', erros_criticos: 'cancel', pendente: 'hourglass_empty' }[s];
  }
  statusColor(s: PublicacaoEpubcheckStatus): string {
    return {
      valido:         'oklch(32% 0.14 145)',
      avisos:         'oklch(32% 0.14 145)',
      erros_criticos: 'oklch(38% 0.20 25)',
      pendente:       'var(--text-tertiary)',
    }[s];
  }
  statusBg(s: PublicacaoEpubcheckStatus): string {
    return {
      valido:         'background:oklch(58% 0.18 145 / 0.14)',
      avisos:         'background:oklch(58% 0.18 145 / 0.14)',
      erros_criticos: 'background:oklch(52% 0.23 25 / 0.12)',
      pendente:       'background:var(--bg-surface-active)',
    }[s];
  }
  statusLabel(pub: Publicacao): string {
    if (pub.epubcheckStatus === 'valido')         return `Válido · ${pub.totalAvisos} aviso(s)`;
    if (pub.epubcheckStatus === 'avisos')         return `Válido · ${pub.totalAvisos} aviso(s)`;
    if (pub.epubcheckStatus === 'erros_criticos') return `${pub.totalErros} erro(s) crítico(s)`;
    return 'Pendente';
  }
}
