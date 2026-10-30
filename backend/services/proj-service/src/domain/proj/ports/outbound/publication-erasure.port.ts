/**
 * Outbound port: PublicationErasurePort
 *
 * Purges all publication artifacts and records for a project in the PUB
 * context, as the first leaf of the LGPD erasure cascade (P6 / PROJ-015).
 * DeleteProjetoUseCase (PROJ-016) calls this BEFORE CompositionErasurePort
 * and ManuscriptErasurePort — the cascade is leaf-first and sequential.
 *
 * Unlike the P4 read ports, a failure here MUST abort the cascade (no
 * degraded-mode fallback): the caller propagates the error so the project
 * row is never deleted while PUB data may still exist (contract: "falha em
 * PUB nao deleta projeto_editorial; retorna 502").
 *
 * RULE-01: zero @prisma/client imports.
 * RULE-02: zero @nestjs/* imports.
 * RULE-06: the real HTTP adapter lives in src/infrastructure/proj/erasure/.
 */
export interface PublicationErasurePort {
  /**
   * Erases all publication data for the project. Idempotent — calling this
   * again for an already-erased project must succeed without error (required
   * for retry-after-partial-failure per PROJ-016 acceptance criteria).
   *
   * @param projetoId    - project UUID whose publications must be purged
   * @param empresaId    - active tenant (used for logging; not sent as header)
   * @param bearerToken  - JWT from the originating request; forwarded so the
   *                       PUB endpoint can validate the principal and scope
   * @throws when PUB is unreachable or reports the purge failed
   */
  erase(projetoId: string, empresaId: string, bearerToken?: string): Promise<void>;
}

/** DI injection token for PublicationErasurePort. Re-exported by proj.tokens.ts */
export const PublicationErasurePort = Symbol('PublicationErasurePort');
