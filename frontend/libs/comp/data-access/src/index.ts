/**
 * Public API barrel for @cordele/comp/data-access.
 * Non-lazy entry point for the COMP module — statically importable from apps.
 *
 * P6 (INT-FE-COMP-006): extracted from @cordele/comp (lazy barrel) to eliminate
 * @nx/enforce-module-boundaries "Static imports of lazy-loaded libraries" violations.
 *
 * What to import from here vs @cordele/comp:
 *   @cordele/comp/data-access → provideComp, ports, models, constants (DI setup, static init)
 *   @cordele/comp             → COMP_ROUTES (via loadChildren only — dynamic import)
 *
 * Track D: created by fe-architect-promote COMP @ cordele (D-494) / P6.
 */

// Providers factory — consumed by app.config.ts
export { provideComp } from './lib/comp.providers';
export type { CompFeatureConfig } from './lib/comp.providers';

// Port tokens — for testing overrides and facade injection
export { METADADOS_PORT } from './lib/api/metadados.port';
export type { MetadadosPort } from './lib/api/metadados.port';
export { LAYOUT_PORT } from './lib/api/layout.port';
export type { LayoutPort } from './lib/api/layout.port';

// Adapters — exported for test overrides; consumed internally by provideComp
export { MetadadosHttpAdapter } from './lib/api/metadados-http.adapter';
export { MetadadosMockAdapter } from './lib/api/metadados-mock.adapter';
export { LayoutHttpAdapter } from './lib/api/layout-http.adapter';
export { LayoutMockAdapter } from './lib/api/layout-mock.adapter';

// Models — consumed by facades, components, integration tests, E2E
export type {
  MetadadosDto,
  MetadadosIdioma,
  ConfiguracaoLayoutDto,
  FonteCorpoFamilia,
  Alinhamento,
  LayoutOverride,
  UpsertLayoutBody,
  PreviewContextDto,
  PreviewNode,
  UpsertMetadadosDto,
  CapaUploadResponse,
} from './lib/models/comp.models';

// Module constants — consumed by module-descriptors.ts (assembles descriptor inline)
export {
  MODULE_KEY,
  COMP_MENU_METADATA,
  COMP_PERMISSION_MAP,
  COMP_FEATURE_FLAGS,
} from './lib/comp.constants';
export type {
  ModuleMenuMetadata,
  ModulePermissionEntry,
  ModulePermissionMap,
  ModuleFeatureFlagEntry,
  ModuleFeatureFlags,
  ModuleDescriptor,
} from './lib/comp.constants';

// Observability stub — FE-COMP-025 (P9)
// TODO: remove stub once @cordele/shared/observability ships ObservabilityService.
export { ObservabilityService, OBSERVABILITY_IS_MOCK } from './lib/observability.stub';
export type { ObservabilityEvent } from './lib/observability.stub';
