/**
 * Public API barrel for @cordele/pub-data-access.
 * P2 — FE-PUB-007..011
 *
 * Only export what other libs/apps may consume.
 * HTTP adapter is intentionally NOT exported (internal implementation detail).
 */

// Models — consumed by integration tests, E2E and feature libs
export type {
  BuildStatus,
  EpubcheckStatus,
  ExportPhase,
  PublicacaoStatus,
  PublicacaoHistoryItem,
  PublicationStats,
  SignedDownloadUrl,
  ProjetoHeaderInfo,
} from './lib/models/pub.models';

// Port token — for testing overrides in pub-feature-export / pub-feature-history specs
export { PUBLICACAO_PORT } from './lib/api/publicacao.port';
export type { PublicacaoPort } from './lib/api/publicacao.port';

// Mock adapter — for testing only; NOT the default in production
export { PublicacaoMockAdapter } from './lib/api/publicacao-mock.adapter';

// Services
export { PublicacaoApiService } from './lib/publicacao-api.service';
export { ArtifactDownloadService } from './lib/artifact-download.service';
export type { DownloadResult } from './lib/artifact-download.service';

// Facades — consumed by feature libs (T07 / T08 components)
export { ExportFacade } from './lib/export.facade';
export { HistoryFacade } from './lib/history.facade';
export type { HistoryStatus } from './lib/history.facade';

// Providers factory — app.config.ts registers providePub({ adapter: 'http' })
export { providePub } from './lib/pub.providers';
export type { PubFeatureConfig } from './lib/pub.providers';

// Error mapping — consumed by feature components for user-facing messages
export { PUB_ERROR_MAP, PUB_FALLBACK_ERROR, resolvePubError } from './lib/error-mapping';
export type { PubErrorMapping } from './lib/error-mapping';

// Empresa changed token — override to wire PubShellIntegrationService.empresaChanged (INT-FE-PUB-006)
export { PUB_EMPRESA_CHANGED } from './lib/empresa-changed.token';

// Module metadata — consumed by cordele-web/module-descriptors.ts (non-lazy import)
// Avoids static import of lazy @cordele/pub-shell-entry (lint: enforce-module-boundaries).
export {
  PUB_MODULE_KEY,
  PUB_MENU_METADATA_STATIC,
  PUB_PERMISSION_MAP_STATIC,
  PUB_FEATURE_FLAGS_STATIC,
} from './lib/pub.module-metadata';
