/**
 * Outbound port: ManuscriptErasurePort
 *
 * Purges manuscript data for a project in the IMP context, the third and
 * last leaf of the LGPD erasure cascade (P6 / PROJ-015). Called by
 * DeleteProjetoUseCase (PROJ-016) AFTER PublicationErasurePort and
 * CompositionErasurePort — the DB delete of projeto_editorial runs only
 * after this step succeeds.
 *
 * A failure here MUST abort the cascade before the DB delete runs — same
 * non-degraded contract as the other erasure ports.
 *
 * RULE-01: zero @prisma/client imports.
 * RULE-02: zero @nestjs/* imports.
 * RULE-06: the real HTTP adapter lives in src/infrastructure/proj/erasure/.
 */
export interface ManuscriptErasurePort {
  /**
   * Erases all manuscript data for the project. Idempotent — safe to call
   * again for an already-erased project (retry-after-partial-failure).
   *
   * @param projetoId    - project UUID whose manuscript data must be purged
   * @param empresaId    - active tenant (used for logging; not sent as header)
   * @param bearerToken  - JWT from the originating request; forwarded so the
   *                       IMP endpoint can validate the principal and scope
   * @throws when IMP is unreachable or reports the purge failed
   */
  erase(projetoId: string, empresaId: string, bearerToken?: string): Promise<void>;
}

/** DI injection token for ManuscriptErasurePort. Re-exported by proj.tokens.ts */
export const ManuscriptErasurePort = Symbol('ManuscriptErasurePort');
