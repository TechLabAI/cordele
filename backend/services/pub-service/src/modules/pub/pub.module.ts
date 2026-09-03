import { EventEmitter } from 'node:events';
import { Module } from '@nestjs/common';

import { PubController } from './pub.controller';
import { PublicationBuildJob } from './use-cases/publication-build.job';
import { GeneratePublicationUseCase } from './use-cases/generate-publication.use-case';
import { GetPublicationHistoryUseCase } from './use-cases/get-publication-history.use-case';
import { GetPublicationStatsUseCase } from './use-cases/get-publication-stats.use-case';
import { GetPublicationStatusUseCase } from './use-cases/get-publication-status.use-case';
import { GetSignedDownloadUrlUseCase } from './use-cases/get-signed-download-url.use-case';
import { ListValidationMessagesUseCase } from './use-cases/list-validation-messages.use-case';
// P6 — PUB-014/015: exported in-process ports for PROJ
import { PublicationHistoryService } from './publication-history.service';
import { PublicationErasureService } from './publication-erasure.service';
import {
  EVENT_PUBLISHER_PORT,
  GENERATE_PUBLICATION_USE_CASE,
  GET_PUBLICATION_HISTORY_USE_CASE,
  GET_PUBLICATION_STATS_USE_CASE,
  GET_PUBLICATION_STATUS_USE_CASE,
  GET_SIGNED_DOWNLOAD_URL_USE_CASE,
  LIST_VALIDATION_MESSAGES_USE_CASE,
  PUBLICATION_HISTORY_PORT,
  PUBLICATION_ERASURE_PORT,
} from './pub.tokens';

/**
 * PUB — Publicação bounded context module.
 *
 * P3 (PUB-007/008): `PublicacaoRepositoryPort` (Symbol) is now provided
 * globally by `PersistenceModule` (`@Global()`, imported in `AppModule`).
 * The use cases registered here receive the real `PrismaPublicacaoRepository`
 * via constructor injection from the global scope — no direct import of
 * infrastructure/ is needed here.
 *
 * P6 (PUB-014/015): `PUBLICATION_HISTORY_PORT` and `PUBLICATION_ERASURE_PORT`
 * are registered here and exported so PROJ can inject them directly in a
 * co-located (monolith) deployment. Both services depend only on globally
 * provided tokens (`PUBLICACAO_REPOSITORY_PORT`, `FILE_STORAGE_PORT`) —
 * no infrastructure/ imports needed (RULE-04 compliant).
 *
 * RULE-04: modules/ must not import infrastructure/ directly. ✓
 *   `PubModule` does not import `PersistenceModule` or `StorageModule` —
 *   it inherits their exports from the global scope registered by `AppModule`.
 */
@Module({
  controllers: [PubController],
  providers: [
    // Internal collaborator — injected by class type (no DI token) into
    // GeneratePublicationUseCase, never called across a module boundary.
    PublicationBuildJob,
    { provide: GENERATE_PUBLICATION_USE_CASE, useClass: GeneratePublicationUseCase },
    { provide: GET_PUBLICATION_STATUS_USE_CASE, useClass: GetPublicationStatusUseCase },
    { provide: GET_PUBLICATION_HISTORY_USE_CASE, useClass: GetPublicationHistoryUseCase },
    { provide: GET_SIGNED_DOWNLOAD_URL_USE_CASE, useClass: GetSignedDownloadUrlUseCase },
    { provide: GET_PUBLICATION_STATS_USE_CASE, useClass: GetPublicationStatsUseCase },

    // --- PUB-016: List validation messages ---
    { provide: LIST_VALIDATION_MESSAGES_USE_CASE, useClass: ListValidationMessagesUseCase },

    // --- P16 — PUB-004: Domain-event publisher ---
    /**
     * Provides a Node.js EventEmitter adapter for `EventPublisherPort`.
     * `PublicationBuildJob` uses it to dispatch `publication.succeeded` /
     * `publication.failed` domain events after the terminal persistence call.
     *
     * A single shared EventEmitter instance is sufficient for in-process
     * event dispatch. Downstream handlers can subscribe via standard Node.js
     * EventEmitter API. RULE-04 compliant: no infrastructure/ import here.
     */
    {
      provide: EVENT_PUBLISHER_PORT,
      useFactory: () => new EventEmitter(),
    },

    // --- P6 — PUB-014: PublicationHistoryPort (exported to PROJ) ---
    /**
     * Provides the in-process read-model over the Publicacao aggregate for PROJ.
     * PROJ's GetPublicationHistoryUseCase and GetProjetoLibraryUseCase inject
     * this via the domain Symbol re-exported as PUBLICATION_HISTORY_PORT.
     *
     * Depends on PUBLICACAO_REPOSITORY_PORT (PersistenceModule @Global) and
     * FILE_STORAGE_PORT (StorageModule @Global) — no infrastructure/ import here.
     */
    { provide: PUBLICATION_HISTORY_PORT, useClass: PublicationHistoryService },

    // --- P6 — PUB-015: PublicationErasurePort (exported to PROJ) ---
    /**
     * Provides the LGPD erasure implementation for PROJ's delete cascade.
     * PROJ's DeleteProjetoUseCase injects this via PUBLICATION_ERASURE_PORT.
     *
     * Idempotent: safe to retry after a partial failure (PROJ-016 contract).
     */
    { provide: PUBLICATION_ERASURE_PORT, useClass: PublicationErasureService },
  ],
  exports: [
    // Exported so PROJ (in co-located/monolith deployment) can inject them.
    PUBLICATION_HISTORY_PORT,
    PUBLICATION_ERASURE_PORT,
  ],
})
export class PubModule {}
