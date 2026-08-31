/**
 * Dependency-injection token constants for the PROJ bounded context.
 *
 * All provider tokens are declared here so that proj.module.ts and any future
 * modules/ consumer can import tokens without ever touching src/infrastructure/
 * directly (RULE-04 compliance). The repository token re-exports the canonical
 * Symbol from domain so callers have a single import point.
 *
 * Use-case tokens (P2) and the empresa context token (P5) are pre-declared here
 * to make the wiring plan explicit from P1 onward.
 */

// --- Outbound port tokens ---

/**
 * Injection token for the ProjetoEditorialRepository outbound port.
 * Used by P2 use cases (PROJ-003..005). Real Prisma adapter bound in P3 (PROJ-008).
 */
export { ProjetoEditorialRepository as PROJETO_EDITORIAL_REPOSITORY } from '../../domain/proj/projeto-editorial.repository';

// --- Empresa context token (wired in P5) ---

/**
 * Injection token for the EmpresaContext accessor.
 *
 * Declared here in P1 so the module file stays stable when P5 binds the real
 * AsyncLocalStorage implementation. Nothing in P1 injects this; the token is
 * a forward declaration.
 */
export const EMPRESA_CONTEXT_TOKEN = Symbol('EmpresaContext');

// --- Use-case tokens ---

/**
 * Injection token for the CreateProjetoUseCase inbound port.
 * Real provider registered in P2 (PROJ-003).
 */
export const CREATE_PROJETO_USE_CASE = Symbol('CreateProjetoUseCase');

/**
 * Injection token for the AdvanceProjetoStatusUseCase inbound port.
 * Real provider registered in P2 (PROJ-004).
 */
export const ADVANCE_PROJETO_STATUS_USE_CASE = Symbol('AdvanceProjetoStatusUseCase');

/**
 * Injection token for the ReopenProjectUseCase inbound port.
 * Real provider registered in P2 (PROJ-005).
 */
export const REOPEN_PROJECT_USE_CASE = Symbol('ReopenProjectUseCase');

/**
 * Injection token for the GetProjetoLibraryUseCase inbound port.
 * Real provider registered in P4 (PROJ-010).
 */
export const GET_PROJETO_LIBRARY_USE_CASE = Symbol('GetProjetoLibraryUseCase');

/**
 * Injection token for the GetProjetoDetailUseCase inbound port.
 * Real provider registered in P4 (PROJ-011).
 */
export const GET_PROJETO_DETAIL_USE_CASE = Symbol('GetProjetoDetailUseCase');

/**
 * Injection token for the GetPublicationHistoryUseCase inbound port.
 * Real provider registered in P4 (PROJ-012).
 */
export const GET_PUBLICATION_HISTORY_USE_CASE = Symbol('GetPublicationHistoryUseCase');

/**
 * Injection token for the GetSignedDownloadUrlUseCase inbound port.
 * Real provider registered in P4 (PROJ-013).
 */
export const GET_SIGNED_DOWNLOAD_URL_USE_CASE = Symbol('GetSignedDownloadUrlUseCase');

/**
 * Injection token for the DeleteProjetoUseCase inbound port.
 * Real provider registered in P6 (PROJ-016).
 */
export const DELETE_PROJETO_USE_CASE = Symbol('DeleteProjetoUseCase');

// --- Outbound read port tokens (wired in P4) ---
// Re-exported from the domain port files so that infrastructure/ can import
// the same Symbol from domain/ without depending on modules/ (RULE-05).

/**
 * Injection token for ManuscriptSummaryPort (IMP cross-context read).
 * Stub adapter registered in P4 (PROJ-009); real adapter in PROJ-INT-001.
 * Token is the Symbol exported by the domain port file (structural consistency).
 */
export { ManuscriptSummaryPort as MANUSCRIPT_SUMMARY_PORT } from '../../domain/proj/ports/outbound/manuscript-summary.port';

/**
 * Injection token for ProjectMetadataPort (COMP cross-context read).
 * Stub adapter registered in P4 (PROJ-009); real adapter in PROJ-INT-002.
 */
export { ProjectMetadataPort as PROJECT_METADATA_PORT } from '../../domain/proj/ports/outbound/project-metadata.port';

/**
 * Injection token for PublicationHistoryPort (PUB cross-context read).
 * Stub adapter registered in P4 (PROJ-009); real adapter in PROJ-INT-003.
 */
export { PublicationHistoryPort as PUBLICATION_HISTORY_PORT } from '../../domain/proj/ports/outbound/publication-history.port';

// --- Infrastructure port tokens (P2) ---

/**
 * Injection token for the project event publisher.
 * P2 stub: useValue no-op. Real binding (EventEmitter2) can be added in P4/P5.
 */
export const PROJECT_EVENT_PUBLISHER = Symbol('ProjectEventPublisher');

/**
 * Injection token for the ProjetoEditorialLookup inbound port.
 * Real provider (ProjetoEditorialLookupAdapter) registered in P2 (PROJ-006).
 */
export const PROJETO_EDITORIAL_LOOKUP = Symbol('ProjetoEditorialLookup');

// --- Outbound erasure port tokens (wired in P6) ---
// Re-exported from the domain port files so that infrastructure/ (the global
// ErasurePortsModule) and modules/ share the same Symbol (structural
// consistency with the P4 read-port tokens above).

/**
 * Injection token for PublicationErasurePort (PUB LGPD purge).
 * Stub adapter registered in P6 (PROJ-015); real adapter in PROJ-INT-006.
 */
export { PublicationErasurePort as PUBLICATION_ERASURE_PORT } from '../../domain/proj/ports/outbound/publication-erasure.port';

/**
 * Injection token for CompositionErasurePort (COMP LGPD purge).
 * Stub adapter registered in P6 (PROJ-015); real adapter in PROJ-INT-005.
 */
export { CompositionErasurePort as COMPOSITION_ERASURE_PORT } from '../../domain/proj/ports/outbound/composition-erasure.port';

/**
 * Injection token for ManuscriptErasurePort (IMP LGPD purge).
 * Stub adapter registered in P6 (PROJ-015); real adapter in PROJ-INT-004.
 */
export { ManuscriptErasurePort as MANUSCRIPT_ERASURE_PORT } from '../../domain/proj/ports/outbound/manuscript-erasure.port';
