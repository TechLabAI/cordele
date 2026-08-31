import { Module } from '@nestjs/common';

import { CompController } from './comp.controller';
import { CompService } from './comp.service';
import { CompHealthService } from './comp-health.service';
import {
  COMP_GET_METADADOS_UC,
  COMP_UPDATE_METADADOS_UC,
  COMP_UPLOAD_CAPA_UC,
  COMP_REMOVE_CAPA_UC,
  COMP_GET_LAYOUT_UC,
  COMP_UPDATE_LAYOUT_UC,
  COMP_GET_PREVIEW_CONTEXT_UC,
  COMP_GET_METADADOS_EXPORT_UC,
  COMP_GET_LAYOUT_EXPORT_UC,
  COMP_PROJECT_METADATA_PORT,
  COMP_COMPOSITION_ERASURE_PORT,
} from './comp.tokens';
import { GetMetadadosViewUseCase } from './application/get-metadados-view.use-case';
import { UpdateMetadadosUseCase } from './application/update-metadados.use-case';
import { UploadCoverUseCase } from './application/upload-cover.use-case';
import { RemoveCoverUseCase } from './application/remove-cover.use-case';
import { GetLayoutViewUseCase } from './application/get-layout-view.use-case';
import { UpdateLayoutUseCase } from './application/update-layout.use-case';
import { GetLayoutPreviewUseCase } from './application/get-layout-preview.use-case';
import { GetMetadadosExportUseCase } from './application/get-metadados-export.use-case';
import { GetConfiguracaoLayoutExportUseCase } from './application/get-configuracao-layout-export.use-case';
import { ProjectMetadataUseCase } from './application/project-metadata.use-case';
import { CompositionErasureUseCase } from './application/composition-erasure.use-case';

/**
 * COMP — Composição Editorial bounded context module.
 *
 * P1: CompController with 7 nested routes + DI tokens.
 * P2: Real use-case classes wired via useClass (each class has @Injectable() +
 *     @Inject() decorators that resolve the port tokens injected by AppModule).
 * P3: COMP_METADADOS_REPO and COMP_LAYOUT_REPO bound to real Prisma adapters
 *     in AppModule (composition root — RULE-04 compliant). PersistenceModule
 *     is @Global and imported in AppModule; this module does NOT import
 *     infrastructure/ directly (RULE-04 ✓).
 * P4: ManuscriptContentStubAdapter bound to COMP_MANUSCRIPT_CONTENT_PORT;
 *     DiskFileStorageAdapter bound to COMP_FILE_STORAGE_PORT.
 *     Both adapters wired in AppModule — RULE-04 compliant.
 * P5: JwtAuthGuard registered as APP_GUARD in AppModule (mirrors proj-service
 *     and imp-service patterns); EmpresaContextMiddleware and
 *     CorrelationMiddleware registered in AppModule.configure() — this
 *     module never imports infrastructure/ (RULE-04 ✓).
 * P6 / COMP-016: GetMetadadosExportUseCase and GetConfiguracaoLayoutExportUseCase
 *     registered here; exported for PUB in-process ePub assembly.
 * P6 / COMP-017: ProjectMetadataUseCase (COMP_PROJECT_METADATA_PORT) and
 *     CompositionErasureUseCase (COMP_COMPOSITION_ERASURE_PORT) registered
 *     here; exported for PUB/PROJ in-process integration.
 * P7 / COMP-018: ProblemJsonFilter (APP_FILTER global) registered in AppModule.
 *     RequestLoggerMiddleware registered in AppModule.configure() (RULE-04).
 * P7 / COMP-019: CompHealthService registered here and exported for HealthModule.
 *     CompMetricsService registered in AppModule (lives in infrastructure/,
 *     RULE-04 prevents importing it here).
 *
 * RULE-04: this module does NOT import infrastructure/ directly. ✓
 * RULE-07: empresaId is resolved from the JWT principal (@CurrentUser) by
 *          the controller and passed to each use case. ✓
 */
@Module({
  controllers: [CompController],
  providers: [
    CompService,

    // --- P7/COMP-019: Health service ---
    // CompHealthService injects DatabaseHealthPort (not PrismaService directly —
    // RULE-04 compliant). COMP_DATABASE_HEALTH_PORT is bound in AppModule.
    CompHealthService,

    // --- Use cases (P2) — registered via useClass; @Inject() in each class
    //     resolves port tokens from the global DI context (AppModule).

    { provide: COMP_GET_METADADOS_UC, useClass: GetMetadadosViewUseCase },
    { provide: COMP_UPDATE_METADADOS_UC, useClass: UpdateMetadadosUseCase },
    { provide: COMP_UPLOAD_CAPA_UC, useClass: UploadCoverUseCase },
    { provide: COMP_REMOVE_CAPA_UC, useClass: RemoveCoverUseCase },
    { provide: COMP_GET_LAYOUT_UC, useClass: GetLayoutViewUseCase },
    { provide: COMP_UPDATE_LAYOUT_UC, useClass: UpdateLayoutUseCase },
    { provide: COMP_GET_PREVIEW_CONTEXT_UC, useClass: GetLayoutPreviewUseCase },

    // --- COMP-016: In-process export use cases for PUB (ePub assembly) ---
    { provide: COMP_GET_METADADOS_EXPORT_UC, useClass: GetMetadadosExportUseCase },
    { provide: COMP_GET_LAYOUT_EXPORT_UC, useClass: GetConfiguracaoLayoutExportUseCase },

    // --- COMP-017: In-process port use cases for PUB/PROJ integration ---
    // ProjectMetadataPort: batch query (no N+1) for PUB ePub assembly and PROJ lookup.
    { provide: COMP_PROJECT_METADATA_PORT, useClass: ProjectMetadataUseCase },
    // CompositionErasurePort: LGPD erasure for PROJ (idempotent purge).
    { provide: COMP_COMPOSITION_ERASURE_PORT, useClass: CompositionErasureUseCase },
  ],
  exports: [
    // P2: core view use-case tokens (consumed by other module controllers).
    COMP_GET_METADADOS_UC,
    COMP_GET_LAYOUT_UC,

    // COMP-016: export use-case tokens for PUB (ePub assembly).
    COMP_GET_METADADOS_EXPORT_UC,
    COMP_GET_LAYOUT_EXPORT_UC,

    // COMP-017: in-process port tokens for PUB/PROJ integration.
    COMP_PROJECT_METADATA_PORT,
    COMP_COMPOSITION_ERASURE_PORT,

    // COMP-019: CompHealthService exported so HealthModule can consume it
    // without importing infrastructure/ directly (RULE-05 compliance).
    CompHealthService,

    CompService,
  ],
})
export class CompModule {}
