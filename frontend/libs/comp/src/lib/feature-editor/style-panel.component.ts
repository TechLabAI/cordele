/**
 * style-panel.component.ts — typography style panel for T06.
 * FE-COMP-015 / SPEC-02 §2 / api-contract §7.3.
 *
 * Exposes EXACTLY the 7 PUB-honoured parameters:
 *   fonteCorpoFamilia · fonteCorpoTamanho · espacamentoLinha · margemLateral
 *   h1Tamanho · h2Tamanho · h3Tamanho
 *
 * No structural controls (no add/remove page, no insert-image).
 * Enforces ranges locally; h1≥h2≥h3 clamped before emitting.
 * Emits styleChange({param, value}) on every user interaction — no network calls.
 */
import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
} from '@angular/core';
import { ConfiguracaoLayoutDto, FonteCorpoFamilia } from '../models/comp.models';

/** Slider/select range config per parameter — api-contract §7.3 / SPEC-02 §2. */
const STYLE_LIMITS = {
  fonteCorpoTamanho: { min: 12, max: 20, step: 1 },
  espacamentoLinha:  { min: 1.2, max: 2.0, step: 0.1 },
  margemLateral:     { min: 10, max: 40, step: 2 },
  h1Tamanho:         { min: 14, max: 48, step: 2 },
  h2Tamanho:         { min: 14, max: 48, step: 2 },
  h3Tamanho:         { min: 14, max: 48, step: 2 },
} as const;

type StyleParam = keyof ConfiguracaoLayoutDto;

export interface StyleChangeEvent {
  param: StyleParam;
  value: number | FonteCorpoFamilia;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Enforce h1≥h2≥h3 hierarchy and return a corrected value for the mutated param.
 * Returns the (possibly clamped) value to emit.
 */
function enforceHierarchy(
  layout: ConfiguracaoLayoutDto,
  param: StyleParam,
  rawValue: number,
): number {
  let h1 = param === 'h1Tamanho' ? rawValue : layout.h1Tamanho;
  let h2 = param === 'h2Tamanho' ? rawValue : layout.h2Tamanho;
  let h3 = param === 'h3Tamanho' ? rawValue : layout.h3Tamanho;

  if (param === 'h3Tamanho') {
    // h3 increased above h2 → lift h2 and h1 as needed
    if (h3 > h2) { h2 = h3; }
    if (h2 > h1) { h1 = h2; }
  } else if (param === 'h2Tamanho') {
    // h2 changed
    if (h2 > h1) { h1 = h2; }
    if (h2 < h3) { h2 = h3; }
  } else if (param === 'h1Tamanho') {
    // h1 decreased below h2 → lower h2 and h3 as needed
    if (h1 < h2) { h2 = h1; }
    if (h2 < h3) { h3 = h2; }
  }

  if (param === 'h1Tamanho') return h1;
  if (param === 'h2Tamanho') return h2;
  if (param === 'h3Tamanho') return h3;
  return rawValue;
}

@Component({
  selector: 'comp-style-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="w-64 flex-shrink-0 overflow-y-auto border-l"
           style="background:var(--bg-surface);border-color:var(--border-subtle);">

      <div class="px-5 py-3 border-b"
           style="background:color-mix(in srgb,var(--color-brand) 6%,transparent);border-color:color-mix(in srgb,var(--color-brand) 18%,transparent);">
        <p class="text-xs font-bold uppercase tracking-wider" style="color:var(--color-brand)">
          Painel de Estilos
        </p>
      </div>

      <div class="px-5 py-5 space-y-6">

        <!-- Fonte do corpo -->
        <div>
          <label class="block text-xs font-medium mb-2" style="color:var(--text-secondary)">
            Fonte do corpo
          </label>
          <select
            [value]="layout().fonteCorpoFamilia"
            [disabled]="!canEdit()"
            (change)="onFamiliaChange($event)"
            class="w-full rounded-lg px-3 py-2 text-sm outline-none"
            [class.cursor-pointer]="canEdit()"
            [class.cursor-not-allowed]="!canEdit()"
            style="background:var(--bg-base);border:1px solid var(--border-default);color:var(--text-primary);"
          >
            <option value="serif">Serif (Georgia)</option>
            <option value="sans-serif">Sans-serif (Inter)</option>
          </select>
        </div>

        <!-- Tamanho do corpo -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-xs font-medium" style="color:var(--text-secondary)">Tamanho</label>
            <span class="text-xs font-mono px-1.5 py-0.5 rounded"
                  style="color:var(--color-brand);background:color-mix(in srgb,var(--color-brand) 10%,transparent)">
              {{ layout().fonteCorpoTamanho }}px
            </span>
          </div>
          <input type="range"
                 [min]="limits.fonteCorpoTamanho.min" [max]="limits.fonteCorpoTamanho.max"
                 [step]="limits.fonteCorpoTamanho.step"
                 [value]="layout().fonteCorpoTamanho"
                 [disabled]="!canEdit()"
                 (input)="onNumericChange('fonteCorpoTamanho', $event)"
                 class="w-full h-1 rounded-full"
                 [class.cursor-pointer]="canEdit()"
                 style="accent-color:var(--color-brand);" />
          <div class="flex justify-between text-xs mt-0.5" style="color:var(--text-tertiary)">
            <span>{{ limits.fonteCorpoTamanho.min }}px</span>
            <span>{{ limits.fonteCorpoTamanho.max }}px</span>
          </div>
        </div>

        <!-- Espaçamento de linha -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-xs font-medium" style="color:var(--text-secondary)">Linha</label>
            <span class="text-xs font-mono px-1.5 py-0.5 rounded"
                  style="color:var(--color-brand);background:color-mix(in srgb,var(--color-brand) 10%,transparent)">
              {{ layout().espacamentoLinha.toFixed(1) }}
            </span>
          </div>
          <input type="range"
                 [min]="limits.espacamentoLinha.min" [max]="limits.espacamentoLinha.max"
                 [step]="limits.espacamentoLinha.step"
                 [value]="layout().espacamentoLinha"
                 [disabled]="!canEdit()"
                 (input)="onNumericChange('espacamentoLinha', $event)"
                 class="w-full h-1 rounded-full"
                 [class.cursor-pointer]="canEdit()"
                 style="accent-color:var(--color-brand);" />
          <div class="flex justify-between text-xs mt-0.5" style="color:var(--text-tertiary)">
            <span>{{ limits.espacamentoLinha.min }}</span>
            <span>{{ limits.espacamentoLinha.max }}</span>
          </div>
        </div>

        <!-- Margens laterais -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-xs font-medium" style="color:var(--text-secondary)">Margens laterais</label>
            <span class="text-xs font-mono px-1.5 py-0.5 rounded"
                  style="color:var(--color-brand);background:color-mix(in srgb,var(--color-brand) 10%,transparent)">
              {{ layout().margemLateral }}px
            </span>
          </div>
          <input type="range"
                 [min]="limits.margemLateral.min" [max]="limits.margemLateral.max"
                 [step]="limits.margemLateral.step"
                 [value]="layout().margemLateral"
                 [disabled]="!canEdit()"
                 (input)="onNumericChange('margemLateral', $event)"
                 class="w-full h-1 rounded-full"
                 [class.cursor-pointer]="canEdit()"
                 style="accent-color:var(--color-brand);" />
          <div class="flex justify-between text-xs mt-0.5" style="color:var(--text-tertiary)">
            <span>{{ limits.margemLateral.min }}px</span>
            <span>{{ limits.margemLateral.max }}px</span>
          </div>
        </div>

        <!-- H1 (capítulo) -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-xs font-medium" style="color:var(--text-secondary)">H1 (capítulo)</label>
            <span class="text-xs font-mono px-1.5 py-0.5 rounded"
                  style="color:var(--color-brand);background:color-mix(in srgb,var(--color-brand) 10%,transparent)">
              {{ layout().h1Tamanho }}px
            </span>
          </div>
          <input type="range"
                 [min]="limits.h1Tamanho.min" [max]="limits.h1Tamanho.max"
                 [step]="limits.h1Tamanho.step"
                 [value]="layout().h1Tamanho"
                 [disabled]="!canEdit()"
                 (input)="onNumericChange('h1Tamanho', $event)"
                 class="w-full h-1 rounded-full"
                 [class.cursor-pointer]="canEdit()"
                 style="accent-color:var(--color-brand);" />
        </div>

        <!-- H2 -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-xs font-medium" style="color:var(--text-secondary)">H2 (secção)</label>
            <span class="text-xs font-mono px-1.5 py-0.5 rounded"
                  style="color:var(--color-brand);background:color-mix(in srgb,var(--color-brand) 10%,transparent)">
              {{ layout().h2Tamanho }}px
            </span>
          </div>
          <input type="range"
                 [min]="limits.h2Tamanho.min" [max]="limits.h2Tamanho.max"
                 [step]="limits.h2Tamanho.step"
                 [value]="layout().h2Tamanho"
                 [disabled]="!canEdit()"
                 (input)="onNumericChange('h2Tamanho', $event)"
                 class="w-full h-1 rounded-full"
                 [class.cursor-pointer]="canEdit()"
                 style="accent-color:var(--color-brand);" />
        </div>

        <!-- H3 -->
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-xs font-medium" style="color:var(--text-secondary)">H3 (sub-secção)</label>
            <span class="text-xs font-mono px-1.5 py-0.5 rounded"
                  style="color:var(--color-brand);background:color-mix(in srgb,var(--color-brand) 10%,transparent)">
              {{ layout().h3Tamanho }}px
            </span>
          </div>
          <input type="range"
                 [min]="limits.h3Tamanho.min" [max]="limits.h3Tamanho.max"
                 [step]="limits.h3Tamanho.step"
                 [value]="layout().h3Tamanho"
                 [disabled]="!canEdit()"
                 (input)="onNumericChange('h3Tamanho', $event)"
                 class="w-full h-1 rounded-full"
                 [class.cursor-pointer]="canEdit()"
                 style="accent-color:var(--color-brand);" />
        </div>

      </div>
    </aside>
  `,
})
export class StylePanelComponent {
  readonly layout  = input.required<ConfiguracaoLayoutDto>();
  /** Gates all write controls. When false, sliders and select are disabled (read-only display). */
  readonly canEdit = input<boolean>(true);

  /** Emits on every user change — NO network calls; facade persists on export. */
  readonly styleChange = output<StyleChangeEvent>();

  readonly limits = STYLE_LIMITS;

  onFamiliaChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as FonteCorpoFamilia;
    this.styleChange.emit({ param: 'fonteCorpoFamilia', value });
  }

  onNumericChange(param: StyleParam, event: Event): void {
    const raw   = parseFloat((event.target as HTMLInputElement).value);
    const isHeading = ['h1Tamanho', 'h2Tamanho', 'h3Tamanho'].includes(param);

    const value = isHeading
      ? enforceHierarchy(this.layout(), param, raw)
      : clamp(raw, (STYLE_LIMITS as Record<string, {min:number;max:number}>)[param].min, (STYLE_LIMITS as Record<string, {min:number;max:number}>)[param].max);

    this.styleChange.emit({ param, value });
  }
}
