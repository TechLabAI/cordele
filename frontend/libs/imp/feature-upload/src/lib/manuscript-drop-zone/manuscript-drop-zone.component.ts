/**
 * manuscript-drop-zone.component.ts — Presentational (FE-IMP-013).
 * Drag-and-drop + click-to-select area for manuscript files (.docx / .md).
 * Validates format and size; emits fileSelected(File) or validationError(string).
 * Displays the selected-file confirmation card while a file is chosen.
 * Does NOT initiate upload — that remains in the smart UploadComponent.
 */
import {
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Output,
  signal,
  ViewChild,
  ElementRef,
} from '@angular/core';

const ALLOWED_EXTENSIONS = ['.docx', '.md'];
const MAX_MB = 50;

type DropZoneState = 'idle' | 'selected' | 'error';

@Component({
  selector: 'imp-manuscript-drop-zone',
  standalone: true,
  imports: [],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div>
      <label class="block text-sm font-medium mb-1.5" style="color:var(--text-primary)">
        Manuscrito <span style="color:var(--color-error)">*</span>
      </label>

      <!-- Selected file confirmation card -->
      @if (state() === 'selected') {
        <div class="flex items-center gap-3 rounded-xl p-4"
             style="background:oklch(58% 0.18 145 / 0.08);border:1px solid oklch(58% 0.18 145 / 0.3);">
          <span class="material-symbols-outlined" style="color:oklch(35% 0.14 145);font-size:20px;">check_circle</span>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium truncate" style="color:oklch(35% 0.14 145)">{{ fileName() }}</p>
            <p class="text-xs" style="color:oklch(50% 0.12 145)">Arquivo pronto</p>
          </div>
          <button (click)="clearSelection()" class="text-xs underline" style="color:oklch(45% 0.12 145)">
            Remover
          </button>
        </div>
      }

      <!-- Drop zone (idle or after error) -->
      @if (state() === 'idle' || state() === 'error') {
        <div
          class="flex flex-col items-center justify-center rounded-xl py-14 px-8 text-center cursor-pointer transition-all"
          style="border:2px dashed var(--border-default);background:var(--bg-surface);"
          (dragover)="$event.preventDefault()"
          (drop)="onDrop($event)"
          (click)="fileInput.click()"
          onmouseenter="this.style.borderColor='var(--color-brand)';this.style.background='var(--color-brand-subtle)'"
          onmouseleave="this.style.borderColor='var(--border-default)';this.style.background='var(--bg-surface)'"
        >
          <span class="material-symbols-outlined text-4xl mb-3" style="color:var(--text-tertiary)">upload_file</span>
          <p class="text-sm font-medium" style="color:var(--text-secondary)">
            Arraste seu arquivo aqui ou
            <span style="color:var(--color-brand)">clique para selecionar</span>
          </p>
          <p class="text-xs mt-2" style="color:var(--text-tertiary)">
            Formatos aceitos: .docx · .md · Tamanho máximo: {{ MAX_MB }} MB
          </p>
        </div>

        @if (state() === 'error') {
          <p role="alert" class="mt-2 text-xs flex items-center gap-1" style="color:var(--color-error)">
            <span class="material-symbols-outlined" style="font-size:13px;">error</span>
            {{ errorMsg() }}
          </p>
        }
      }

      <!-- Hidden file input -->
      <input
        #fileInput
        type="file"
        accept=".docx,.md"
        class="hidden"
        (change)="onFileChange($event)"
      />
    </div>
  `,
})
export class ManuscriptDropZoneComponent {
  /** Emits the valid File when the user selects or drops a file that passes validation. */
  @Output() fileSelected = new EventEmitter<File>();
  /** Emits a human-readable error message when validation fails. */
  @Output() validationError = new EventEmitter<string>();

  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;

  protected readonly MAX_MB = MAX_MB;
  protected readonly state  = signal<DropZoneState>('idle');
  protected readonly fileName = signal('');
  protected readonly errorMsg = signal('');

  onDrop(event: DragEvent): void {
    event.preventDefault();
    const file = event.dataTransfer?.files[0];
    if (file) this.processFile(file);
  }

  onFileChange(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.processFile(file);
  }

  clearSelection(): void {
    this.state.set('idle');
    this.fileName.set('');
    // Reset the native input so the same file can be re-selected
    if (this.fileInput?.nativeElement) {
      this.fileInput.nativeElement.value = '';
    }
  }

  private processFile(file: File): void {
    const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase();
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      const msg = `Formato não suportado: ${ext}. Use .docx ou .md.`;
      this.state.set('error');
      this.errorMsg.set(msg);
      this.validationError.emit(msg);
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      const msg = `Arquivo muito grande (${(file.size / 1024 / 1024).toFixed(1)} MB). Limite: ${MAX_MB} MB.`;
      this.state.set('error');
      this.errorMsg.set(msg);
      this.validationError.emit(msg);
      return;
    }
    this.state.set('selected');
    this.fileName.set(file.name);
    this.fileSelected.emit(file);
  }
}
