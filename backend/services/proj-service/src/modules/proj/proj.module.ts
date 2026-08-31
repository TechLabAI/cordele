import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';

import { EmpresaContextMiddleware } from './middleware/empresa-context.middleware';
import { ProjController } from './proj.controller';
import {
  ADVANCE_PROJETO_STATUS_USE_CASE,
  CREATE_PROJETO_USE_CASE,
  DELETE_PROJETO_USE_CASE,
  GET_PROJETO_DETAIL_USE_CASE,
  GET_PROJETO_LIBRARY_USE_CASE,
  GET_PUBLICATION_HISTORY_USE_CASE,
  GET_SIGNED_DOWNLOAD_URL_USE_CASE,
  PROJECT_EVENT_PUBLISHER,
  PROJETO_EDITORIAL_LOOKUP,
  REOPEN_PROJECT_USE_CASE,
} from './proj.tokens';

// P2 use case implementations (modules/ classes — RULE-04 compliant)
import { CreateProjetoEditorialUseCase } from './use-cases/create-projeto-editorial.use-case';
import { AdvanceProjetoStatusUseCase } from './use-cases/advance-projeto-status.use-case';
import { ReopenProjectForRevisionUseCase } from './use-cases/reopen-project-for-revision.use-case';

// P4 use case implementations (PROJ-010..013)
import { GetProjetoLibraryUseCase } from './use-cases/get-projeto-library.use-case';
import { GetProjetoDetailUseCase } from './use-cases/get-projeto-detail.use-case';
import { GetPublicationHistoryUseCase } from './use-cases/get-publication-history.use-case';
import { GetSignedDownloadUrlUseCase } from './use-cases/get-signed-download-url.use-case';

// P6 use case implementation (PROJ-016)
import { DeleteProjetoUseCase } from './use-cases/delete-projeto.use-case';

/**
 * PROJ — Projetos Editoriais bounded context module.
 *
 * P4 update: the four P4 use cases (PROJ-010..013) are registered with
 * useClass so Nest's DI resolves their injected port dependencies.
 *
 * Read port tokens (MANUSCRIPT_SUMMARY_PORT, PROJECT_METADATA_PORT,
 * PUBLICATION_HISTORY_PORT) are provided globally by ReadPortsModule
 * (@Global()) imported in AppModule. ProjModule never imports
 * infrastructure/ directly (RULE-04 compliant).
 *
 * P3 note: PROJETO_EDITORIAL_REPOSITORY is provided globally by
 * PersistenceModule (@Global()); same pattern applies here.
 *
 * RULE-04: modules/ must not import infrastructure/ directly. ✓
 */
@Module({
  controllers: [ProjController],
  providers: [
    // NOTE: PROJETO_EDITORIAL_REPOSITORY is provided globally by
    // PersistenceModule (P3). No stub here — AppModule imports
    // PersistenceModule which is @Global(), making the token available.

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
    // P3+ will replace with the real adapter from PersistenceModule.
    {
      provide: PROJETO_EDITORIAL_LOOKUP,
      useValue: { exists: async (_projetoId: string) => false },
    },

    // NOTE: MANUSCRIPT_SUMMARY_PORT, PROJECT_METADATA_PORT, PUBLICATION_HISTORY_PORT
    // are provided globally by ReadPortsModule (@Global()) imported in AppModule.
    // ProjModule never references them here (RULE-04 compliant).

    // --- P4 use cases (PROJ-010..013) ---

    /**
     * PROJ-010: GetProjetoLibraryUseCase
     * Batches 3 port calls; degrades gracefully when any port throws.
     */
    {
      provide: GET_PROJETO_LIBRARY_USE_CASE,
      useClass: GetProjetoLibraryUseCase,
    },

    /**
     * PROJ-011: GetProjetoDetailUseCase
     * Composes cross-context fields for one project.
     */
    {
      provide: GET_PROJETO_DETAIL_USE_CASE,
      useClass: GetProjetoDetailUseCase,
    },

    /**
     * PROJ-012: GetPublicationHistoryUseCase
     * Returns publication list ordered newest-first.
     */
    {
      provide: GET_PUBLICATION_HISTORY_USE_CASE,
      useClass: GetPublicationHistoryUseCase,
    },

    /**
     * PROJ-013: GetSignedDownloadUrlUseCase
     * Returns 409 for erros_criticos/pendente; mints URL for valido/avisos.
     */
    {
      provide: GET_SIGNED_DOWNLOAD_URL_USE_CASE,
      useClass: GetSignedDownloadUrlUseCase,
    },

    /**
     * PROJ-016: DeleteProjetoUseCase
     * Orchestrates the leaf-first LGPD erasure cascade (PUB -> COMP -> IMP ->
     * DB delete). PUBLICATION_ERASURE_PORT, COMPOSITION_ERASURE_PORT and
     * MANUSCRIPT_ERASURE_PORT are provided globally by ErasurePortsModule
     * (@Global()) imported in AppModule — same pattern as the P4 read ports.
     */
    {
      provide: DELETE_PROJETO_USE_CASE,
      useClass: DeleteProjetoUseCase,
    },
  ],
  exports: [
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
   * P1 stub: still a no-op passthrough. P5 (PROJ-014) resolves `empresaId`
   * from the JWT claim via `@CurrentUser()` in `ProjController` and passes it
   * explicitly into every use case call (the pattern already established by
   * P3/P4 repositories and use cases) instead of populating an
   * AsyncLocalStorage store here — Express middleware runs before
   * `JwtAuthGuard`, so `req.user` is not yet available at this stage.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(EmpresaContextMiddleware).forRoutes(ProjController);
  }
}
