/**
 * Dependency-injection token constants for the PUB (Publicação) bounded
 * context.
 *
 * Forward-declared in P1 so later priorities (P2 use cases, P6 exported
 * ports) can bind real providers without reshaping this file — mirrors the
 * proj-service convention (proj.tokens.ts).
 */

// --- Outbound port tokens (declared in P2 — PUB-003/004) ---
// Re-exported from the port files so infrastructure/ (P3/P4/P6 adapters) can
// import the same Symbol without depending on modules/ internals directly.

/** Injection token for PublicacaoRepositoryPort. Real Prisma adapter bound in P3 (PUB-008). */
export { PublicacaoRepositoryPort as PUBLICACAO_REPOSITORY_PORT } from './ports/publicacao-repository.port';

/** Injection token for ManuscriptContentPort (IMP). Stub adapter in P4 (PUB-012); real in P6 (INT-PUB-001). */
export { ManuscriptContentPort as MANUSCRIPT_CONTENT_PORT } from './ports/manuscript-content.port';

/** Injection token for CompositionMetadataPort (COMP). Stub adapter in P4 (PUB-012); real in P6 (INT-PUB-002). */
export { CompositionMetadataPort as COMPOSITION_METADATA_PORT } from './ports/composition-metadata.port';

/** Injection token for CompositionLayoutPort (COMP). Stub adapter in P4 (PUB-012); real in P6 (INT-PUB-002). */
export { CompositionLayoutPort as COMPOSITION_LAYOUT_PORT } from './ports/composition-layout.port';

/** Injection token for AdvanceProjetoStatusPort (PROJ). Stub adapter in P4 (PUB-012); real in P6 (INT-PUB-003). */
export { AdvanceProjetoStatusPort as ADVANCE_PROJETO_STATUS_PORT } from './ports/advance-projeto-status.port';

/** Injection token for EpubValidationPort (epubcheck). Real adapter bound in P4 (PUB-010). */
export { EpubValidationPort as EPUB_VALIDATION_PORT } from './ports/epub-validation.port';

/** Injection token for FileStoragePort (disk/S3). Real adapter bound in P4 (PUB-011). */
export { FileStoragePort as FILE_STORAGE_PORT } from './ports/file-storage.port';

// --- Use-case tokens (bound in P2 — PUB-003..006) ---

/** Injection token for GeneratePublicationUseCase. Real provider in P2 (PUB-003). */
export const GENERATE_PUBLICATION_USE_CASE = Symbol('GeneratePublicationUseCase');

/** Injection token for GetPublicationStatusUseCase. Real provider in P2 (PUB-005). */
export const GET_PUBLICATION_STATUS_USE_CASE = Symbol('GetPublicationStatusUseCase');

/** Injection token for GetPublicationHistoryUseCase. Real provider in P2 (PUB-005). */
export const GET_PUBLICATION_HISTORY_USE_CASE = Symbol('GetPublicationHistoryUseCase');

/** Injection token for GetSignedDownloadUrlUseCase. Real provider in P2 (PUB-005). */
export const GET_SIGNED_DOWNLOAD_URL_USE_CASE = Symbol('GetSignedDownloadUrlUseCase');

/** Injection token for GetPublicationStatsUseCase. Real provider in P2 (PUB-006). */
export const GET_PUBLICATION_STATS_USE_CASE = Symbol('GetPublicationStatsUseCase');

// --- Ports exported to PROJ (bound in P6 — PUB-014/015) ---

/** Injection token for PublicationHistoryPort, injected by ProjModule (P6). */
export const PUBLICATION_HISTORY_PORT = Symbol('PublicationHistoryPort');

/** Injection token for PublicationErasurePort, injected by ProjModule (P6). */
export const PUBLICATION_ERASURE_PORT = Symbol('PublicationErasurePort');

/** Injection token for ValidationMessageRepositoryPort. Real Prisma adapter bound in PUB-016. */
export { ValidationMessageRepositoryPort as VALIDATION_MESSAGE_REPOSITORY_PORT } from '../../domain/pub/ports/validation-message-repository.port';

/** Injection token for ListValidationMessagesUseCase. Real provider in PUB-016. */
export const LIST_VALIDATION_MESSAGES_USE_CASE = Symbol('ListValidationMessagesUseCase');

// --- Cross-cutting ports (P5 — INT-PUB-006) ---

/**
 * Injection token for EmpresaContextRunnerPort.
 *
 * Bound to `EmpresaContextService` (infrastructure/auth) in `AppModule` via
 * `useExisting`. This indirection keeps modules/ free of infrastructure/
 * imports (RULE-04) while letting `GeneratePublicationUseCase` wrap the async
 * `PublicationBuildJob.run` call inside the correct `AsyncLocalStorage` context
 * (INT-PUB-006).
 */
export const EMPRESA_CONTEXT_RUNNER_PORT = Symbol('EmpresaContextRunnerPort');
