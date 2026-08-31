/**
 * Inbound port: PublicationErasurePort
 *
 * Exported by PUB (P6 — PUB-015) and injected by PROJ via DI token
 * PUBLICATION_ERASURE_PORT (pub.tokens.ts). Purges all publication data for a
 * project as the first leaf of the LGPD erasure cascade (proj DeleteProjetoUseCase —
 * PROJ-016). Called before CompositionErasurePort and ManuscriptErasurePort.
 *
 * Contract:
 *  - Idempotent: a second call for an already-erased project must succeed
 *    without error (required for retry-after-partial-failure per PROJ-016).
 *  - A failure MUST propagate (no silent degradation): the project row must
 *    never be deleted while PUB data may still exist.
 *
 * RULE-01: zero @prisma/client imports.
 * RULE-02: zero @nestjs/* imports.
 * Real implementation: src/modules/pub/publication-erasure.service.ts
 * DI token: PUBLICATION_ERASURE_PORT (pub.tokens.ts)
 */
export interface PublicationErasurePort {
  /**
   * Erases all publication records and ePub artifacts for the project.
   * Idempotent — calling this again for an already-erased project must
   * succeed without error.
   *
   * Steps (in order):
   *  1. Load all publications for the project (to collect artefatoRefs).
   *  2. Delete publication rows from the database (deleteMany — 0 rows is OK).
   *  3. Delete ePub artifact files from storage for each artefatoRef
   *     (ENOENT is silently absorbed by FileStoragePort.delete).
   *
   * @param projetoId - project UUID whose publications must be purged
   * @param empresaId - active tenant (logging/tracing)
   * @throws when a step other than "record already absent" fails
   */
  erase(projetoId: string, empresaId: string): Promise<void>;
}
