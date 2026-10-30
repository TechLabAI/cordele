/**
 * DI token constants that signal whether each outbound read port is operating
 * in stub mode (no real sibling service URL is configured).
 *
 * Defined in domain/ so that:
 *  - infrastructure/proj/read-ports.module.ts can provide these tokens
 *    (infrastructure → domain is allowed by RULE-05).
 *  - modules/proj/use-cases/*.ts can inject them
 *    (modules → domain is the standard direction).
 *
 * When `true`, the corresponding port resolved to its in-memory stub adapter
 * and the use case MUST pre-set degraded=true without waiting for a thrown
 * error (stubs return valid defaults, they never throw — SPEC-07 fix).
 *
 * RULE-01: no @nestjs/common imports — pure TS constants.
 * RULE-02: no @prisma/client imports.
 */

/** True when IMP_SERVICE_URL is absent and ManuscriptSummaryStub is active. */
export const MANUSCRIPT_SUMMARY_IS_STUB = 'MANUSCRIPT_SUMMARY_IS_STUB';

/** True when COMP_SERVICE_URL is absent and ProjectMetadataStub is active. */
export const PROJECT_METADATA_IS_STUB = 'PROJECT_METADATA_IS_STUB';

/** True when PUB_SERVICE_URL is absent and PublicationHistoryStub is active. */
export const PUBLICATION_HISTORY_IS_STUB = 'PUBLICATION_HISTORY_IS_STUB';
