import { Component, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { manuscrito, metadados } from '../../shared/mock-data';
import { ConfiguracaoLayout } from '../../shared/data-model';

// T06 — Edição de Layout — preview + toolbar (add página, inserir imagem c/ alinhamento, remover página)

type Alinhamento = 'full' | 'centralizado' | 'junto-esquerda' | 'junto-direita';

const ALINHAMENTOS: { valor: Alinhamento; label: string; desc: string; icon: string }[] = [
  { valor: 'full',           label: 'Página inteira',     desc: 'Imagem ocupa toda a largura da página',         icon: 'fullscreen' },
  { valor: 'centralizado',   label: 'Centralizado',       desc: 'Imagem centralizada com margens laterais',      icon: 'align_justify_center' },
  { valor: 'junto-esquerda', label: 'Junto ao texto — esq', desc: 'Texto flui à direita da imagem',             icon: 'format_image_left' },
  { valor: 'junto-direita',  label: 'Junto ao texto — dir', desc: 'Texto flui à esquerda da imagem',            icon: 'format_image_right' },
];

const STEPS = [
  { n: 1, label: 'Importar' }, { n: 2, label: 'Configurar' },
  { n: 3, label: 'Edição' }, { n: 4, label: 'Exportar' },
];

const CAPITULOS_INIT = [
  { n: 1, titulo: 'O Rio',     texto: 'A cidade acordou cedo naquela manhã de inverno. As ruas ainda molhadas da chuva da véspera refletiam as primeiras luzes do dia. Marina abriu a janela e sentiu o vento frio entrar, carregando o cheiro de terra úmida e café passado na esquina.\n\nEla olhou para o rio lá embaixo — quieto, como sempre, mas carregando em suas águas escuras toda a história que a cidade preferia esquecer.' },
  { n: 2, titulo: 'A Cidade',  texto: 'Os prédios cresceram rápido demais. Onde antes havia casas baixas com quintais e mangueiras, agora se erguiam torres de vidro que não deixavam passar o vento. A cidade havia trocado sua memória por metros quadrados.' },
  { n: 3, titulo: 'O Retorno', texto: 'Ela voltou após quinze anos. Reconheceu pouca coisa. O bar da dona Conceição virou uma farmácia. A escola onde estudou foi demolida para dar lugar a um estacionamento coberto.' },
];

const LAYOUT_INICIAL: ConfiguracaoLayout = {
  id: 'layout-001', projetoId: 'proj-001',
  fonteCorpoFamilia: 'serif', fonteCorpoTamanho: 16,
  espacamentoLinha: 1.6, margemLateral: 48,
  h1Tamanho: 28, h2Tamanho: 22, h3Tamanho: 18,
};

@Component({
  selector: 'app-editor-de-layout-preview',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
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
            <span class="text-xs" style="color:var(--text-secondary)">{{ ms.nomeArquivo }}</span>
            <a routerLink="/exportacao-e-validacao"
               class="inline-flex items-center gap-1 rounded-lg px-4 py-1.5 text-sm font-semibold transition-opacity hover:opacity-90"
               style="background:var(--color-brand);color:var(--text-on-brand);">
              <span class="material-symbols-outlined" style="font-size:16px;">file_export</span>
              Exportar
            </a>
          </div>
        </div>

        <!-- Toolbar de edição -->
        <div class="flex items-center gap-2 px-6 py-2 flex-shrink-0"
             style="background:oklch(58% 0.19 245 / 0.06);border-bottom:1px solid oklch(58% 0.19 245 / 0.18);">
          <span class="text-xs font-medium mr-2" style="color:var(--text-tertiary)">Edição:</span>

          <button (click)="adicionarPagina()"
                  class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                  style="background:var(--bg-surface);border:1px solid var(--border-default);color:var(--text-secondary);"
                  onmouseenter="this.style.background='var(--bg-surface-hover)'"
                  onmouseleave="this.style.background='var(--bg-surface)'">
            <span class="material-symbols-outlined" style="font-size:15px;color:var(--color-brand)">add</span>
            Adicionar página
          </button>

          <button (click)="inserirImagem()"
                  class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                  style="background:var(--bg-surface);border:1px solid var(--border-default);color:var(--text-secondary);"
                  onmouseenter="this.style.background='var(--bg-surface-hover)'"
                  onmouseleave="this.style.background='var(--bg-surface)'">
            <span class="material-symbols-outlined" style="font-size:15px;color:oklch(55% 0.18 145)">image</span>
            Inserir imagem
          </button>

          <button (click)="confirmarRemover()"
                  class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors"
                  [disabled]="paginas().length <= 1"
                  [style]="paginas().length <= 1
                    ? 'background:var(--bg-surface);border:1px solid var(--border-subtle);color:var(--text-tertiary);cursor:not-allowed;opacity:0.5'
                    : 'background:var(--bg-surface);border:1px solid var(--border-default);color:var(--text-secondary)'"
                  onmouseenter="if(this.style.cursor!=='not-allowed')this.style.background='oklch(52% 0.23 25 / 0.08)'"
                  onmouseleave="if(this.style.cursor!=='not-allowed')this.style.background='var(--bg-surface)'">
            <span class="material-symbols-outlined" style="font-size:15px;color:var(--color-error)">delete</span>
            Remover página
          </button>

          @if (toast()) {
            <span class="ml-auto text-xs font-medium flex items-center gap-1"
                  style="color:oklch(35% 0.14 145)">
              <span class="material-symbols-outlined" style="font-size:14px;">check_circle</span>
              {{ toast() }}
            </span>
          }
        </div>

        <!-- Preview central -->
        <div class="flex-1 overflow-auto py-8 px-6 flex justify-center" style="background:oklch(93% 0.005 265);">
          <div class="bg-white rounded-xl overflow-hidden"
               style="width:min(680px,100%);box-shadow:var(--shadow-lg);"
               [style.padding]="layout().margemLateral + 'px'">

            @if (paginaAtual().tipo === 'capitulo') {
              <h2 class="font-display mb-6"
                  [style.fontFamily]="layout().fonteCorpoFamilia === 'serif' ? 'Georgia, serif' : 'var(--font-body)'"
                  [style.fontSize]="layout().h1Tamanho + 'px'"
                  style="color:oklch(22% 0.09 265);">
                Capítulo {{ paginaAtual().n }} — {{ paginaAtual().titulo }}
              </h2>
              @for (para of paragrafos(); track $index) {
                <p class="mb-4"
                   [style.fontFamily]="layout().fonteCorpoFamilia === 'serif' ? 'Georgia, serif' : 'var(--font-body)'"
                   [style.fontSize]="layout().fonteCorpoTamanho + 'px'"
                   [style.lineHeight]="layout().espacamentoLinha"
                   style="color:oklch(22% 0.09 265);">{{ para }}</p>
              }
            }

            @if (paginaAtual().tipo === 'em-branco') {
              <div class="flex items-center justify-center py-16 text-center">
                <div>
                  <span class="material-symbols-outlined text-4xl mb-3 block" style="color:var(--text-tertiary)">article</span>
                  <p class="text-sm font-medium" style="color:var(--text-tertiary)">{{ paginaAtual().titulo }}</p>
                  <p class="text-xs mt-1" style="color:var(--border-strong)">Página em branco adicionada manualmente</p>
                </div>
              </div>
            }

            @if (paginaAtual().tipo === 'imagem') {
              @let al = paginaAtual().alinhamento ?? 'centralizado';

              <!-- FULL -->
              @if (al === 'full') {
                <div class="rounded-lg overflow-hidden w-full"
                     style="background:var(--bg-surface-active);border:2px dashed oklch(55% 0.18 145 / 0.5);min-height:240px;display:flex;align-items:center;justify-content:center;">
                  <div class="text-center">
                    <span class="material-symbols-outlined text-5xl mb-2 block" style="color:oklch(55% 0.18 145)">image</span>
                    <p class="text-xs font-medium" style="color:oklch(42% 0.16 145)">Página inteira</p>
                  </div>
                </div>
              }

              <!-- CENTRALIZADO -->
              @if (al === 'centralizado') {
                <div class="flex justify-center py-4">
                  <div class="rounded-lg overflow-hidden"
                       style="width:70%;background:var(--bg-surface-active);border:2px dashed oklch(55% 0.18 145 / 0.5);min-height:180px;display:flex;align-items:center;justify-content:center;">
                    <div class="text-center">
                      <span class="material-symbols-outlined text-4xl mb-2 block" style="color:oklch(55% 0.18 145)">image</span>
                      <p class="text-xs font-medium" style="color:oklch(42% 0.16 145)">Centralizado</p>
                    </div>
                  </div>
                </div>
              }

              <!-- JUNTO-ESQUERDA -->
              @if (al === 'junto-esquerda') {
                <div class="flex gap-4 py-2">
                  <div class="rounded-lg shrink-0"
                       style="width:40%;background:var(--bg-surface-active);border:2px dashed oklch(55% 0.18 145 / 0.5);min-height:140px;display:flex;align-items:center;justify-content:center;">
                    <div class="text-center">
                      <span class="material-symbols-outlined text-3xl" style="color:oklch(55% 0.18 145)">image</span>
                      <p class="text-xs" style="color:oklch(42% 0.16 145)">Esq.</p>
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
                       style="width:40%;background:var(--bg-surface-active);border:2px dashed oklch(55% 0.18 145 / 0.5);min-height:140px;display:flex;align-items:center;justify-content:center;">
                    <div class="text-center">
                      <span class="material-symbols-outlined text-3xl" style="color:oklch(55% 0.18 145)">image</span>
                      <p class="text-xs" style="color:oklch(42% 0.16 145)">Dir.</p>
                    </div>
                  </div>
                </div>
              }

              <!-- Badge de alinhamento + botão de ajuste -->
              <div class="mt-3 flex items-center justify-between">
                <span class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full"
                      style="background:oklch(55% 0.18 145 / 0.10);color:oklch(42% 0.16 145);border:1px solid oklch(55% 0.18 145 / 0.25);">
                  <span class="material-symbols-outlined" style="font-size:13px;">tune</span>
                  {{ alinhLabel(al) }}
                </span>
                <button (click)="ajustarAlinhamento()"
                        class="text-xs underline"
                        style="color:var(--color-brand)">Ajustar</button>
              </div>
            }

          </div>
        </div>

        <!-- Paginador -->
        <div class="flex items-center justify-center gap-4 py-3 border-t text-sm flex-shrink-0"
             style="background:var(--bg-surface);border-color:var(--border-subtle);">
          <button (click)="anterior()" [disabled]="paginaIdx() === 0"
                  class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg"
                  [style]="paginaIdx() === 0 ? 'color:var(--text-tertiary);cursor:not-allowed' : 'color:var(--text-secondary)'">
            <span class="material-symbols-outlined" style="font-size:18px;">chevron_left</span>
            Anterior
          </button>
          <span style="color:var(--text-secondary)">
            Página {{ paginaIdx() + 1 }} de {{ paginas().length }}
            <span class="ml-1 text-xs" style="color:var(--text-tertiary)">(prévia)</span>
          </span>
          <button (click)="proximo()" [disabled]="paginaIdx() === paginas().length - 1"
                  class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg"
                  [style]="paginaIdx() === paginas().length - 1 ? 'color:var(--text-tertiary);cursor:not-allowed' : 'color:var(--text-secondary)'">
            Próxima
            <span class="material-symbols-outlined" style="font-size:18px;">chevron_right</span>
          </button>
        </div>

      </div>

      <!-- Painel de estilos -->
      <aside class="w-64 flex-shrink-0 overflow-y-auto border-l"
             style="background:var(--bg-surface);border-color:var(--border-subtle);">

        <div class="px-5 py-3 border-b" style="background:oklch(58% 0.19 245 / 0.06);border-color:oklch(58% 0.19 245 / 0.18);">
          <p class="text-xs font-bold uppercase tracking-wider" style="color:var(--color-brand)">Painel de Estilos</p>
        </div>

        <div class="px-5 py-5 space-y-6">

          <div>
            <label class="block text-xs font-medium mb-2" style="color:var(--text-secondary)">Fonte do corpo</label>
            <select [value]="layout().fonteCorpoFamilia"
                    (change)="setLayout('fonteCorpoFamilia', $any($event.target).value)"
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
              <span class="text-xs font-mono px-1.5 py-0.5 rounded" style="color:var(--color-brand);background:oklch(58% 0.19 245 / 0.10)">{{ layout().fonteCorpoTamanho }}px</span>
            </div>
            <input type="range" min="12" max="20" step="1"
                   [value]="layout().fonteCorpoTamanho"
                   (input)="setLayout('fonteCorpoTamanho', +$any($event.target).value)"
                   class="w-full h-1 rounded-full cursor-pointer"
                   style="accent-color:var(--color-brand);"/>
            <div class="flex justify-between text-xs mt-0.5" style="color:var(--text-tertiary)">
              <span>12px</span><span>20px</span>
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs font-medium" style="color:var(--text-secondary)">Linha</label>
              <span class="text-xs font-mono px-1.5 py-0.5 rounded" style="color:var(--color-brand);background:oklch(58% 0.19 245 / 0.10)">{{ layout().espacamentoLinha.toFixed(1) }}</span>
            </div>
            <input type="range" min="1.2" max="2.0" step="0.1"
                   [value]="layout().espacamentoLinha"
                   (input)="setLayout('espacamentoLinha', +$any($event.target).value)"
                   class="w-full h-1 rounded-full cursor-pointer"
                   style="accent-color:var(--color-brand);"/>
            <div class="flex justify-between text-xs mt-0.5" style="color:var(--text-tertiary)">
              <span>1.2</span><span>2.0</span>
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs font-medium" style="color:var(--text-secondary)">H1 (capítulo)</label>
              <span class="text-xs font-mono px-1.5 py-0.5 rounded" style="color:var(--color-brand);background:oklch(58% 0.19 245 / 0.10)">{{ layout().h1Tamanho }}px</span>
            </div>
            <input type="range" min="20" max="40" step="2"
                   [value]="layout().h1Tamanho"
                   (input)="setLayout('h1Tamanho', +$any($event.target).value)"
                   class="w-full h-1 rounded-full cursor-pointer"
                   style="accent-color:var(--color-brand);"/>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-xs font-medium" style="color:var(--text-secondary)">Margens laterais</label>
              <span class="text-xs font-mono px-1.5 py-0.5 rounded" style="color:var(--color-brand);background:oklch(58% 0.19 245 / 0.10)">{{ layout().margemLateral }}px</span>
            </div>
            <input type="range" min="24" max="80" step="8"
                   [value]="layout().margemLateral"
                   (input)="setLayout('margemLateral', +$any($event.target).value)"
                   class="w-full h-1 rounded-full cursor-pointer"
                   style="accent-color:var(--color-brand);"/>
          </div>

        </div>
      </aside>

      <!-- Modal de inserção de imagem — seleção de alinhamento -->
      @if (showImgModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center"
             style="background:oklch(22% 0.09 265 / 0.55);">
          <div class="rounded-2xl p-6 max-w-md w-full mx-4"
               style="background:var(--bg-base);box-shadow:var(--shadow-lg);border:1px solid var(--border-default);">
            <div class="flex items-center gap-2 mb-5">
              <span class="material-symbols-outlined" style="color:oklch(55% 0.18 145);font-size:22px;">image</span>
              <h3 class="font-display font-semibold text-base" style="color:var(--text-primary)">{{ isAjustando ? 'Ajustar alinhamento' : 'Inserir imagem' }}</h3>
            </div>

            <p class="text-xs mb-3" style="color:var(--text-secondary)">Como a imagem será posicionada na página?</p>

            <div class="grid grid-cols-2 gap-3 mb-5">
              @for (op of alinhamentos; track op.valor) {
                <button (click)="imgAlinhSel.set(op.valor)"
                        class="rounded-xl p-3 text-left transition-all"
                        [style]="imgAlinhSel() === op.valor
                          ? 'background:oklch(55% 0.18 145 / 0.10);border:2px solid oklch(55% 0.18 145);'
                          : 'background:var(--bg-surface);border:2px solid var(--border-subtle);'">
                  <span class="material-symbols-outlined block mb-1.5"
                        [style]="imgAlinhSel() === op.valor ? 'color:oklch(42% 0.16 145);font-size:22px' : 'color:var(--text-tertiary);font-size:22px'">
                    {{ op.icon }}
                  </span>
                  <p class="text-xs font-semibold"
                     [style]="imgAlinhSel() === op.valor ? 'color:oklch(35% 0.14 145)' : 'color:var(--text-primary)'">
                    {{ op.label }}
                  </p>
                  <p class="text-xs mt-0.5" style="color:var(--text-tertiary)">{{ op.desc }}</p>
                </button>
              }
            </div>

            <div class="flex gap-3 justify-end">
              <button (click)="showImgModal.set(false)"
                      class="rounded-lg px-4 py-2 text-sm font-medium"
                      style="background:var(--bg-surface-active);color:var(--text-secondary);">
                Cancelar
              </button>
              <button (click)="confirmarInserirImagem()"
                      class="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
                      style="background:oklch(55% 0.18 145);color:white;">
                <span class="material-symbols-outlined" style="font-size:16px;">{{ isAjustando ? 'check' : 'image' }}</span>
                {{ isAjustando ? 'Aplicar' : 'Inserir' }}
              </button>
            </div>
          </div>
        </div>
      }

      <!-- Modal de confirmação de remoção -->
      @if (showModal()) {
        <div class="fixed inset-0 z-50 flex items-center justify-center"
             style="background:oklch(22% 0.09 265 / 0.50);">
          <div class="rounded-2xl p-6 max-w-sm w-full mx-4"
               style="background:var(--bg-base);box-shadow:var(--shadow-lg);border:1px solid var(--border-default);">
            <div class="flex items-start gap-3 mb-4">
              <span class="material-symbols-outlined text-2xl flex-shrink-0 mt-0.5" style="color:var(--color-error)">warning</span>
              <div>
                <h3 class="font-display font-semibold text-base mb-1" style="color:var(--text-primary)">
                  Remover esta página?
                </h3>
                <p class="text-sm" style="color:var(--text-secondary)">
                  "{{ paginaAtual().titulo }}" será removida desta composição.<br>
                  Esta ação não pode ser desfeita na sessão atual.
                </p>
              </div>
            </div>
            <div class="flex gap-3 justify-end">
              <button (click)="showModal.set(false)"
                      class="rounded-lg px-4 py-2 text-sm font-medium transition-colors"
                      style="background:var(--bg-surface-active);color:var(--text-secondary);"
                      onmouseenter="this.style.background='var(--bg-surface-hover)'"
                      onmouseleave="this.style.background='var(--bg-surface-active)'">
                Cancelar
              </button>
              <button (click)="removerPagina()"
                      class="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
                      style="background:var(--color-error);color:white;">
                Remover página
              </button>
            </div>
          </div>
        </div>
      }

    </div>
  `,
})
export class EditorDeLayoutPreviewComponent {
  readonly ms          = manuscrito[0];
  readonly meta        = metadados[0];
  readonly steps       = STEPS;
  readonly alinhamentos = ALINHAMENTOS;

  paginas = signal<Array<{ n: number; titulo: string; texto: string; tipo: 'capitulo' | 'em-branco' | 'imagem'; alinhamento: Alinhamento | undefined }>>(
    CAPITULOS_INIT.map(c => ({ ...c, tipo: 'capitulo' as const, alinhamento: undefined }))
  );
  paginaIdx     = signal(0);
  layout        = signal<ConfiguracaoLayout>({ ...LAYOUT_INICIAL });
  showModal     = signal(false);
  showImgModal  = signal(false);
  imgAlinhSel   = signal<Alinhamento>('centralizado');
  toast         = signal('');

  paginaAtual = computed(() => this.paginas()[this.paginaIdx()]);
  paragrafos  = computed(() => (this.paginaAtual().texto ?? '').split('\n\n').filter(Boolean));

  anterior() { this.paginaIdx.update(i => Math.max(0, i - 1)); }
  proximo()  { this.paginaIdx.update(i => Math.min(this.paginas().length - 1, i + 1)); }

  adicionarPagina() {
    const novasPags = [...this.paginas()];
    const idx = this.paginaIdx() + 1;
    novasPags.splice(idx, 0, { n: idx + 1, titulo: 'Página em branco', texto: '', tipo: 'em-branco', alinhamento: undefined });
    this.paginas.set(novasPags);
    this.paginaIdx.set(idx);
    this.mostrarToast('Página em branco adicionada');
  }

  inserirImagem() {
    this.imgAlinhSel.set('centralizado');
    this.showImgModal.set(true);
  }

  confirmarInserirImagem() {
    const al = this.imgAlinhSel();
    const label = ALINHAMENTOS.find(a => a.valor === al)?.label ?? '';
    if (this._ajustando) {
      const novasPags = [...this.paginas()];
      novasPags[this.paginaIdx()] = { ...novasPags[this.paginaIdx()], alinhamento: al };
      this.paginas.set(novasPags);
      this._ajustando = false;
      this.showImgModal.set(false);
      this.mostrarToast('Alinhamento ajustado — ' + label);
    } else {
      const novasPags = [...this.paginas()];
      const idx = this.paginaIdx() + 1;
      novasPags.splice(idx, 0, { n: idx + 1, titulo: 'Imagem inserida', texto: '', tipo: 'imagem', alinhamento: al });
      this.paginas.set(novasPags);
      this.paginaIdx.set(idx);
      this.showImgModal.set(false);
      this.mostrarToast('Imagem inserida — ' + label);
    }
  }

  confirmarRemover() {
    if (this.paginas().length > 1) this.showModal.set(true);
  }

  removerPagina() {
    const novasPags = [...this.paginas()];
    novasPags.splice(this.paginaIdx(), 1);
    this.paginas.set(novasPags);
    this.paginaIdx.update(i => Math.max(0, i - 1));
    this.showModal.set(false);
    this.mostrarToast('Página removida');
  }

  mostrarToast(msg: string) {
    this.toast.set(msg);
    setTimeout(() => this.toast.set(''), 2500);
  }

  private _ajustando = false;
  get isAjustando() { return this._ajustando; }

  alinhLabel(al: string): string {
    return ALINHAMENTOS.find(a => a.valor === al)?.label ?? al;
  }

  ajustarAlinhamento() {
    this.imgAlinhSel.set(this.paginaAtual().alinhamento ?? 'centralizado');
    this._ajustando = true;
    this.showImgModal.set(true);
  }

  setLayout(campo: keyof ConfiguracaoLayout, valor: unknown) {
    this.layout.update(l => ({ ...l, [campo]: valor }));
  }

  stepStyle(n: number) {
    if (n < 3) return 'color:oklch(35% 0.14 145);font-weight:600';
    if (n === 3) return 'color:var(--color-brand);font-weight:600';
    return 'color:var(--text-tertiary)';
  }
  dotStyle(n: number) {
    if (n < 3) return 'background:oklch(58% 0.18 145);color:#fff';
    if (n === 3) return 'background:var(--color-brand);color:var(--text-on-brand)';
    return 'background:var(--bg-surface-active);color:var(--text-tertiary)';
  }
}
