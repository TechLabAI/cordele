/**
 * Public API barrel for @cordele/pub.
 * Only export what other libs/apps may consume.
 * Track D: created by fe-architect-promote PUB @ cordele (D-494).
 *
 * P1 update (FE-PUB-002): PUB_ROUTES removed from this barrel — migrated to
 * @cordele/pub-shell-entry. app.routes.ts now imports from @cordele/pub-shell-entry.
 *
 * P2 note (FE-PUB-007..011): canonical implementations of facades, port, models, providers
 * are now in @cordele/pub-data-access. The flat lib retains its own copies as backward-compat.
 * New consumers (feature libs from P3 onward) should import from @cordele/pub-data-access directly.
 *
 * P3 update (FE-PUB-012, FE-PUB-018): Smart components migrated to sub-libs:
 *   ExportacaoEValidacaoComponent → @cordele/pub-feature-export
 *   DownloadEHistoricoComponent   → @cordele/pub-feature-history
 * Component exports removed from this barrel — pub-shell-entry routes now use loadComponent
 * from the dedicated sub-libs.
 *
 * P5 update (FE-PUB-021, FE-PUB-022): Guards migrated to @cordele/pub-access (real implementation).
 * Stub guard exports removed from this barrel — pub-shell-entry already imports from @cordele/pub-access.
 */

// Facades — kept for backward compat (canonical: @cordele/pub-data-access from P2)
export { ExportFacade } from './lib/export.facade';
export { HistoryFacade } from './lib/history.facade';
export type { HistoryStatus } from './lib/history.facade';

// Providers factory — kept for backward compat (canonical: @cordele/pub-data-access from P2)
export { providePub } from './lib/pub.providers';
export type { PubFeatureConfig } from './lib/pub.providers';

// Port tokens — for testing overrides (canonical: @cordele/pub-data-access from P2)
export { PUBLICACAO_PORT } from './lib/api/publicacao.port';

// Models — kept for backward compat (canonical: @cordele/pub-data-access from P2)
export type {
  BuildStatus,
  EpubcheckStatus,
  ExportPhase,
  PublicacaoStatus,
  PublicacaoHistoryItem,
  PublicationStats,
  SignedDownloadUrl,
} from './lib/models/pub.models';
