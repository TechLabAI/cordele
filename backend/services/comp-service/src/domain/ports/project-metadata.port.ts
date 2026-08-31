/**
 * Inbound port for batch project metadata queries (exported by CompModule).
 *
 * Used by PUB (ePub assembly) and PROJ (metadata lookup) to fetch metadata for
 * one or more projects in a single query. Exposed in-process — no HTTP call.
 *
 * Pure TypeScript interface — no @nestjs/* or @prisma/client imports (RULE-01/02).
 * The injection token is declared in comp.tokens.ts (COMP_PROJECT_METADATA_PORT).
 */

/**
 * Minimal metadata shape exposed across bounded context boundaries.
 *
 * Intentionally a subset of MetadadosEntity — consumers (PUB, PROJ) must not
 * depend on the full aggregate to avoid coupling. Fields match what ePub
 * assembly and author lookup require.
 */
export interface MetadadosDto {
  readonly projetoId: string;
  readonly titulo: string;
  readonly autor: string;
  readonly idioma: string;
  readonly isbn: string | null;
  readonly capaUrl: string | null;
  /** false when no row exists (lazy default D-M); true when persisted at least once. */
  readonly materialized: boolean;
}

export interface ProjectMetadataPort {
  /**
   * Returns a map of projetoId → MetadadosDto for the given IDs.
   *
   * Uses a single Prisma `findMany({ where: { projetoId: { in: [...] } } })`
   * query — never a loop of findUnique (no N+1).
   *
   * Missing projects (no row in DB) are absent from the returned Map. Callers
   * should treat absence as `materialized=false`, consistent with D-M lazy default.
   *
   * Multi-empresa: schema routing is handled by PrismaEmpresaService via the
   * current empresa context (AsyncLocalStorage). Callers must be executing in
   * a request context where EmpresaContext is set (RULE-07).
   *
   * @param projetoIds  UUIDs of the projects to fetch.
   * @returns           Map keyed by projetoId; missing keys = not found.
   */
  metadata(projetoIds: string[]): Promise<Map<string, MetadadosDto>>;
}
