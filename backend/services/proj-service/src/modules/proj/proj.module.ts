import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { ProjDomainService } from '../../domain/proj.domain-service';
import { ProjRepositoryPort } from '../../domain/proj.repository.interface';
import { EmpresaContextMiddleware } from './middleware/empresa-context.middleware';
import { ProjController } from './proj.controller';
import { ProjService } from './proj.service';
import {
  ADVANCE_PROJETO_STATUS_USE_CASE,
  COMPOSITION_ERASURE_PORT,
  CREATE_PROJETO_USE_CASE,
  DELETE_PROJETO_USE_CASE,
  GET_PROJETO_DETAIL_USE_CASE,
  GET_PROJETO_LIBRARY_USE_CASE,
  GET_PUBLICATION_HISTORY_USE_CASE,
  GET_SIGNED_DOWNLOAD_URL_USE_CASE,
  MANUSCRIPT_ERASURE_PORT,
  MANUSCRIPT_SUMMARY_PORT,
  PROJECT_EVENT_PUBLISHER,
  PROJECT_METADATA_PORT,
  PROJETO_EDITORIAL_LOOKUP,
  PROJETO_EDITORIAL_REPOSITORY,
  PUBLICATION_ERASURE_PORT,
  PUBLICATION_HISTORY_PORT,
  REOPEN_PROJECT_USE_CASE,
} from './proj.tokens';

// P2 use case implementations (modules/ classes — RULE-04 compliant)
import { CreateProjetoEditorialUseCase } from './use-cases/create-projeto-editorial.use-case';
import { AdvanceProjetoStatusUseCase } from './use-cases/advance-projeto-status.use-case';
import { ReopenProjectForRevisionUseCase } from './use-cases/reopen-project-for-revision.use-case';

// NOTE: ProjetoEditorialLookupAdapter (infrastructure/proj/lookup/) is NOT imported
// here — modules/ must not import infrastructure/ directly (RULE-04). The adapter
// class exists on disk and will be wired in P3 via a factory provider in
// PersistenceModule. For P2 we bind a cross-tenant-safe stub (exists → false).

/**
 * PROJ — Projetos Editoriais bounded context module.
 *
 * P2 update: wires the three P2 use cases (PROJ-003, PROJ-004, PROJ-005) and
 * the lookup adapter (PROJ-006). Repository and event publisher are still stubs
 * in P2 — real adapters arrive in P3 (Prisma) and future priorities.
 *
 * RULE-04: modules/ must not import infrastructure/ directly for use cases.
 * The lookup adapter IS in infrastructure/ but it is wired here via a factory
 * provider, keeping the DI token as the only coupling point.
 */
@Module({
  controllers: [ProjController],
  providers: [
    // Application service (orchestrates P2+ use cases via DI tokens)
    ProjService,

    // D-603: domain service carries no Nest decorator — registered by factory
    // so src/domain/ remains free of @nestjs/* (ADR-001-hexagonal-node, RULE-02).
    {
      provide: ProjDomainService,
      useFactory: () => new ProjDomainService(),
    },

    // P1 repository stub — real Prisma adapter bound in P3 (PROJ-007, PROJ-008).
    { provide: ProjRepositoryPort, useValue: {} },

    // --- ProjetoEditorial repository stub (P2) —
    // Real Prisma adapter (PrismaProjRepository renamed + updateStatus added) in P3.
    // RULE-04: useValue stub avoids any direct import from infrastructure/persistence.
    {
      provide: PROJETO_EDITORIAL_REPOSITORY,
      useValue: {
        create: async () => null,
        findById: async () => null,
        updateStatus: async () => null,
        existsByIdAndEmpresa: async () => false,
      },
    },

    // --- Event publisher stub (P2) —
    // Real binding to EventEmitter2 added when @nestjs/event-emitter is configured.
    {
      provide: PROJECT_EVENT_PUBLISHER,
      useValue: { publish: () => undefined },
    },

    // --- P2 use cases (PROJ-003, PROJ-004, PROJ-005) ---

    /**
     * PROJ-003: CreateProjetoEditorialUseCase
     * Also satisfies CreateProjetoEditorialPort for IMP.
     */
    {
      provide: CREATE_PROJETO_USE_CASE,
      useClass: CreateProjetoEditorialUseCase,
    },

    /**
     * PROJ-004: AdvanceProjetoStatusUseCase
     * Called by IMP (confirm-estrutura) and PUB (export result).
     */
    {
      provide: ADVANCE_PROJETO_STATUS_USE_CASE,
      useClass: AdvanceProjetoStatusUseCase,
    },

    /**
     * PROJ-005: ReopenProjectForRevisionUseCase
     * The one deliberate backward edge; editor-only.
     */
    {
      provide: REOPEN_PROJECT_USE_CASE,
      useClass: ReopenProjectForRevisionUseCase,
    },

    // --- PROJ-006: ProjetoEditorialLookup inbound port ---
    // P2 stub: returns false (cross-tenant safe default).
    // P3 will replace with a factory that wires ProjetoEditorialLookupAdapter
    // from PersistenceModule without violating RULE-04.
    {
      provide: PROJETO_EDITORIAL_LOOKUP,
      useValue: { exists: async (_projetoId: string) => false },
    },

    /** P4 (PROJ-010): GetProjetoLibraryUseCase */
    { provide: GET_PROJETO_LIBRARY_USE_CASE, useValue: null },

    /** P4 (PROJ-011): GetProjetoDetailUseCase */
    { provide: GET_PROJETO_DETAIL_USE_CASE, useValue: null },

    /** P4 (PROJ-012): GetPublicationHistoryUseCase */
    { provide: GET_PUBLICATION_HISTORY_USE_CASE, useValue: null },

    /** P4 (PROJ-013): GetSignedDownloadUrlUseCase */
    { provide: GET_SIGNED_DOWNLOAD_URL_USE_CASE, useValue: null },

    /** P6 (PROJ-016): DeleteProjetoUseCase */
    { provide: DELETE_PROJETO_USE_CASE, useValue: null },

    // --- Outbound read port stubs (P1) — real adapters wired in P4 ---

    /** P4 (PROJ-009 / PROJ-INT-001): ManuscriptSummaryPort → IMP adapter */
    { provide: MANUSCRIPT_SUMMARY_PORT, useValue: null },

    /** P4 (PROJ-009 / PROJ-INT-002): ProjectMetadataPort → COMP adapter */
    { provide: PROJECT_METADATA_PORT, useValue: null },

    /** P4 (PROJ-009 / PROJ-INT-003): PublicationHistoryPort → PUB adapter */
    { provide: PUBLICATION_HISTORY_PORT, useValue: null },

    // --- Outbound erasure port stubs (P1) — real adapters wired in P6 ---

    /** P6 (PROJ-015 / PROJ-INT-006): PublicationErasurePort → PUB adapter */
    { provide: PUBLICATION_ERASURE_PORT, useValue: null },

    /** P6 (PROJ-015 / PROJ-INT-005): CompositionErasurePort → COMP adapter */
    { provide: COMPOSITION_ERASURE_PORT, useValue: null },

    /** P6 (PROJ-015 / PROJ-INT-004): ManuscriptErasurePort → IMP adapter */
    { provide: MANUSCRIPT_ERASURE_PORT, useValue: null },
  ],
  exports: [
    ProjService,
    // PROJ-006: 4 inbound ports exported for IMP / PUB / editor callers
    CREATE_PROJETO_USE_CASE,
    PROJETO_EDITORIAL_LOOKUP,
    ADVANCE_PROJETO_STATUS_USE_CASE,
    REOPEN_PROJECT_USE_CASE,
  ],
})
export class ProjModule implements NestModule {
  /**
   * Apply EmpresaContext middleware to all routes handled by this module.
   *
   * P1 stub: the middleware is a no-op passthrough. In P5 (PROJ-014) the real
   * implementation reads `req.user.empresaId` from the parsed JWT and populates
   * the AsyncLocalStorage store so every downstream repository call receives
   * the correct Postgres search_path (multi-empresa / schema-per-tenant).
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(EmpresaContextMiddleware).forRoutes(ProjController);
  }
}
