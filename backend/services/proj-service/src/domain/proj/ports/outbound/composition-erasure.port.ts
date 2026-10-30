/**
 * Outbound port: CompositionErasurePort
 *
 * Purges composition data for a project in the COMP context, the second leaf
 * of the LGPD erasure cascade (P6 / PROJ-015). Called by DeleteProjetoUseCase
 * (PROJ-016) AFTER PublicationErasurePort and BEFORE ManuscriptErasurePort.
 *
 * A failure here MUST abort the cascade before IMP purge and DB delete run —
 * same non-degraded contract as PublicationErasurePort.
 *
 * RULE-01: zero @prisma/client imports.
 * RULE-02: zero @nestjs/* imports.
 * RULE-06: the real HTTP adapter lives in src/infrastructure/proj/erasure/.
 */
export interface CompositionErasurePort {
  /**
   * Erases all composition data for the project. Idempotent — safe to call
   * again for an already-erased project (retry-after-partial-failure).
   *
   * @param projetoId    - project UUID whose composition data must be purged
   * @param empresaId    - active tenant (used for logging; not sent as header)
   * @param bearerToken  - JWT from the originating request; forwarded so the
   *                       COMP endpoint can validate the principal and scope
   * @throws when COMP is unreachable or reports the purge failed
   */
  erase(projetoId: string, empresaId: string, bearerToken?: string): Promise<void>;
}

/** DI injection token for CompositionErasurePort. Re-exported by proj.tokens.ts */
export const CompositionErasurePort = Symbol('CompositionErasurePort');
