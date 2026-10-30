/**
 * upload.component.ts — T03 Upload (smart component).
 * Promoted from prototype, connected to ImportFacade (D-494).
 *
 * Contracts honoured:
 *   - POST is SYNCHRONOUS (D-A): phase='uploading' shows indeterminate "analisando estrutura…"
 *   - File + EXACTLY ONE of {projetoTitulo | projetoId} (D-C).
 *   - Route /imp/upload → projetoTitulo (new project); /imp/projetos/:projetoId/importar → projetoId.
 *   - On 'done': ImportFacade navigates to /imp/manuscritos/{id}/revisao (zero extra GET).
 *
 * P4 update: uses presentational sub-components (FE-IMP-012..015).
 * P5 update: StepBarComponent now imports from @cordele/imp/navigation (real component, FE-IMP-018).
 */
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ImportFacade } from '@cordele/imp/data-access';
import { StepBarComponent } from '@cordele/imp/navigation';
import { ProjectNameFieldComponent } from '../project-name-field/project-name-field.component';
import { ManuscriptDropZoneComponent } from '../manuscript-drop-zone/manuscript-drop-zone.component';
import { UploadProgressCardComponent } from '../upload-progress-card/upload-progress-card.component';
import { ImportSubmitButtonComponent } from '../import-submit-button/import-submit-button.component';

const STEPS = ['Importar', 'Configurar', 'Visualizar', 'Exportar'];

@Component({
  selector: 'imp-upload',
  standalone: true,
  imports: [
    RouterLink,
    StepBarComponent,
    ProjectNameFieldComponent,
    ManuscriptDropZoneComponent,
    UploadProgressCardComponent,
    ImportSubmitButtonComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="px-8 py-8 max-w-[var(--content-max-width)] mx-auto">

      <!-- Step bar (real — imp-navigation/StepBarComponent, FE-IMP-018/P5) -->
      <imp-step-bar [steps]="STEPS" [activeIndex]="0" />

      <div class="mb-8" style="border-left:4px solid oklch(42% 0.20 245);padding-left:14px;">
        <h1 class="font-display font-semibold text-2xl" style="color:var(--text-primary)">
          {{ projetoId() ? 'Importar manuscrito' : 'Novo projeto' }}
        </h1>
      </div>

      <!-- Nome do projeto (only for new-project flow) -->
      @if (!projetoId()) {
        <div class="mb-6">
          <imp-project-name-field
            [value]="nome()"
            (valueChange)="nome.set($event)"
          />
        </div>
      }

      <!-- Upload progress / error card (while uploading or on error) -->
      <div class="mb-2">
        @if (facade.phase() === 'uploading' || facade.phase() === 'error') {
          <imp-upload-progress-card
            [phase]="facade.phase()"
            [fileName]="selectedFileName()"
            [errorMessage]="facade.error()"
            (retry)="onRetry()"
          />
        }

        <!-- Drop zone (visible when idle or after retrying from error) -->
        @if (facade.phase() === 'idle' || facade.phase() === 'error') {
          <imp-manuscript-drop-zone
            (fileSelected)="onFileSelected($event)"
            (validationError)="onValidationError($event)"
          />
        }
      </div>

      <!-- CTAs -->
      <div class="mt-8 flex items-center justify-end gap-4">
        <a routerLink="/proj" class="text-sm" style="color:var(--text-secondary)">Cancelar</a>
        <imp-import-submit-button
          [disabled]="!canSubmit()"
          [busy]="facade.phase() === 'uploading'"
          (importSubmit)="importar()"
        />
      </div>

    </div>
  `,
})
export class UploadComponent implements OnInit {
  readonly facade = inject(ImportFacade);
  readonly route  = inject(ActivatedRoute);

  protected readonly STEPS = STEPS;

  // ── Local state ────────────────────────────────────────────────────────────

  nome              = signal('');
  selectedFileName  = signal('');
  private selectedFile: File | null = null;

  // projetoId from route param (existing-project flow: /imp/projetos/:projetoId/importar)
  projetoId = signal<string | null>(null);

  canSubmit = computed(() => {
    // selectedFileName() is a signal proxy for selectedFile (non-reactive plain property)
    const fileReady = this.selectedFileName() !== '';
    const nomeOk    = this.projetoId() ? true : this.nome().trim().length >= 3;
    return fileReady && nomeOk;
  });

  // ── Lifecycle ──────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('projetoId');
    if (id) this.projetoId.set(id);
    this.facade.reset();
  }

  // ── Event handlers (from presentational components) ────────────────────────

  onFileSelected(file: File): void {
    this.selectedFile = file;
    this.selectedFileName.set(file.name);
  }

  onValidationError(_msg: string): void {
    // Drop zone already shows the error inline; clear any selected file
    this.selectedFile = null;
    this.selectedFileName.set('');
  }

  onRetry(): void {
    this.selectedFile = null;
    this.selectedFileName.set('');
    this.facade.reset();
  }

  importar(): void {
    if (!this.canSubmit() || !this.selectedFile) return;
    const params = this.projetoId()
      ? { file: this.selectedFile, projetoId: this.projetoId() ?? '' }
      : { file: this.selectedFile, projetoTitulo: this.nome().trim() };
    // Navigation to T04 is handled by ImportFacade.importar() on success
    this.facade.importar(params);
  }
}
