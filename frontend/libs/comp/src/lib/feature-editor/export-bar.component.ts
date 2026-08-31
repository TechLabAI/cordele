/**
 * export-bar.component.ts — "Exportar" CTA for T06 Editor de Layout Preview.
 * FE-COMP-017 / SPEC-02 §2 / SPEC-01 §2.
 *
 * Presentational:
 *   - Button disabled when !canExport or saving=true.
 *   - "Exportar" = navigation to PUB (SPEC-01 §2, D-M); never changes project status.
 *   - No HTTP calls from this component.
 */
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
} from '@angular/core';

@Component({
  selector: 'comp-export-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      (click)="onExportClick()"
      [disabled]="!canExport() || saving()"
      class="inline-flex items-center gap-1 rounded-lg px-4 py-1.5 text-sm font-semibold transition-opacity"
      [style]="buttonStyle()"
      [attr.aria-busy]="saving() ? 'true' : null"
      aria-label="Exportar para publicação"
    >
      @if (saving()) {
        <span class="material-symbols-outlined animate-spin" style="font-size:16px;" aria-hidden="true">
          progress_activity
        </span>
        Exportando...
      } @else {
        <span class="material-symbols-outlined" style="font-size:16px;" aria-hidden="true">
          file_export
        </span>
        Exportar
      }
    </button>
  `,
})
export class ExportBarComponent {
  readonly saving    = input<boolean>(false);
  readonly canExport = input<boolean>(false);

  /** Emits when the user clicks Export (and the action is valid). */
  readonly exportClicked = output<void>();

  readonly buttonStyle = computed(() => {
    if (this.canExport() && !this.saving()) {
      return 'background:var(--color-brand);color:var(--text-on-brand);opacity:1;';
    }
    return 'background:var(--bg-surface-active);color:var(--text-tertiary);cursor:not-allowed;';
  });

  onExportClick(): void {
    if (this.canExport() && !this.saving()) {
      this.exportClicked.emit();
    }
  }
}
