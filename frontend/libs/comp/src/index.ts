/**
 * Public API barrel for @cordele/comp.
 * Only export what other libs/apps may consume.
 * Track D: created by fe-architect-promote COMP @ cordele (D-494).
 * Updated: FE-COMP-001..005 (P1 Foundation).
 * Updated: FE-COMP-006..010 (P2 Data access).
 */

// Routes — consumed by app.routes.ts loadChildren
export { COMP_ROUTES } from './lib/comp.routes';

// Contract — module constants (FE-COMP-001)
export { MODULE_KEY, COMP_MENU_METADATA, COMP_PERMISSION_MAP, COMP_FEATURE_FLAGS } from './lib/comp.contract';
export type {
  ModuleMenuMetadata,
  ModulePermissionMap,
  ModulePermissionEntry,
  ModuleFeatureFlags,
  ModuleFeatureFlagEntry,
  ModuleDescriptor,
} from './lib/comp.contract';

// Module descriptor — consumed by module-descriptors.ts (FE-COMP-003/005)
export { COMP_MODULE_DESCRIPTOR } from './lib/comp.contract';

// Bootstrap lifecycle — consumed by shell (FE-COMP-003)
export { compInit, compDestroy } from './lib/comp.bootstrap';

// Nav config — consumed by integration service and tests (FE-COMP-004, FE-COMP-023)
export { COMP_NAV_CONFIG, resolveNavBreadcrumbs } from './lib/comp-nav.config';
export type { ModuleNavConfig, NavStep, BreadcrumbTemplate, CompNavScreen } from './lib/comp-nav.config';

// Shell integration service — consumed by shell and tests (FE-COMP-004)
export { CompShellIntegrationService } from './lib/comp-shell-integration.service';

// Facades — consumed by feature components (P3) (FE-COMP-008, FE-COMP-009)
export { MetadadosFacade } from './lib/metadados.facade';
export type { MetadadosStatus, CoverState } from './lib/metadados.facade';

export { LayoutFacade } from './lib/layout.facade';
export type { LayoutStatus } from './lib/layout.facade';
export { LAYOUT_LIMITS } from './lib/layout.facade';

// Error mapper — consumed by facades and feature components (FE-COMP-010)
export { mapCompError, normalizeError, COMP_URNS } from './lib/comp-error.mapper';
export type { CompUiError, CompUiErrorChannel } from './lib/comp-error.mapper';

// Providers factory — app.config.ts registers provideComp()
export { provideComp } from './lib/comp.providers';
export type { CompFeatureConfig } from './lib/comp.providers';

// Port tokens — for testing overrides
export { METADADOS_PORT } from './lib/api/metadados.port';
export { LAYOUT_PORT } from './lib/api/layout.port';

// Feature components — P3 (FE-COMP-011..018)
// Shared UI
export { StepBarComponent } from './lib/ui/step-bar.component';
export type { StepDef } from './lib/ui/step-bar.component';

// T05 feature-configuracoes presentational components
export { ConfiguracoesComponent } from './lib/feature-configuracoes/configuracoes.component';
export { MetadataFieldComponent } from './lib/feature-configuracoes/metadata-field.component';
export { IdiomaSelectComponent } from './lib/feature-configuracoes/idioma-select.component';
export { AdvanceBarComponent } from './lib/feature-configuracoes/advance-bar.component';
export { CoverDropZoneComponent } from './lib/feature-configuracoes/cover-drop-zone.component';

// Shared UI components (P8 — FE-COMP-024)
export { MetadataSkeletonComponent } from './lib/ui/metadata-skeleton.component';
export { PreviewSkeletonComponent } from './lib/ui/preview-skeleton.component';
export { PreviewEmptyComponent } from './lib/ui/preview-empty.component';
export { ErrorStateComponent } from './lib/ui/error-state.component';

// T06 feature-editor presentational components
export { EditorDeLayoutPreviewComponent } from './lib/feature-editor/editor-de-layout-preview.component';
export { StylePanelComponent } from './lib/feature-editor/style-panel.component';
export type { StyleChangeEvent } from './lib/feature-editor/style-panel.component';
export { PreviewCanvasComponent } from './lib/feature-editor/preview-canvas.component';
export { PagePaginatorComponent } from './lib/feature-editor/page-paginator.component';
export { ImageAlignmentBadgeComponent } from './lib/feature-editor/image-alignment-badge.component';
export { ExportBarComponent } from './lib/feature-editor/export-bar.component';

// Models — consumed by integration tests, E2E, and cross-module contracts
export type {
  MetadadosDto,
  MetadadosIdioma,
  ConfiguracaoLayoutDto,
  FonteCorpoFamilia,
  Alinhamento,
  LayoutOverride,
  PreviewContextDto,
  PreviewNode,
  CapaUploadResponse,
  UpsertMetadadosDto,
  UpsertLayoutBody,
} from './lib/models/comp.models';
