/**
 * Public API barrel for @cordele/proj.
 * Only export what other libs/apps may consume.
 * Track D: created by fe-architect-promote PROJ @ cordele (D-494).
 */

// Routes — consumed by app.routes.ts loadChildren
export { PROJ_ROUTES } from './lib/proj.routes';

// Facades — consumed by shell/host integrations if needed
export { LibraryFacade } from './lib/library.facade';
export { HistoryFacade } from './lib/history.facade';

// Providers factory — app.config.ts registers provideProj()
export { provideProj } from './lib/proj.providers';
export type { ProjFeatureConfig } from './lib/proj.providers';

// API service (P2 — standardised HTTP client for proj-service)
export { ProjetoApiService } from './lib/api/projeto-api.service';

// Port tokens — for testing overrides
export { PROJETO_PORT } from './lib/api/projeto.port';
export { PUBLICACAO_PORT } from './lib/api/publicacao.port';

// Models — consumed by integration tests and E2E
export type {
  ProjetoCard,
  ProjetoCardVM,
  ProjetoDetail,
  PublicacaoHistoryItem,
  SignedDownloadUrl,
  CriarProjetoRequest,
  StatusBadgeVM,
  BadgeTone,
  ProjetoStatus,
  EpubcheckStatus,
  ManuscriptSummary,
} from './lib/models/proj.models';

// View-model types from facades
export type { LibraryStatus } from './lib/library.facade';
export type { HistoryStatus, ProjectHeaderVM, PublicacaoRowVM } from './lib/history.facade';
