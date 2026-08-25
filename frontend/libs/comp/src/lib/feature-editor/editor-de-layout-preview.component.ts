/**
 * editor-de-layout-preview.component.ts — T06 Editor de Layout / Preview.
 * Promoted from design-reference/screens/editor-de-layout-preview (D-493/D-494).
 *
 * Changes vs prototype (per FE ADR-COMP-001 / M3/M4/M5 restrictions):
 *   REMOVED: toolbar estrutural (adicionarPagina / inserirImagem / confirmarRemover)
 *   REMOVED: render block for tipo='em-branco' (structuralEdits=false)
 *   REMOVED: showModal (page removal confirmation)
 *   REMOVED: inserirImagem flow from showImgModal — only ajustarAlinhamento kept
 *   REMOVED: import of shared/mock-data and local mock literals
 *   REMOVED: oklch(...) inline literals → replaced with --paper-* CSS tokens
 *   ADDED: LayoutFacade injection; ActivatedRoute for :projetoId param
 *   ADDED: 'Exportar' = RouterLink to /pub/exportacao-e-validacao (D-M)
 *   KEPT:  alignment modal for ADJUSTING existing image alignment (ajustarAlinhamento)
 *   KEPT:  full style panel (typography + margins + h1 size)
 *   KEPT:  paginator (anterior/proximo)
 * Track D: created by fe-architect-promote COMP @ cordele (D-494).
 */
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LayoutFacade } from '../layout.facade';
import { Alinhamento } from '../models/comp.models';

type AlinhamentoOption = { valor: Alinhamento; label: string; desc: string; icon: string };

const ALINHAMENTOS: AlinhamentoOption[] = [
  { valor: 'full',           label: 'Página inteira',        desc: 'Imagem ocupa toda a largura da página',    icon: 'fullscreen' },
  { valor: 'centralizado',   label: 'Centralizado',          desc: 'Imagem centralizada com margens laterais', icon: 'align_justify_center' },
  { valor: 'junto-esquerda', label: 'Junto ao texto — esq', desc: 'Texto flui à direita da imagem',           icon: 'format_image_left' },
  { valor: 'junto-direita',  label: 'Junto ao texto — dir', desc: 'Texto flui à esquerda da imagem',          icon: 'format_image_right' },
];

const STEPS = [
  { n: 1, label: 'Importar' }, { n: 2, label: 'Configurar' },
  { n: 3, label: 'Edição' }, { n: 4, label: 'Exportar' },
];

@Component({
  selector: 'comp-editor-de-layout-preview',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`:host {
    --paper-bg: oklch(93% 0.005 265);
    --paper-surface: #ffffff;
    --paper-text: oklch(22% 0.09 265);
    --paper-img-accent: oklch(55% 0.18 145);
    --paper-img-accent-dark: oklch(42% 0.16 145);
    --paper-toolbar-bg: color-mix(in oklch, var(--color-brand) 6%, transparent);
    --paper-toolbar-border: color-mix(in oklch, var(--color-brand) 18%, transparent);
    display: block; height: 100%;
  }`],
  template: `
    <div class="flex h-full overflow-hidden" style="background:var(--bg-base);">

      <!-- Área central -->
      <div class="flex-1 flex flex-col overflow-hidden min-w-0">

        <!-- Barra de etapas -->
        <div class="flex items-center gap-2 px-6 py-3 border-b text-sm flex-shrink-0"
             style="background:var(--bg-surface);border-color:var(--border-subtle);">
          @for (step of steps; track step.n) {
            <span class="flex items-center gap-1.5" [style]="stepStyle(step.n)">
              <span class="inline-flex items-center justify-center size-5 rounded-full text-xs font-bold"
                    [style]="dotStyle(step.n)">
                @if (step.n < 3) { <span class="material-symbols-outlined" style="font-size:12px;">check</span> }
                @else { {{ step.n }} }
              </span>
              {{ step.label }}
            </span>
            @if (!$last) { <span class="mx-2" style="color:var(--border-strong)">›</span> }
          }
          <div class="ml-auto flex items-center gap-3">
            <a [routerLink]="pubRoute"
               class="inline-flex items-center gap-1 rounded-lg px-4 py-1.5 text-sm font-semibold transition-opacity hover:opacity-90"
               style="background:var(--color-brand);color:var(--text-on-brand);">
              <span class="material-symbols-outlined" style="font-size:16px;">file_export</span>
              Exportar
            </a>
          </div>
        </div>

        <!-- Preview central (sem toolbar estrutural — structuralEdits=false, FE ADR-COMP-001) -->
        <div class="flex-1 overflow-auto py-8 px-6 flex justify-center" style="background:var(--paper-bg);">
          @if (facade.status() === 'loading') {
            <div class="flex items-center justify-center w-full">
              <span class="material-symbols-outlined animate-spin text-4xl" style="color:var(--text-tertiary)">progress_activity</span>
            </div>
          }

          @if (facade.status() === 'ready' && facade.paginaAtual()) {
            <div class="rounded-xl overflow-hidden"
                 style="background:var(--paper-surface);width:min(680px,100%);box-shadow:var(--shadow-lg);"
                 [style.padding]="facade.layout().margemLateral + 'px'">

              @if (facade.paginaAtual().tipo === 'capitulo') {
                <h2 class="font-display mb-6"
                    [style.fontFamily]="facade.layout().fonteCorpoFamilia === 'serif' ? 'Georgia, serif' : 'var(--font-body)'"
                    [style.fontSize]="facade.layout().h1Tamanho + 'px'"
                    style="color:var(--paper-text);">
                  Capítulo {{ facade.paginaAtual().n }} — {{ facade.paginaAtual().titulo }}
                </h2>
                @for (para of facade.paragrafos(); track $index) {
                  <p class="mb-4"
                     [style.fontFamily]="facade.layout().fonteCorpoFamilia === 'serif' ? 'Georgia, serif' : 'var(--font-body)'"
                     [style.fontSize]="facade.layout().fonteCorpoTamanho + 'px'"
                     [style.lineHeight]="facade.layout().espacamentoLinha"
                     style="color:var(--paper-text);">{{ para }}</p>
                }
              }

              @if (facade.paginaAtual().tipo === 'imagem') {
                @let al = facade.paginaAtual().alinhamento ?? 'centralizado';

                <!-- FULL -->
                @if (al === 'full') {
                  <div class="rounded-lg overflow-hidden w-full"
                       style="background:var(--bg-surface-active);border:2px dashed color-mix(in oklch,var(--paper-img-accent) 50%,transparent);min-height:240px;display:flex;align-items:center;justify-content:center;">
                    <div class="text-center">
                      <span class="material-symbols-outlined text-5xl mb-2 block" style="color:var(--paper-img-accent)">image</span>
                      <p class="text-xs font-medium" style="color:var(--paper-img-accent-dark)">Página inteira</p>
                    </div>
                  </div>
                }

                <!-- CENTRALIZADO -->
                @if (al === 'centralizado') {
                  <div class="flex justify-center py-4">
                    <div class="rounded-lg overflow-hidden"
                         style="width:70%;background:var(--bg-surface-active);border:2px dashed color-mix(in oklch,var(--paper-img-accent) 50%,transparent);min-height:180px;display:flex;align-items:center;justify-content:center;">
                      <div class="text-center">
                        <span class="material-symbols-outlined text-4xl mb-2 block" style="color:var(--paper-img-accent)">image</span>
                        <p class="text-xs font-medium" style="color:var(--paper-img-accent-dark)">Centralizado</p>
                      </div>
                    </div>
                  </div>
                }

                <!-- JUNTO-ESQUERDA -->
                @if (al === 'junto-esquerda') {
                  <div class="flex gap-4 py-2">
                    <div class="rounded-lg shrink-0"
                         style="width:40%;background:var(--bg-surface-active);border:2px dashed color-mix(in oklch,var(--paper-img-accent) 50%,transparent);min-height:140px;display:flex;align-items:center;justify-content:center;">
                      <div class="text-center">
                        <span class="material-symbols-outlined text-3xl" style="color:var(--paper-img-accent)">image</span>
                        <p class="text-xs" style="color:var(--paper-img-accent-dark)">Esq.</p>
                      </div>
                    </div>
                    <div class="flex-1 space-y-2 pt-1">
                      <div class="h-2.5 rounded" style="background:var(--border-subtle);width:100%"></div>
                      <div class="h-2.5 rounded" style="background:var(--border-subtle);width:100%"></div>
                      <div class="h-2.5 rounded" style="background:var(--border-subtle);width:100%"></div>
                      <div class="h-2.5 rounded" style="background:var(--border-subtle);width:100%"></div>
                      <div class="h-2.5 rounded" style="background:var(--border-subtle);width:60%"></div>
                      <p class="text-xs" style="color:var(--text-tertiary)">Texto flui à direita</p>
                    </div>
                  </div>
                }

                <!-- JUNTO-DIREITA -->
                @if (al === 'junto-direita') {
                  <div class="flex gap-4 py-2">
                    <div class="flex-1 space-y-2 pt-1">
                      <div class="h-2.5 rounded" style="background:var(--border-subtle);width:100%"></div>
                      <div class="h-2.5 rounded" style="background:var(--border-subtle);width:100%"></div>
                      <div class="h-2.5 rounded" style="background:var(--border-subtle);width:100%"></div>
                      <div class="h-2.5 rounded" style="background:var(--border-subtle);width:100%"></div>
                      <div class="h-2.5 rounded" style="background:var(--border-subtle);width:60%"></div>
                      <p class="text-xs" style="color:var(--text-tertiary)">Texto flui à esquerda</p>
                    </div>
                    <div class="rounded-lg shrink-0"
                         style="width:40%;background:var(--bg-surface-active);border:2px dashed color-mix(in oklch,var(--paper-img-accent) 50%,transparent);min-height:140px;display:flex;align-items:center;justify-content:center;">
                      <div class="text-center">
                        <span class="material-symbols-outlined text-3xl" style="color:var(--paper-img-accent)">image</span>
                        <p class="text-xs" style="color:var(--paper-img-accent-dark)">Dir.</p>
                      </div>
                    </div>
                  </div>
                }

                <!-- Badge de alinhamento + botão de ajuste -->
                <div class="mt-3 flex items-center justify-between">
                  <span class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                        style="background:color-mix(in oklch,var(--paper-img-accent) 10%,transparent);color:var(--paper-img-accent-dark);border:1px solid color-mix(in oklch,var(--paper-img-accent) 25%,transparent);">
                    <span class="material-symbols-outlined" style="font-size:13px;">tune</span>
                    {{ alinhLabel(al) }}
                  </span>
                  <button (click)="abrirModalAlinhamento()"
                          class="text-xs underline"
                          style="color:var(--color-brand)">Ajustar</button>
                </div>
              }

            </div>
          }

          @if (facade.status() === 'error') {
            <div class="flex items-center justify-center w-full">
              <p class="text-sm" style="color:var(--color-error)">{{ facade.error() }}</p>
            </div>
          }
        </div>

        <!-- Paginador -->
        <div class="flex items-center justify-center gap-4 py-3 border-t text-sm flex-shrink-0"
             style="background:var(--bg-surface);border-color:var(--border-subtle);">
          <button (click)="facade.anterior()" [disabled]="facade.paginaIdx() === 0"
                  class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg"
                  [style]="facade.paginaIdx() === 0 ? 'color:var(--text-tertiary);cursor:not-allowed' : 'color:var(--text-secondary)'">
            <span class="material-symbols-outlined" style="font-size:18px;">chevron_left</span>
            Anterior
          </button>
          <span style="color:var(--text-secondary)">
            Página {{ facade.paginaIdx() + 1 }} de {{ facade.paginas().length }}
            <span class="ml-1 text-xs" style="color:var(--text-tertiary)">(prévia)</span>
          </span>
          <button (click)="facade.proximo()" [disabled]="facade.paginaIdx() === facade.paginas().length - 1"
                  class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg"
                  [style]="facade.paginaIdx() === facade.paginas().length - 1 ? 'color:var(--text-tertiary);cursor:not-allowed' : 'color:var(--text-secondary)'">
            Próxima
            <span class="material-symbols-outlined" style="font-size:18px;">chevron_right</span>
          </button>
        </div>

      </div>

      <!-- Painel de estilos -->
      <aside class="w-64 flex-shrink-0 overflow-y-auto border-l"
             style="background:var(--bg-surface);border-color:var(--border-subtle);">

        <div class="px-5 py-3 border-b" style="background:var(--paper-toolbar-bg);border-color:var(--paper-toolbar-border);">
          <p class="text-xs font-bold uppercase tracking-wider" style="color:var(--color-brand)">Painel de Estilos</p>
        </div>

        <div class="px-5 py-5 space-y-6">

          <div>
            <label class="block text-xs font-medium mb-2" style="color:var(--text-secondary)">Fonte do corpo</label>
            <select [value]="facade.layout().fonteCorpoFamilia"
                    (change)="facade.setLayoutParam('fonteCorpoFamilia', $any($event.target).value)"
                    class="w-full rounded-lg px-3 py-2 text-sm outline-none cursor-pointer"
                    style="background:var(--bg-base);border:1px solid var(--border-default);color:var(--text-primary);"
                    onfocus="this.style.borderColor='var(--color-brand)'"
                    onblur="this.style.borderColor='var(--border-default)'">
              <option value="serif">Serif (Georgia)</option>
              <option value="sans-serif">Sans-serif (Inter)</option>
            </select>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs font-medium" style="color:var(--text-secondary)">Tamanho</label>
              <span class="text-xs font-mono px-1.5 py-0.5 rounded" style="color:var(--color-brand);background:color-mix(in oklch,var(--color-brand) 10%,transparent)">{{ facade.layout().fonteCorpoTamanho }}px</span>
            </div>
            <input type="range" min="12" max="20" step="1"
                   [value]="facade.layout().fonteCorpoTamanho"
                   (input)="facade.setLayoutParam('fonteCorpoTamanho', +$any($event.target).value)"
                   class="w-full h-1 rounded-full cursor-pointer"
                   style="accent-color:var(--color-brand);"/>
            <div class="flex justify-between text-xs mt-0.5" style="color:var(--text-tertiary)">
              <span>12px</span><span>20px</span>
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs font-medium" style="color:var(--text-secondary)">Linha</label>
              <span class="text-xs font-mono px-1.5 py-0.5 rounded" style="color:var(--color-brand);background:color-mix(in oklch,var(--color-brand) 10%,transparent)">{{ facade.layout().espacamentoLinha.toFixed(1) }}</span>
            </div>
            <input type="range" min="1.2" max="2.0" step="0.1"
                   [value]="facade.layout().espacamentoLinha"
                   (input)="facade.setLayoutParam('espacamentoLinha', +$any($event.target).value)"
                   class="w-full h-1 rounded-full cursor-pointer"
                   style="accent-color:var(--color-brand);"/>
            <div class="flex justify-between text-xs mt-0.5" style="color:var(--text-tertiary)">
              <span>1.2</span><span>2.0</span>
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs font-medium" style="color:var(--text-secondary)">H1 (capítulo)</label>
              <span class="text-xs font-mono px-1.5 py-0.5 rounded" style="color:var(--color-brand);background:color-mix(in oklch,var(--color-brand) 10%,transparent)">{{ facade.layout().h1Tamanho }}px</span>
            </div>
            <input type="range" min="20" max="40" step="2"
                   [value]="facade.layout().h1Tamanho"
                   (input)="facade.setLayoutParam('h1Tamanho', +$any($event.target).value)"
                   class="w-full h-1 rounded-full cursor-pointer"
                   style="accent-color:var(--color-brand);"/>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs font-medium" style="color:var(--text-secondary)">Margens laterais</label>
              <span class="text-xs font-mono px-1.5 py-0.5 rounded" style="color:var(--color-brand);background:color-mix(in oklch,var(--color-brand) 10%,transparent)">{{ facade.layout().margemLateral }}px</span>
            </div>
            <input type="range" min="24" max="80" step="8"
                   [value]="facade.layout().margemLateral"
                   (input)="facade.setLayoutParam('margemLateral', +$any($event.target).value)"
                   class="w-full h-1 rounded-full cursor-pointer"
                   style="accent-color:var(--color-brand);"/>
          </div>

        </div>
      </aside>

      <!-- Modal de alinhamento de imagem (APENAS ajustar — sem inserir) -->
      @if (showAlinhModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center"
             style="background:color-mix(in oklch,var(--paper-text) 55%,transparent);">
          <div class="rounded-2xl p-6 max-w-md w-full mx-4"
               style="background:var(--bg-base);box-shadow:var(--shadow-lg);border:1px solid var(--border-default);">
            <div class="flex items-center gap-2 mb-5">
              <span class="material-symbols-outlined" style="color:var(--paper-img-accent);font-size:22px;">tune</span>
              <h3 class="font-display font-semibold text-base" style="color:var(--text-primary)">Ajustar alinhamento</h3>
            </div>

            <p class="text-xs mb-3" style="color:var(--text-secondary)">Como a imagem será posicionada na página?</p>

            <div class="grid grid-cols-2 gap-3 mb-5">
              @for (op of alinhamentos; track op.valor) {
                <button (click)="alinhSelecionado.set(op.valor)"
                        class="rounded-xl p-3 text-left transition-all"
                        [style]="alinhSelecionado() === op.valor
                          ? 'background:color-mix(in oklch,var(--paper-img-accent) 10%,transparent);border:2px solid var(--paper-img-accent);'
                          : 'background:var(--bg-surface);border:2px solid var(--border-subtle);'">
                  <span class="material-symbols-outlined block mb-1.5"
                        [style]="alinhSelecionado() === op.valor ? 'color:var(--paper-img-accent-dark);font-size:22px' : 'color:var(--text-tertiary);font-size:22px'">
                    {{ op.icon }}
                  </span>
                  <p class="text-xs font-semibold"
                     [style]="alinhSelecionado() === op.valor ? 'color:var(--paper-img-accent-dark)' : 'color:var(--text-primary)'">
                    {{ op.label }}
                  </p>
                  <p class="text-xs mt-0.5" style="color:var(--text-tertiary)">{{ op.desc }}</p>
                </button>
              }
            </div>

            <div class="flex gap-3 justify-end">
              <button (click)="showAlinhModal.set(false)"
                      class="rounded-lg px-4 py-2 text-sm font-medium"
                      style="background:var(--bg-surface-active);color:var(--text-secondary);">
                Cancelar
              </button>
              <button (click)="aplicarAlinhamento()"
                      class="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
                      style="background:var(--paper-img-accent);color:white;">
                <span class="material-symbols-outlined" style="font-size:16px;">check</span>
                Aplicar
              </button>
            </div>
          </div>
        </div>
      }

    </div>
  `,
})
export class EditorDeLayoutPreviewComponent implements OnInit {
  readonly facade       = inject(LayoutFacade);
  private readonly route = inject(ActivatedRoute);

  readonly steps       = STEPS;
  readonly alinhamentos = ALINHAMENTOS;

  projetoId        = '';
  showAlinhModal   = signal(false);
  alinhSelecionado = signal<Alinhamento>('centralizado');
  pubRoute         = ['/pub', 'exportacao-e-validacao']; // placeholder — PUB module route

  ngOnInit(): void {
    this.projetoId = this.route.snapshot.paramMap.get('projetoId') ?? '';
    this.facade.load(this.projetoId);
  }

  abrirModalAlinhamento(): void {
    const currentAlinh = this.facade.paginaAtual()?.alinhamento ?? 'centralizado';
    this.alinhSelecionado.set(currentAlinh);
    this.showAlinhModal.set(true);
  }

  aplicarAlinhamento(): void {
    const nodeId = this.facade.paginaAtual()?.nodeId;
    if (nodeId) {
      this.facade.setAlinhamento(nodeId, this.alinhSelecionado());
    }
    this.showAlinhModal.set(false);
  }

  alinhLabel(al: string): string {
    return ALINHAMENTOS.find(a => a.valor === al)?.label ?? al;
  }

  stepStyle(n: number): string {
    if (n < 3) return 'color:var(--paper-success-text,oklch(35% 0.14 145));font-weight:600';
    if (n === 3) return 'color:var(--color-brand);font-weight:600';
    return 'color:var(--text-tertiary)';
  }

  dotStyle(n: number): string {
    if (n < 3) return 'background:var(--paper-success-bg,oklch(58% 0.18 145));color:#fff';
    if (n === 3) return 'background:var(--color-brand);color:var(--text-on-brand)';
    return 'background:var(--bg-surface-active);color:var(--text-tertiary)';
  }
}
