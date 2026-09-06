/**
 * download-e-historico.component.ts — T08 — Download e Histórico.
 * Migrated from libs/pub (flat lib) to libs/pub/feature-history (P3 — FE-PUB-018).
 *
 * Removals vs prototype (FE-PUB-018):
 *   ✗ projetos[0] / metadados[0] / publicacoes mock imports  — replaced by HistoryFacade
 *   ✗ signal<Publicacao[]>(publicacoes) static               — facade.lista() (live)
 *   ✗ arquivoUrl <a href> download link                      — signed-URL via facade.download()
 *   ✗ mock-data imports                                      — zero; consumes HistoryFacade
 *                                                              from @cordele/pub-data-access
 *
 * Download: facade.download(projetoId, publicacaoId) → ArtifactDownloadService →
 *           signed URL via SPEC-04 §4.4 → window.open (never proxied bytes).
 * canDownload(pub): epubcheckStatus ∈ {valido, avisos} — mirrors podeBaixar per-row (SPEC-03 §2).
 *
 * EpubSummaryGrid (FE-PUB-015): KPI tiles omitted when stats=null (INT-FE-PUB-005 BLOCKED).
 *
 * Boundary: type:feature → imports type:data-access (@cordele/pub-data-access)
 *           and type:ui (@cordele/pub-ui). No mock adapters in production path.
 *
 * Multi-empresa: HistoryFacade is providedIn:'root' and inherits empresa context
 * via @cordele/shared/access-http-base interceptor (INT-FE-PUB-001).
 *
 * Track D: FE-PUB-018 — P3 Feature Libs. Updated: FE-PUB-023 (P6 — breadcrumb wiring).
 */
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  HistoryFacade,
  PublicacaoHistoryItem,
  EpubcheckStatus,
} from '@cordele/pub-data-access';
import { PUB_UPDATE_BREADCRUMB } from '@cordele/pub-data-access';
import { EpubSummaryGridComponent } from '@cordele/pub-ui';

function fmtDatetime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day:    '2-digit',
    month:  '2-digit',
    year:   'numeric',
    hour:   '2-digit',
    minute: '2-digit',
  });
}

@Component({
  selector: 'pub-download-e-historico',
  standalone: true,
  imports: [RouterLink, EpubSummaryGridComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="px-8 py-8 max-w-[var(--content-max-width)] mx-auto">

      <!-- ESTADO: CARREGANDO -->
      @if (facade.status() === 'loading') {
        <div class="flex items-center justify-center py-24">
          <div class="size-10 rounded-full border-4 border-t-transparent animate-spin"
               style="border-color:oklch(58% 0.19 245 / 0.18);border-top-color:oklch(58% 0.19 245);"
               role="progressbar" aria-label="Carregando histórico"></div>
        </div>
      }

      <!-- ESTADO: ERRO -->
      @if (facade.status() === 'error') {
        <div class="flex flex-col items-center justify-center py-16 gap-3 text-center">
          <span class="material-symbols-outlined text-4xl" style="color:var(--color-error)"
                aria-hidden="true">
            cloud_off
          </span>
          <p class="text-sm" style="color:var(--text-secondary)">
            {{ facade.error() ?? 'Erro ao carregar histórico.' }}
          </p>
          <button (click)="load()"
                  class="text-sm px-4 py-2 rounded-lg"
                  style="background:var(--color-brand);color:var(--text-on-brand);">
            Tentar novamente
          </button>
        </div>
      }

      @if (facade.status() === 'loaded') {

        <!-- Header do projeto -->
        <div class="flex items-start justify-between gap-4 mb-8 pb-6 border-b"
             style="border-color:var(--border-subtle);">
          <div>
            <div class="flex items-center gap-3 mb-1"
                 style="border-left:4px solid oklch(42% 0.20 245);padding-left:14px;">
              <h1 class="font-display font-semibold text-2xl" style="color:var(--text-primary)">
                Publicações do projeto
              </h1>
              @if (facade.lista().length > 0 && facade.lista()[0].epubcheckStatus !== 'erros_criticos') {
                <span class="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold"
                      style="background:oklch(58% 0.18 145 / 0.14);color:oklch(30% 0.14 145);border:1px solid oklch(58% 0.18 145 / 0.35);">
                  <span class="material-symbols-outlined" style="font-size:13px;">check_circle</span>
                  Publicado
                </span>
              }
            </div>
            <p class="text-sm" style="color:var(--text-secondary)">
              Histórico de exportações deste projeto editorial
            </p>
          </div>
          <div class="flex items-center gap-2 shrink-0">
            <a [routerLink]="['/comp/projetos', projetoId, 'config']"
               class="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
               style="background:var(--bg-surface-active);color:var(--text-secondary);">
              <span class="material-symbols-outlined" style="font-size:14px;">edit</span>
              Ajustar metadados
            </a>
            <a [routerLink]="['/comp/projetos', projetoId, 'editor-de-layout-preview']"
               class="inline-flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
               style="background:var(--bg-surface-active);color:var(--text-secondary);">
              <span class="material-symbols-outlined" style="font-size:14px;">palette</span>
              Ajustar layout
            </a>
          </div>
        </div>

        <!-- Grid de estatísticas — FE-PUB-015 (tiles omitidos se stats=null — INT-FE-PUB-005) -->
        <pub-epub-summary-grid
          [total]="facade.stats()?.total ?? null"
          [publicadas]="facade.stats()?.publicadas ?? null"
          [comAvisos]="facade.stats()?.comAvisos ?? null"
          [comErros]="facade.stats()?.comErros ?? null"
        />

        <!-- Header da seção histórico -->
        <div class="mb-4 flex items-center justify-between">
          <h2 class="font-display font-semibold text-base" style="color:var(--text-primary)">
            Histórico de exportações
          </h2>
          <a [routerLink]="['/pub/projetos', projetoId, 'exportacao-e-validacao']"
             class="inline-flex items-center gap-1 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
             style="background:var(--color-brand);color:var(--text-on-brand);">
            <span class="material-symbols-outlined" style="font-size:16px;">file_export</span>
            Nova exportação
          </a>
        </div>

        <!-- Lista vazia — estado explícito -->
        @if (facade.isEmpty()) {
          <div class="rounded-xl p-8 text-center" style="border:1px solid var(--border-subtle);">
            <span class="material-symbols-outlined text-3xl mb-2" style="color:var(--text-tertiary)">
              history
            </span>
            <p class="text-sm" style="color:var(--text-secondary)">
              Nenhuma exportação realizada ainda.
            </p>
            <a [routerLink]="['/pub/projetos', projetoId, 'exportacao-e-validacao']"
               class="inline-flex items-center gap-1 mt-4 text-sm font-medium"
               style="color:var(--color-brand);">
              <span class="material-symbols-outlined" style="font-size:16px;">file_export</span>
              Iniciar primeira exportação
            </a>
          </div>
        }

        <!-- Erro de download inline (per-row) -->
        @if (facade.downloadError()) {
          <div class="mb-3 rounded-lg px-4 py-3 text-sm flex items-center gap-2"
               style="background:var(--color-error-bg);border:1px solid oklch(52% 0.23 25 / 0.3);color:var(--color-error-ink);"
               role="alert">
            <span class="material-symbols-outlined" style="font-size:16px;">error</span>
            {{ facade.downloadError() }}
          </div>
        }

        <!-- Lista de exportações -->
        @if (!facade.isEmpty()) {
          <div class="rounded-xl overflow-hidden" style="border:1px solid var(--border-subtle);">
            @for (pub of facade.lista(); track pub.publicacaoId; let first = $first) {
              <div class="flex items-center gap-4 px-5 py-4"
                   [style]="first
                     ? 'background:var(--bg-surface);border-bottom:1px solid var(--border-subtle)'
                     : 'background:var(--bg-base);border-top:1px solid var(--border-subtle)'">

                <!-- Ícone de status com fundo colorido -->
                <span class="inline-flex items-center justify-center size-9 rounded-full shrink-0"
                      [style]="statusBg(pub.epubcheckStatus)"
                      aria-hidden="true">
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

                <!-- Download: signed URL via facade (SPEC-04 §4.4) — nunca href estático -->
                @if (canDownload(pub)) {
                  <button
                    (click)="download(pub.publicacaoId)"
                    [disabled]="facade.downloading() === pub.publicacaoId"
                    class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50 shrink-0"
                    style="background:var(--bg-surface-active);color:var(--text-primary);"
                    [attr.aria-label]="'Baixar ePub de ' + fmtDatetime(pub.criadoEm)">
                    @if (facade.downloading() === pub.publicacaoId) {
                      <div class="size-4 rounded-full border-2 border-t-transparent animate-spin"
                           style="border-color:currentColor;border-top-color:transparent;"
                           aria-hidden="true"></div>
                    } @else {
                      <span class="material-symbols-outlined" style="font-size:16px;">download</span>
                    }
                    Baixar
                  </button>
                } @else {
                  <span class="text-xs shrink-0" style="color:var(--text-tertiary)"
                        aria-label="Download indisponível — publicação inválida">inválido</span>
                }

              </div>
            }
          </div>
        }

        <!-- Volta à biblioteca -->
        <div class="mt-8">
          <a routerLink="/proj/biblioteca-de-projetos"
             class="text-sm flex items-center gap-1"
             style="color:var(--text-secondary);">
            <span class="material-symbols-outlined" style="font-size:16px;">arrow_back</span>
            Voltar à biblioteca de projetos
          </a>
        </div>

      } <!-- /loaded -->

    </div>
  `,
})
export class DownloadEHistoricoComponent implements OnInit {
  protected readonly facade = inject(HistoryFacade);
  private  readonly  route  = inject(ActivatedRoute);
  /** P6 (FE-PUB-023): breadcrumb update via token — avoids type:feature → type:feature boundary. */
  private  readonly  doUpdateBreadcrumb = inject(PUB_UPDATE_BREADCRUMB);

  fmtDatetime = fmtDatetime;

  get projetoId(): string {
    return this.route.snapshot.paramMap.get('projetoId') ?? '';
  }

  ngOnInit(): void {
    this.load();
    // P6 (FE-PUB-023): resolve T08 breadcrumb — "Projetos › {projetoId} › Download e Histórico"
    // projetoId used as display label until ProjFacade exposes the project name.
    this.doUpdateBreadcrumb(this.projetoId);
  }

  load(): void {
    this.facade.load(this.projetoId);
  }

  download(publicacaoId: string): void {
    this.facade.download(this.projetoId, publicacaoId);
  }

  /** Row is downloadable if epubcheckStatus ∈ {valido, avisos} — mirrors podeBaixar (SPEC-03 §2). */
  canDownload(pub: PublicacaoHistoryItem): boolean {
    return pub.epubcheckStatus === 'valido' || pub.epubcheckStatus === 'avisos';
  }

  statusIcon(s: EpubcheckStatus): string {
    const map: Record<EpubcheckStatus, string> = {
      valido:         'check_circle',
      avisos:         'check_circle',
      erros_criticos: 'cancel',
      pendente:       'hourglass_empty',
    };
    return map[s];
  }

  statusColor(s: EpubcheckStatus): string {
    const map: Record<EpubcheckStatus, string> = {
      valido:         'oklch(32% 0.14 145)',
      avisos:         'oklch(32% 0.14 145)',
      erros_criticos: 'oklch(38% 0.20 25)',
      pendente:       'var(--text-tertiary)',
    };
    return map[s];
  }

  statusBg(s: EpubcheckStatus): string {
    const map: Record<EpubcheckStatus, string> = {
      valido:         'background:oklch(58% 0.18 145 / 0.14)',
      avisos:         'background:oklch(58% 0.18 145 / 0.14)',
      erros_criticos: 'background:oklch(52% 0.23 25 / 0.12)',
      pendente:       'background:var(--bg-surface-active)',
    };
    return map[s];
  }

  statusLabel(pub: PublicacaoHistoryItem): string {
    if (pub.epubcheckStatus === 'valido')         return `Válido · ${pub.totalAvisos} aviso(s)`;
    if (pub.epubcheckStatus === 'avisos')         return `Válido com avisos · ${pub.totalAvisos} aviso(s)`;
    if (pub.epubcheckStatus === 'erros_criticos') return `${pub.totalErros} erro(s) crítico(s)`;
    return 'Pendente';
  }
}
