/**
 * Public API barrel for @cordele/imp.
 * Only export what other libs/apps may consume.
 */

// Routes — consumed by app.routes.ts loadChildren
export { IMP_ROUTES } from './lib/imp.routes';

// Facades — consumed by shell/host integrations if needed
export { ImportFacade } from './lib/import.facade';
export { ReviewFacade } from './lib/review.facade';

// Providers factory — app.config.ts registers provideImp()
export { provideImp } from './lib/imp.providers';
export type { ImpFeatureConfig } from './lib/imp.providers';

// Port tokens — for testing overrides
export { MANUSCRITO_PORT } from './lib/api/manuscrito.port';
export { SEGMENTO_CURADORIA_PORT } from './lib/api/segmento-curadoria.port';

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
} from './lib/models/imp.models';
