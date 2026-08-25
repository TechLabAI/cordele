/**
 * Inbound port for project existence validation.
 *
 * Published under `PROJETO_EDITORIAL_LOOKUP` so IMP can validate projetoId
 * before uploading a manuscript, without coupling to the PROJ implementation
 * (ADR-001 / PROJ-006 / integration-contracts §1.2).
 *
 * Pure domain interface — zero @nestjs/* and zero @prisma/client imports
 * (RULE-01 / RULE-02).
 */
export interface ProjetoEditorialLookupPort {
  /**
   * Returns `true` iff the project with `projetoId` exists AND belongs to the
   * empresa currently active in EmpresaContext.
   *
   * Cross-tenant safety: returns `false` (not throws) when the project belongs
   * to a different empresa — the caller must treat this as "not found".
   */
  exists(projetoId: string): Promise<boolean>;
}
