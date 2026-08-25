/**
 * Public API barrel for @cordele/pub.
 * Only export what other libs/apps may consume.
 * Track D: created by fe-architect-promote PUB @ cordele (D-494).
 */

// Routes — consumed by app.routes.ts loadChildren
export { PUB_ROUTES } from './lib/pub.routes';

// Facades — consumed by shell/host integrations if needed
export { ExportFacade } from './lib/export.facade';
export { HistoryFacade } from './lib/history.facade';

// Providers factory — app.config.ts registers providePub()
export { providePub } from './lib/pub.providers';
export type { PubFeatureConfig } from './lib/pub.providers';

// Port tokens — for testing overrides
export { PUBLICACAO_PORT } from './lib/api/publicacao.port';

// Models — consumed by integration tests and E2E
export type {
  BuildStatus,
  EpubcheckStatus,
  ExportPhase,
  PublicacaoStatus,
  PublicacaoHistoryItem,
  PublicationStats,
  SignedDownloadUrl,
} from './lib/models/pub.models';

// View-model status types from facades
export type { HistoryStatus } from './lib/history.facade';
