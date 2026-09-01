/**
 * Public API barrel for @cordele/imp/data-access.
 * Only export what other libs/apps may consume.
 */

// Facades
export { ImportFacade } from './lib/import.facade';
export { ReviewFacade } from './lib/review.facade';
export type { UploadPhase } from './lib/import.facade';

// HTTP client (for testing overrides and advanced wiring)
export { ImpHttpClient } from './lib/imp-http-client';

// Providers factory
export { provideImp } from './lib/imp.providers';
export type { ImpFeatureConfig } from './lib/imp.providers';

// Port tokens — for testing overrides
export { MANUSCRITO_PORT } from './lib/ports/manuscrito.port';
export { SEGMENTO_CURADORIA_PORT } from './lib/ports/segmento-curadoria.port';

// Models — consumed by integration tests and E2E
export type {
  ManuscritoDetail,
  ManuscritoSummary,
  ContentTree,
  Chapter,
  Section,
  Block,
  ParagraphBlock,
  ImageBlock,
  UnparsedBlock,
  UnparsedReason,
  UploadParams,
  SegmentoCuradoriaDto,
  IgnoredSegmentsResponse,
  // P2 additions
  ManuscritoHistoryDto,
  ConfirmResponseDto,
  FragmentIgnoreDto,
} from './lib/models/imp.models';

export { UNPARSED_REASON_LABEL } from './lib/models/imp.models';

// Error mapper (FE-IMP-021)
export { mapImpError } from './lib/error/imp-error.mapper';
export type { ImpErrorResult, ImpErrorChannel } from './lib/error/imp-error.mapper';
export { IMP_KNOWN_URNS } from './lib/error/imp-error.mapper';

// Module metadata — consumed by cordele-web/module-descriptors.ts (non-lazy import)
// Avoids static import of lazy @cordele/imp/shell-entry (lint: enforce-module-boundaries).
export {
  IMP_MODULE_KEY,
  IMP_MENU_METADATA,
  IMP_PERMISSION_MAP_METADATA,
  IMP_FEATURE_FLAGS_METADATA,
} from './lib/imp.module-metadata';
