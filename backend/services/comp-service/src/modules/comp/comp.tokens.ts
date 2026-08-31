/**
 * Dependency-injection token constants for the COMP bounded context.
 *
 * All provider tokens are declared here so that comp.module.ts and any future
 * modules/ consumer can import tokens without ever touching src/infrastructure/
 * directly (RULE-04 compliance).
 *
 * Use-case tokens (P2) are pre-declared here to make the wiring plan explicit
 * from P1 onward. Repository and port tokens are forward-declared to stabilise
 * comp.module.ts across priorities.
 *
 * Prefix: COMP_ (all symbols).
 */

// --- Repository port tokens (wired in P3) ---

/**
 * Injection token for the MetadadosRepository outbound port.
 * Real Prisma adapter bound in P3 (COMP-009).
 */
export const COMP_METADADOS_REPO = Symbol('CompMetadadosRepository');

/**
 * Injection token for the ConfiguracaoLayoutRepository outbound port.
 * Real Prisma adapter bound in P3 (COMP-010).
 */
export const COMP_LAYOUT_REPO = Symbol('CompConfiguracaoLayoutRepository');

// --- External service port tokens (wired in P4) ---

/**
 * Injection token for the ManuscriptContentPort outbound port.
 * Stub adapter registered in P4 (COMP-014); real cross-context adapter in INT-COMP-001.
 */
export const COMP_MANUSCRIPT_CONTENT_PORT = Symbol('CompManuscriptContentPort');

/**
 * Injection token for the FileStoragePort outbound port.
 * Disk-based adapter registered in P4 (COMP-015); cloud adapter post-POC.
 */
export const COMP_FILE_STORAGE_PORT = Symbol('CompFileStoragePort');

// --- Use-case tokens (wired in P2) ---

/**
 * Injection token for the GetMetadadosUseCase inbound port.
 * Real provider registered in P2 (COMP-003).
 */
export const COMP_GET_METADADOS_UC = Symbol('CompGetMetadadosUseCase');

/**
 * Injection token for the UpdateMetadadosUseCase inbound port.
 * Real provider registered in P2 (COMP-004).
 */
export const COMP_UPDATE_METADADOS_UC = Symbol('CompUpdateMetadadosUseCase');

/**
 * Injection token for the UploadCapaUseCase inbound port.
 * Real provider registered in P2 (COMP-005).
 */
export const COMP_UPLOAD_CAPA_UC = Symbol('CompUploadCapaUseCase');

/**
 * Injection token for the RemoveCapaUseCase inbound port.
 * Real provider registered in P2 (COMP-006).
 */
export const COMP_REMOVE_CAPA_UC = Symbol('CompRemoveCapaUseCase');

/**
 * Injection token for the GetLayoutUseCase inbound port.
 * Real provider registered in P2 (COMP-007).
 */
export const COMP_GET_LAYOUT_UC = Symbol('CompGetLayoutUseCase');

/**
 * Injection token for the UpdateLayoutUseCase inbound port.
 * Real provider registered in P2 (COMP-008).
 */
export const COMP_UPDATE_LAYOUT_UC = Symbol('CompUpdateLayoutUseCase');

/**
 * Injection token for the GetPreviewContextUseCase inbound port.
 * Real provider registered in P2 (COMP-008).
 */
export const COMP_GET_PREVIEW_CONTEXT_UC = Symbol('CompGetPreviewContextUseCase');

// --- Export use-case tokens for PUB in-process integration (COMP-016) ---

/**
 * Injection token for the GetMetadadosExportUseCase.
 *
 * Provides `get(projetoId: string): Promise<MetadadosRead | null>` for in-process
 * consumption by PUB at ePub assembly time. Returns `null` when no row has been
 * materialized yet for the given project.
 *
 * Exported in CompModule.exports (COMP-016).
 */
export const COMP_GET_METADADOS_EXPORT_UC = Symbol('CompGetMetadadosExportUseCase');

/**
 * Injection token for the GetConfiguracaoLayoutExportUseCase.
 *
 * Provides `get(projetoId: string): Promise<LayoutRead | null>` for in-process
 * consumption by PUB at ePub assembly time. Filters stale overrides via
 * ManuscriptContentPort. Returns `null` when no row has been materialized.
 *
 * Exported in CompModule.exports (COMP-016).
 */
export const COMP_GET_LAYOUT_EXPORT_UC = Symbol('CompGetConfiguracaoLayoutExportUseCase');

// --- Exported inbound port tokens for PUB and PROJ (wired in P6) ---

/**
 * Injection token for the ProjectMetadataPort batch adapter.
 *
 * Provides `metadata(projetoIds: string[]): Promise<Map<string, MetadadosDto>>`
 * for in-process consumption by PUB (ePub assembly) and PROJ (author lookup).
 * Bound to ProjectMetadataUseCase in CompModule (COMP-017).
 *
 * Exported in CompModule.exports (COMP-016 / P6).
 */
export const COMP_PROJECT_METADATA_PORT = Symbol('CompProjectMetadataPort');

/**
 * Injection token for the CompositionErasurePort adapter.
 *
 * Provides `purge(projetoId: string): Promise<void>` for in-process LGPD erasure
 * by PROJ. Idempotent — safe to call multiple times for the same project.
 * Bound to CompositionErasureUseCase in CompModule (COMP-017).
 *
 * Exported in CompModule.exports (COMP-017 / P6).
 */
export const COMP_COMPOSITION_ERASURE_PORT = Symbol('CompCompositionErasurePort');

// --- In-process metrics service (COMP-019) ---

/**
 * Injection token for the CompMetricsService.
 *
 * Bound to `CompMetricsService` in `AppModule` (composition root).
 * Use cases inject this token via `@Inject(COMP_METRICS_SERVICE)` so that
 * `modules/` never imports `infrastructure/` directly (RULE-04).
 *
 * The injected type must satisfy: `{ increment(metric: string, labels?: Record<string, string>): void }`.
 */
export const COMP_METRICS_SERVICE = Symbol('CompMetricsService');

// --- In-process domain event emitter (pre-requisite for COMP-004/005/007) ---

/**
 * Injection token for the DomainEventEmitter outbound port.
 *
 * Bound to `InProcessEventEmitterAdapter` in `AppModule` (composition root).
 * messaging.enabled=false — events are dispatched in-process via Node's
 * `EventEmitter`; no broker integration is wired.
 *
 * Use cases inject this token to emit `MetadataUpdated` / `LayoutUpdated`
 * events without importing infrastructure directly (RULE-04).
 */
export const COMP_EVENT_EMITTER = Symbol('CompDomainEventEmitter');
