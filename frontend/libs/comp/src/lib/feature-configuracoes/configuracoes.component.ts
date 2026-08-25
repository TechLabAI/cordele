/**
 * configuracoes.component.ts — T05 Configuração de Metadados.
 * Promoted from design-reference/screens/configuracoes (D-493/D-494).
 * Changes vs prototype:
 *   - Removed: import of shared/mock-data; local mock-seeded signal
 *   - Added: MetadadosFacade injection; ActivatedRoute for :projetoId param
 *   - oklch(...) literals removed; --paper-accent token introduced for brand-adjacent colors
 *   - RouterLink path updated to use :projetoId param
 *   - avancar() delegates to facade (saves + navigates to T06)
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
import { MetadadosFacade } from '../metadados.facade';
import { MetadadosIdioma } from '../models/comp.models';

const STEPS = [
  { n: 1, label: 'Importar' }, { n: 2, label: 'Configurar' },
  { n: 3, label: 'Visualizar' }, { n: 4, label: 'Exportar' },
];

const IDIOMAS: { value: MetadadosIdioma; label: string }[] = [
  { value: 'pt', label: 'Português' }, { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' }, { value: 'fr', label: 'Français' },
];

@Component({
  selector: 'comp-configuracoes',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`:host {
    --paper-accent: var(--color-brand);
    --paper-accent-dark: color-mix(in oklch, var(--color-brand) 80%, black);
    --paper-success-bg: oklch(58% 0.18 145);
    --paper-success-text: oklch(35% 0.14 145);
    display: block;
  }`],
  template: `
    <div class="px-8 py-8 max-w-[var(--content-max-width)] mx-auto">

      <!-- Barra de etapas -->
      <nav class="flex items-center gap-1 mb-10 text-sm">
        @for (step of steps; track step.n) {
          <span class="flex items-center gap-1.5" [style]="stepStyle(step.n)">
            <span class="inline-flex items-center justify-center size-5 rounded-full text-xs font-bold"
                  [style]="dotStyle(step.n)">
              @if (step.n < 2) { <span class="material-symbols-outlined" style="font-size:12px;">check</span> }
              @else { {{ step.n }} }
            </span>
            {{ step.label }}
          </span>
          @if (!$last) { <span class="mx-2" style="color:var(--border-strong)">›</span> }
        }
      </nav>

      <div class="mb-8" style="border-left:4px solid var(--paper-accent);padding-left:14px;">
        <h1 class="font-display font-semibold text-2xl" style="color:var(--text-primary)">Metadados do livro</h1>
      </div>

      <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">

        <!-- Título -->
        <div class="sm:col-span-2">
          <label class="block text-sm font-medium mb-1.5" style="color:var(--text-primary)">
            Título <span style="color:var(--color-error)">*</span>
          </label>
          <input type="text" [value]="facade.form().titulo"
                 (input)="facade.updateField('titulo', $any($event.target).value)"
                 placeholder="Título do livro"
                 class="w-full rounded-lg px-4 py-2.5 text-sm outline-none"
                 style="background:var(--bg-surface);border:1px solid var(--border-default);color:var(--text-primary);"
                 onfocus="this.style.borderColor='var(--color-brand)'"
                 onblur="this.style.borderColor='var(--border-default)'"/>
        </div>

        <!-- Autor -->
        <div>
          <label class="block text-sm font-medium mb-1.5" style="color:var(--text-primary)">
            Autor <span style="color:var(--color-error)">*</span>
          </label>
          <input type="text" [value]="facade.form().autor"
                 (input)="facade.updateField('autor', $any($event.target).value)"
                 placeholder="Nome do autor"
                 class="w-full rounded-lg px-4 py-2.5 text-sm outline-none"
                 style="background:var(--bg-surface);border:1px solid var(--border-default);color:var(--text-primary);"
                 onfocus="this.style.borderColor='var(--color-brand)'"
                 onblur="this.style.borderColor='var(--border-default)'"/>
        </div>

        <!-- ISBN -->
        <div>
          <label class="block text-sm font-medium mb-1.5" style="color:var(--text-primary)">ISBN</label>
          <input type="text" [value]="facade.form().isbn ?? ''"
                 (input)="facade.updateField('isbn', $any($event.target).value || null)"
                 placeholder="978-65-..."
                 class="w-full rounded-lg px-4 py-2.5 text-sm outline-none"
                 style="background:var(--bg-surface);border:1px solid var(--border-default);color:var(--text-primary);"
                 onfocus="this.style.borderColor='var(--color-brand)'"
                 onblur="this.style.borderColor='var(--border-default)'"/>
        </div>

        <!-- Idioma -->
        <div>
          <label class="block text-sm font-medium mb-1.5" style="color:var(--text-primary)">
            Idioma <span style="color:var(--color-error)">*</span>
          </label>
          <select [value]="facade.form().idioma"
                  (change)="facade.updateField('idioma', $any($event.target).value)"
                  class="w-full rounded-lg px-4 py-2.5 text-sm outline-none cursor-pointer"
                  style="background:var(--bg-surface);border:1px solid var(--border-default);color:var(--text-primary);">
            @for (lang of idiomas; track lang.value) {
              <option [value]="lang.value">{{ lang.label }}</option>
            }
          </select>
        </div>

        <!-- Categoria -->
        <div>
          <label class="block text-sm font-medium mb-1.5" style="color:var(--text-primary)">Categoria</label>
          <input type="text" [value]="facade.form().categoria ?? ''"
                 (input)="facade.updateField('categoria', $any($event.target).value || null)"
                 placeholder="ex.: Romance contemporâneo"
                 class="w-full rounded-lg px-4 py-2.5 text-sm outline-none"
                 style="background:var(--bg-surface);border:1px solid var(--border-default);color:var(--text-primary);"
                 onfocus="this.style.borderColor='var(--color-brand)'"
                 onblur="this.style.borderColor='var(--border-default)'"/>
        </div>

        <!-- Capa -->
        <div class="sm:col-span-2">
          <label class="block text-sm font-medium mb-1.5" style="color:var(--text-primary)">Capa do livro</label>

          @if (!facade.capaPreview()) {
            <div class="flex items-center justify-center rounded-xl py-8 px-6 text-center cursor-pointer transition-all"
                 style="border:2px dashed var(--border-default);background:var(--bg-surface);"
                 (click)="capaInput.click()"
                 onmouseenter="this.style.borderColor='var(--color-brand)'"
                 onmouseleave="this.style.borderColor='var(--border-default)'">
              <div>
                <span class="material-symbols-outlined text-3xl mb-2 block" style="color:var(--text-tertiary)">image</span>
                <p class="text-sm" style="color:var(--text-secondary)">
                  Arraste uma imagem ou <span style="color:var(--color-brand)">clique para selecionar</span>
                </p>
                <p class="text-xs mt-1" style="color:var(--text-tertiary)">JPG, PNG, WEBP · Recomendado: 1600 × 2400 px</p>
              </div>
            </div>
            <input #capaInput type="file" accept="image/jpeg,image/png,image/webp" class="hidden" (change)="onCapa($event)"/>
          }

          @if (facade.capaPreview()) {
            <div class="flex items-center gap-4 rounded-xl p-4"
                 style="background:var(--bg-surface);border:1px solid var(--border-subtle);">
              <img [src]="facade.capaPreview()" alt="Pré-visualização da capa"
                   class="w-16 rounded shadow-sm object-cover aspect-[2/3]"/>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate" style="color:var(--text-primary)">Capa selecionada</p>
                <p class="text-xs" style="color:var(--text-secondary)">Imagem carregada localmente</p>
              </div>
              <button (click)="facade.clearCapa()" class="text-xs underline" style="color:var(--text-tertiary)">Remover</button>
            </div>
          }
        </div>

      </div>

      <!-- Erro de validação geral -->
      @if (tentouSubmit() && !facade.valido()) {
        <p class="mt-4 text-sm flex items-center gap-1" style="color:var(--color-error)">
          <span class="material-symbols-outlined" style="font-size:16px;">error</span>
          Preencha os campos obrigatórios: Título e Autor.
        </p>
      }

      @if (facade.error()) {
        <p class="mt-4 text-sm flex items-center gap-1" style="color:var(--color-error)">
          <span class="material-symbols-outlined" style="font-size:16px;">error</span>
          {{ facade.error() }}
        </p>
      }

      <!-- CTAs -->
      <div class="mt-8 flex items-center justify-between">
        <a [routerLink]="['/imp', 'projetos', projetoId, 'importar']"
           class="text-sm flex items-center gap-1"
           style="color:var(--text-secondary);">
          <span class="material-symbols-outlined" style="font-size:16px;">arrow_back</span>
          Voltar
        </a>
        <button (click)="avancar()"
                class="inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-opacity"
                [style]="facade.valido()
                  ? 'background:var(--color-brand);color:var(--text-on-brand);'
                  : 'background:var(--bg-surface-active);color:var(--text-tertiary);cursor:not-allowed;'">
          Ir para preview
          <span class="material-symbols-outlined" style="font-size:18px;">arrow_forward</span>
        </button>
      </div>

    </div>
  `,
})
export class ConfiguracoesComponent implements OnInit {
  readonly facade  = inject(MetadadosFacade);
  private readonly route = inject(ActivatedRoute);

  readonly steps   = STEPS;
  readonly idiomas = IDIOMAS;

  projetoId     = '';
  tentouSubmit  = signal(false);

  ngOnInit(): void {
    this.projetoId = this.route.snapshot.paramMap.get('projetoId') ?? '';
    this.facade.load(this.projetoId);
  }

  onCapa(e: Event): void {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) this.facade.onCapa(this.projetoId, f);
  }

  avancar(): void {
    this.tentouSubmit.set(true);
    if (!this.facade.valido()) return;
    this.facade.avancar(this.projetoId);
  }

  stepStyle(n: number): string {
    if (n < 2) return 'color:var(--paper-success-text);font-weight:600';
    if (n === 2) return 'color:var(--color-brand);font-weight:600';
    return 'color:var(--text-tertiary)';
  }

  dotStyle(n: number): string {
    if (n < 2) return 'background:var(--paper-success-bg);color:#fff';
    if (n === 2) return 'background:var(--color-brand);color:var(--text-on-brand)';
    return 'background:var(--bg-surface-active);color:var(--text-tertiary)';
  }
}
