import { Global, Module } from '@nestjs/common';

import { PrismaMetadadosRepository } from './persistence/metadados.repository';
import { PrismaConfiguracaoLayoutRepository } from './persistence/configuracao-layout.repository';
import { PrismaDatabaseHealthAdapter } from './persistence/prisma-database-health.adapter';
import { ManuscriptContentStubAdapter } from './manuscript/manuscript-content-stub.adapter';
import { DiskFileStorageAdapter } from './storage/disk-file-storage.adapter';
import { InProcessEventEmitterAdapter } from './events/in-process-event-emitter.adapter';
import { CompMetricsService } from './metrics/comp-metrics.service';
import {
  COMP_METADADOS_REPO,
  COMP_LAYOUT_REPO,
  COMP_MANUSCRIPT_CONTENT_PORT,
  COMP_FILE_STORAGE_PORT,
  COMP_EVENT_EMITTER,
  COMP_METRICS_SERVICE,
} from '../../modules/comp/comp.tokens';
import { COMP_DATABASE_HEALTH_PORT } from '../../modules/comp/ports/database-health.port';

/**
 * Global DI bindings module for the COMP bounded context.
 *
 * Why this module exists (FIX CRITICO — boot DI crash):
 * NestJS DI visibility flows only from child → parent (via exports), never
 * parent → child. Providers declared in AppModule.providers are NOT
 * automatically visible to providers declared inside CompModule (or any
 * imported feature module). The only mechanism that makes a provider visible
 * across the entire application tree without explicit import is @Global().
 *
 * This module applies the same pattern already used by PersistenceModule:
 * declare the infrastructure adapters as @Global() providers + exports so
 * that CompModule's use-cases, CompHealthService, and any future module can
 * inject the port tokens without importing infrastructure/ directly
 * (RULE-04 compliant).
 *
 * Bindings moved here from AppModule.providers (P3/P4/P5/P7 legacy placement):
 *   COMP_METADADOS_REPO          → PrismaMetadadosRepository (useExisting)
 *   COMP_LAYOUT_REPO             → PrismaConfiguracaoLayoutRepository (useExisting)
 *   COMP_MANUSCRIPT_CONTENT_PORT → ManuscriptContentStubAdapter (useClass)
 *   COMP_FILE_STORAGE_PORT       → DiskFileStorageAdapter (useClass)
 *   COMP_DATABASE_HEALTH_PORT    → PrismaDatabaseHealthAdapter (useClass)
 *   COMP_EVENT_EMITTER           → InProcessEventEmitterAdapter (useClass)
 *   COMP_METRICS_SERVICE         → CompMetricsService (useExisting)
 *
 * Note on useExisting (PrismaMetadadosRepository / PrismaConfiguracaoLayoutRepository):
 * PersistenceModule is @Global() and exports both classes; they are already
 * registered in the global DI container, so useExisting resolves correctly
 * without double-registering.
 *
 * RULE-05: this module does NOT import from modules/ at runtime (only imports
 * token constants, which are plain Symbol/string values — not NestJS providers).
 */
@Global()
@Module({
  providers: [
    // --- Infrastructure adapters (concrete classes) ---
    // useClass adapters: instantiated here (not registered anywhere else).
    { provide: COMP_MANUSCRIPT_CONTENT_PORT, useClass: ManuscriptContentStubAdapter },
    // INT-COMP-001: swap ManuscriptContentStubAdapter → ManuscritoQueryHttpAdapter
    //               once IMP scaffold is available — only this file changes.

    { provide: COMP_FILE_STORAGE_PORT, useClass: DiskFileStorageAdapter },
    // INT-COMP-002: swap DiskFileStorageAdapter → S3FileStorageAdapter post-POC.

    { provide: COMP_DATABASE_HEALTH_PORT, useClass: PrismaDatabaseHealthAdapter },
    // CompHealthService (modules/) injects COMP_DATABASE_HEALTH_PORT instead of
    // PrismaService directly — RULE-04 compliant.

    { provide: COMP_EVENT_EMITTER, useClass: InProcessEventEmitterAdapter },
    // messaging.enabled=false — events dispatched in-process via Node EventEmitter.
    // Use cases inject COMP_EVENT_EMITTER and emit MetadataUpdated / LayoutUpdated
    // without coupling to the transport.

    // --- CompMetricsService: registered once here; aliased via token below ---
    CompMetricsService,
    { provide: COMP_METRICS_SERVICE, useExisting: CompMetricsService },

    // --- Prisma repository aliases (useExisting — classes provided by PersistenceModule @Global) ---
    // PersistenceModule is @Global() and exports PrismaMetadadosRepository and
    // PrismaConfiguracaoLayoutRepository; useExisting references those registrations
    // so use-cases in CompModule receive the correct, shared instances.
    { provide: COMP_METADADOS_REPO, useExisting: PrismaMetadadosRepository },
    { provide: COMP_LAYOUT_REPO, useExisting: PrismaConfiguracaoLayoutRepository },
  ],
  exports: [
    COMP_MANUSCRIPT_CONTENT_PORT,
    COMP_FILE_STORAGE_PORT,
    COMP_DATABASE_HEALTH_PORT,
    COMP_EVENT_EMITTER,
    CompMetricsService,
    COMP_METRICS_SERVICE,
    COMP_METADADOS_REPO,
    COMP_LAYOUT_REPO,
  ],
})
export class CompInfraBindingsModule {}
