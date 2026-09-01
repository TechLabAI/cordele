/**
 * Public API barrel for @cordele/imp (legacy monolithic project).
 * Re-exports from the new sublibs — consumers should migrate to @cordele/imp/<sublib> directly.
 * This barrel is preserved for backwards-compatibility during the P1→P3 migration window.
 */

// Facades — consumed by shell/host integrations if needed
export { ImportFacade, ReviewFacade, provideImp } from '@cordele/imp/data-access';
export type { ImpFeatureConfig } from '@cordele/imp/data-access';

// Port tokens — for testing overrides
export { MANUSCRITO_PORT, SEGMENTO_CURADORIA_PORT } from '@cordele/imp/data-access';

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
} from '@cordele/imp/data-access';
