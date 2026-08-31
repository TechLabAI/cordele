/**
 * Inbound port for LGPD data erasure of all composition data for a project.
 * Exported by CompModule for in-process consumption by PROJ (erasure workflow).
 *
 * Pure TypeScript interface — no @nestjs/* or @prisma/client imports (RULE-01/02).
 * The injection token is declared in comp.tokens.ts (COMP_COMPOSITION_ERASURE_PORT).
 */
export interface CompositionErasurePort {
  /**
   * Idempotent deletion of all COMP data for the given project.
   *
   * Deletes:
   *  - `metadados` row (CASCADE: none, but the row is removed explicitly).
   *  - `configuracao_layout` row (CASCADE via FK ON DELETE CASCADE deletes
   *    all associated `layout_override` rows).
   *  - Cover image from FileStorage when `capaUrl` is set (best-effort —
   *    storage errors are logged but do not abort the operation).
   *
   * Idempotent: a second call for the same projetoId completes without error.
   * When no row exists the method returns successfully.
   *
   * Multi-empresa: schema routing is handled by PrismaEmpresaService via the
   * current empresa context (AsyncLocalStorage, RULE-07). Callers must be in a
   * request context where EmpresaContext is populated.
   *
   * @param projetoId  UUID of the project whose COMP data should be erased.
   */
  purge(projetoId: string): Promise<void>;
}
