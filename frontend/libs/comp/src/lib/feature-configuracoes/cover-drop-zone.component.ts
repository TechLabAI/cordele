/**
 * cover-drop-zone.component.ts — cover image upload drop zone for T05.
 * FE-COMP-013 / SPEC-02 §1 / SPEC-07 §1.
 *
 * Presentational:
 *   - Accepts image/jpeg|png|webp ≤ 10 MB (client-side validation before emitting).
 *   - Inline error for 413 (too-large) and 415 (unsupported-format); rest of form intact.
 *   - Disabled and shows spinner while uploading=true.
 *   - Hidden when canEdit=false (write affordances masked).
 *   - Does NOT make HTTP calls; delegates to MetadataFacade via parent.
 *
 * Note: comp.coverUpload flag gate is handled by the parent (INT-FE-COMP-005, P4).
 */
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  ViewChild,
  input,
  output,
  signal,
} from '@angular/core';
import { CompUiError } from '../comp-error.mapper';

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

/** Client-side validation error type — maps to 413/415 URNs from the BE. */
export type CoverClientError = 'too-large' | 'unsupported-format';

@Component({
  selector: 'comp-cover-drop-zone',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Hide write affordances when canEdit=false -->
    @if (!capaUrl() && !uploading()) {
      <!-- Drop zone (visible when no cover selected) -->
      <div
        class="flex items-center justify-center rounded-xl py-8 px-6 text-center transition-all"
        [class.cursor-pointer]="canEdit()"
        [class.cursor-not-allowed]="!canEdit()"
        style="border:2px dashed var(--border-default);background:var(--bg-surface);"
        (click)="canEdit() && fileInput.click()"
        (keydown.enter)="canEdit() && fileInput.click()"
        (dragover)="onDragOver($event)"
        (drop)="onDrop($event)"
        tabindex="0"
        role="button"
        [attr.aria-disabled]="!canEdit()"
        aria-label="Selecionar capa do livro"
      >
        <div>
          <span class="material-symbols-outlined text-3xl mb-2 block" style="color:var(--text-tertiary)" aria-hidden="true">
            image
          </span>
          @if (canEdit()) {
            <p class="text-sm" style="color:var(--text-secondary)">
              Arraste uma imagem ou <span style="color:var(--color-brand)">clique para selecionar</span>
            </p>
            <p class="text-xs mt-1" style="color:var(--text-tertiary)">
              JPG, PNG, WEBP · Recomendado: 1600 × 2400 px · Máx. 10 MB
            </p>
          } @else {
            <p class="text-sm" style="color:var(--text-tertiary)">Sem permissão para alterar a capa</p>
          }
        </div>
      </div>
      <input
        #fileInput
        type="file"
        accept="image/jpeg,image/png,image/webp"
        class="hidden"
        [disabled]="!canEdit()"
        (change)="onFileChange($event)"
        aria-hidden="true"
      />
    }

    <!-- Uploading state -->
    @if (uploading()) {
      <div
        class="flex items-center gap-4 rounded-xl p-4"
        style="background:var(--bg-surface);border:1px solid var(--border-subtle);"
      >
        <span class="material-symbols-outlined animate-spin text-2xl" style="color:var(--color-brand)" aria-hidden="true">
          progress_activity
        </span>
        <p class="text-sm" style="color:var(--text-secondary)">Enviando capa...</p>
      </div>
    }

    <!-- Preview state (cover already uploaded) -->
    @if (capaUrl() && !uploading()) {
      <div
        class="flex items-center gap-4 rounded-xl p-4"
        style="background:var(--bg-surface);border:1px solid var(--border-subtle);"
      >
        <img
          [src]="capaUrl()"
          alt="Pré-visualização da capa"
          class="w-16 rounded shadow-sm object-cover aspect-[2/3]"
        />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate" style="color:var(--text-primary)">Capa carregada</p>
          <p class="text-xs" style="color:var(--text-secondary)">Imagem do servidor</p>
        </div>
        @if (canEdit()) {
          <button
            type="button"
            (click)="remove.emit()"
            class="text-xs underline"
            style="color:var(--text-tertiary)"
          >
            Remover
          </button>
        }
      </div>
    }

    <!-- Inline error (client-side or from BE via parent) -->
    @if (clientError() || error()) {
      <p class="mt-2 text-xs flex items-center gap-1" style="color:var(--color-error)" role="alert">
        <span class="material-symbols-outlined" style="font-size:14px;" aria-hidden="true">error</span>
        {{ errorMessage() }}
      </p>
    }
  `,
})
export class CoverDropZoneComponent {
  @ViewChild('fileInput') fileInputRef?: ElementRef<HTMLInputElement>;

  readonly capaUrl   = input<string | null>(null);
  readonly uploading = input<boolean>(false);
  /** Server-side error forwarded by the facade (413/415 URNs map to channel='cover-inline'). */
  readonly error     = input<CompUiError | null>(null);
  /** Gates write affordances (upload/remove buttons). Cover is optional; display always shown. */
  readonly canEdit   = input<boolean>(true);

  /** Emits the selected File after client-side validation passes. */
  readonly fileSelected = output<File>();
  /** Emits when the user clicks "Remover". */
  readonly remove       = output<void>();

  /** Client-side validation error (too-large or unsupported-format). */
  readonly clientError = signal<CoverClientError | null>(null);

  readonly errorMessage = (): string => {
    const ce = this.clientError();
    if (ce === 'too-large') return 'A capa excede 10 MB.';
    if (ce === 'unsupported-format') return 'Formato inválido. Use JPEG, PNG ou WebP.';
    // Fall through to server error message
    return this.error()?.message ?? '';
  };

  onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.validateAndEmit(file);
    // Reset the input so the same file can be re-selected after removal
    (event.target as HTMLInputElement).value = '';
  }

  onDragOver(event: DragEvent): void {
    if (!this.canEdit()) return;
    event.preventDefault();
  }

  onDrop(event: DragEvent): void {
    if (!this.canEdit()) return;
    event.preventDefault();
    const file = event.dataTransfer?.files?.[0];
    if (file) this.validateAndEmit(file);
  }

  private validateAndEmit(file: File): void {
    this.clientError.set(null);

    if (!ACCEPTED_TYPES.includes(file.type as typeof ACCEPTED_TYPES[number])) {
      this.clientError.set('unsupported-format');
      return;
    }

    if (file.size > MAX_SIZE_BYTES) {
      this.clientError.set('too-large');
      return;
    }

    this.fileSelected.emit(file);
  }
}
