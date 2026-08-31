/**
 * configuracoes.component.ts — T05 Configuração de Metadados (smart component).
 * FE-COMP-011 / SPEC-02 §1.
 * FE-COMP-023 — dynamic breadcrumb resolution via CompShellIntegrationService (P7).
 *
 * Smart:
 *   - Reads MetadadosFacade signals; delegates UI to presentational children.
 *   - No HttpClient — all data flow via MetadadosFacade.
 *   - No shared/mock-data imports.
 *
 * P3 update (FE-COMP-011..013):
 *   - Refactored to use child presentational components:
 *     StepBarComponent, MetadataFieldComponent, IdiomaSelectComponent,
 *     CoverDropZoneComponent, AdvanceBarComponent.
 *   - All deprecated facade aliases replaced by canonical API.
 *   - selector updated to app-comp-configuracoes (SPEC-02 §1).
 *
 * P7 update (FE-COMP-023):
 *   - Calls CompShellIntegrationService.setActiveProject(projetoId) in ngOnInit
 *     to resolve `{nome}` breadcrumb dynamically.
 *   - Renders resolved breadcrumbs above the step-bar.
 */
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MetadadosFacade } from '../metadados.facade';
import { MetadadosDto, MetadadosIdioma } from '../models/comp.models';
import { COMP_NAV_CONFIG } from '../comp-nav.config';
import { CompShellIntegrationService } from '../comp-shell-integration.service';
import { StepBarComponent } from '../ui/step-bar.component';
import { MetadataSkeletonComponent } from '../ui/metadata-skeleton.component';
import { ErrorStateComponent } from '../ui/error-state.component';
import { MetadataFieldComponent } from './metadata-field.component';
import { IdiomaSelectComponent } from './idioma-select.component';
import { AdvanceBarComponent } from './advance-bar.component';
import { CoverDropZoneComponent } from './cover-drop-zone.component';

@Component({
  selector: 'comp-configuracoes',
  standalone: true,
  imports: [
    RouterLink,
    StepBarComponent,
    MetadataSkeletonComponent,
    ErrorStateComponent,
    MetadataFieldComponent,
    IdiomaSelectComponent,
    AdvanceBarComponent,
    CoverDropZoneComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="px-8 py-8 max-w-[var(--content-max-width,960px)] mx-auto">

      <!-- Breadcrumb navigation (FE-COMP-023) — {nome} resolved from projetoId -->
      @if (breadcrumbs().length) {
        <nav class="flex items-center gap-1 text-xs mb-4" aria-label="Localização">
          @for (crumb of breadcrumbs(); track $index) {
            @if (!$last) {
              <span style="color:var(--text-tertiary);">{{ crumb }}</span>
              <span class="material-symbols-outlined select-none"
                    style="font-size:12px;color:var(--text-tertiary);"
                    aria-hidden="true">chevron_right</span>
            } @else {
              <span style="color:var(--text-primary);font-weight:500;">{{ crumb }}</span>
            }
          }
        </nav>
      }

      <!-- Pipeline step bar -->
      <div class="mb-10">
        <comp-step-bar [steps]="navSteps" [current]="'configurar'" />
      </div>

      <!-- Loading skeleton (P8 — FE-COMP-024) -->
      @if (facade.status() === 'loading') {
        <comp-metadata-skeleton />
      }

      <!-- Error state (P8 — FE-COMP-024) -->
      @if (facade.status() === 'error' && facade.error()) {
        <comp-error-state
          [message]="facade.error()!.message"
          [correlationId]="facade.error()!.correlationId"
          (retry)="facade.onRetry()"
        />
      }

      <!-- Ready / Saving form -->
      @if (facade.status() === 'ready' || facade.status() === 'saving') {
        <div class="mb-8" style="border-left:4px solid var(--color-brand);padding-left:14px;">
          <h1 class="font-display font-semibold text-2xl" style="color:var(--text-primary)">
            Metadados do livro
          </h1>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">

          <!-- Título -->
          <div class="sm:col-span-2">
            <comp-metadata-field
              label="Título"
              [value]="facade.form().titulo"
              [required]="true"
              [error]="facade.fieldErrors()['titulo']"
              placeholder="Título do livro"
              (valueChange)="onFieldChange('titulo', $event)"
            />
          </div>

          <!-- Autor -->
          <comp-metadata-field
            label="Autor"
            [value]="facade.form().autor"
            [required]="true"
            [error]="facade.fieldErrors()['autor']"
            placeholder="Nome do autor"
            (valueChange)="onFieldChange('autor', $event)"
          />

          <!-- ISBN -->
          <comp-metadata-field
            label="ISBN"
            [value]="facade.form().isbn ?? ''"
            placeholder="978-65-..."
            (valueChange)="onFieldChange('isbn', $event || null)"
          />

          <!-- Idioma -->
          <comp-idioma-select
            [value]="facade.form().idioma"
            (idiomaChange)="onFieldChange('idioma', $event)"
          />

          <!-- Categoria -->
          <comp-metadata-field
            label="Categoria"
            [value]="facade.form().categoria ?? ''"
            placeholder="ex.: Romance contemporâneo"
            (valueChange)="onFieldChange('categoria', $event || null)"
          />

          <!-- Capa (cover drop zone) -->
          <div class="sm:col-span-2">
            <label class="block text-sm font-medium mb-1.5" style="color:var(--text-primary)">
              Capa do livro
            </label>
            <comp-cover-drop-zone
              [capaUrl]="facade.cover().capaUrl ?? facade.cover().objectUrl"
              [uploading]="facade.cover().status === 'uploading'"
              [error]="facade.cover().error"
              [canEdit]="true"
              (fileSelected)="facade.onCoverSelect($event)"
              (remove)="facade.onCoverRemove()"
            />
          </div>

        </div>

        <!-- Validation error (global) -->
        @if (tentouSubmit() && !facade.canAdvance()) {
          <p class="mt-4 text-sm flex items-center gap-1" style="color:var(--color-error)" role="alert">
            <span class="material-symbols-outlined" style="font-size:16px;" aria-hidden="true">error</span>
            Preencha os campos obrigatórios: Título, Autor e Idioma.
          </p>
        }

        <!-- Toast error -->
        @if (facade.toast()) {
          <p class="mt-4 text-sm flex items-center gap-1" style="color:var(--color-error)" role="alert">
            <span class="material-symbols-outlined" style="font-size:16px;" aria-hidden="true">error</span>
            {{ facade.toast() }}
          </p>
        }

        <!-- Advance / Back bar -->
        <comp-advance-bar
          [canAdvance]="facade.canAdvance()"
          [saving]="facade.status() === 'saving'"
          (advance)="avancar()"
        >
          <a
            [routerLink]="['/imp', 'projetos', projetoId, 'importar']"
            class="text-sm flex items-center gap-1"
            style="color:var(--text-secondary);"
          >
            <span class="material-symbols-outlined" style="font-size:16px;" aria-hidden="true">arrow_back</span>
            Voltar
          </a>
        </comp-advance-bar>
      }

    </div>
  `,
})
export class ConfiguracoesComponent implements OnInit {
  readonly facade = inject(MetadadosFacade);
  private readonly route = inject(ActivatedRoute);
  private readonly shellIntegration = inject(CompShellIntegrationService);

  readonly navSteps = COMP_NAV_CONFIG.stepBar;

  /**
   * Resolved breadcrumbs for T05: ['Projetos', '<projetoId>', 'Configurar'].
   * Updated by setActiveProject() in ngOnInit — empty before first navigation.
   * FE-COMP-023 / SPEC-06 §2.
   */
  readonly breadcrumbs = computed(
    () => this.shellIntegration.resolvedBreadcrumbs()['configurar'],
  );

  projetoId    = '';
  tentouSubmit = signal(false);

  ngOnInit(): void {
    this.projetoId = this.route.snapshot.paramMap.get('projetoId') ?? '';
    // FE-COMP-023: resolve {nome} in breadcrumbs before loading data.
    this.shellIntegration.setActiveProject(this.projetoId);
    // FE-COMP-025: telemetry — user entered T05 Configurações screen.
    this.shellIntegration.trackMetadataOpened(this.projetoId);
    this.facade.load(this.projetoId);
  }

  onFieldChange<K extends keyof MetadadosDto>(field: K, value: MetadadosDto[K]): void {
    this.facade.onFieldChange(field, value);
  }

  onIdiomaChange(value: MetadadosIdioma): void {
    this.facade.onFieldChange('idioma', value);
  }

  avancar(): void {
    this.tentouSubmit.set(true);
    if (!this.facade.canAdvance()) return;
    this.facade.onAdvanceToLayout();
  }
}
