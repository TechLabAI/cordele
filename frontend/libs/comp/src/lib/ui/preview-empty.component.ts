/**
 * preview-empty.component.ts — empty state for T06 when manuscript is missing (409).
 * FE-COMP-024 / SPEC-02 §2 / SPEC-07 §3 / P8 UX Polish.
 *
 * Rendered inside the canvas area of EditorDeLayoutPreviewComponent when status='empty'
 * (i.e. urn:cordele:comp:manuscript-missing — the project has no uploaded manuscript yet).
 *
 * Key behaviors:
 *   - Informs the user that there is no manuscript to preview.
 *   - Provides a "Voltar ao Importar" button that emits navigateBack so the parent
 *     can navigate without this component knowing about routes.
 *   - The style panel remains visible (it is rendered by the parent, not here).
 *
 * Contract (plan §3 P8):
 *   readonly navigateBack = output<void>()
 */
import { ChangeDetectionStrategy, Component, output } from '@angular/core';

@Component({
  selector: 'comp-preview-empty',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: [`:host { display: block; width: 100%; height: 100%; }`],
  template: `
    <div class="flex flex-col items-center justify-center gap-4 w-full h-full text-center px-6">
      <span
        class="material-symbols-outlined text-4xl"
        style="color:var(--text-tertiary)"
        aria-hidden="true"
      >
        article
      </span>

      <p class="text-sm font-medium" style="color:var(--text-secondary)">
        Ainda não há manuscrito para pré-visualizar.
      </p>

      <p class="text-xs max-w-xs" style="color:var(--text-tertiary)">
        O painel de estilos continua disponível para ajuste tipográfico.
        Quando um manuscrito for importado, o preview aparecerá aqui.
      </p>

      <button
        type="button"
        class="mt-2 inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium"
        style="background:var(--bg-surface-active);color:var(--text-secondary);"
        (click)="navigateBack.emit()"
      >
        <span
          class="material-symbols-outlined"
          style="font-size:16px;"
          aria-hidden="true"
        >arrow_back</span>
        Voltar ao Importar
      </button>
    </div>
  `,
})
export class PreviewEmptyComponent {
  /** Emitted when the user clicks "Voltar ao Importar". Parent handles routing. */
  readonly navigateBack = output<void>();
}
