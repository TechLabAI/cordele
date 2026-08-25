/**
 * Public API barrel for @cordele/comp.
 * Only export what other libs/apps may consume.
 * Track D: created by fe-architect-promote COMP @ cordele (D-494).
 */

// Routes — consumed by app.routes.ts loadChildren
export { COMP_ROUTES } from './lib/comp.routes';

// Facades — consumed by shell/host integrations if needed
export { MetadadosFacade } from './lib/metadados.facade';
export { LayoutFacade } from './lib/layout.facade';

// Providers factory — app.config.ts registers provideComp()
export { provideComp } from './lib/comp.providers';
export type { CompFeatureConfig } from './lib/comp.providers';

// Port tokens — for testing overrides
export { METADADOS_PORT } from './lib/api/metadados.port';
export { LAYOUT_PORT } from './lib/api/layout.port';

// Models — consumed by integration tests and E2E
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
} from './lib/models/comp.models';

// Status types from facades
export type { MetadadosStatus } from './lib/metadados.facade';
export type { LayoutStatus } from './lib/layout.facade';
