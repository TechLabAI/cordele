/**
 * Outbound port: ManuscriptSummaryPort
 *
 * Queries the IMP context for manuscript summaries of a given list of projects.
 * Called once per library/detail request with ALL projetoIds — this is the
 * batching contract that prevents N+1 port calls (SPEC-10 clause 3).
 *
 * RULE-01: zero @prisma/client imports.
 * RULE-02: zero @nestjs/* imports.
 * RULE-06: the real HTTP adapter lives in src/infrastructure/proj/read/.
 */

/** Read model for one project's manuscript summary (sourced from IMP). */
export interface ManuscriptSummary {
  /** Total number of chapters in the latest imported manuscript. */
  readonly totalCapitulos: number;
  /** Total number of images in the latest imported manuscript. */
  readonly totalImagens: number;
}

/**
 * Port interface for batch-reading manuscript summaries from IMP.
 *
 * Implementations:
 *  - Stub (P4): src/infrastructure/stubs/proj/manuscript-summary.stub.ts
 *  - Real HTTP adapter (PROJ-INT-001): src/infrastructure/proj/read/manuscript-summary.adapter.ts
 */
export interface ManuscriptSummaryPort {
  /**
   * Returns a Map keyed by projetoId with the manuscript summary for each project.
   * Projects without a manuscript are absent from the Map (not an error).
   * Called ONCE per request with all projetoIds — callers must not call per-item.
   *
   * @param projetoIds - list of project UUIDs to query
   * @param empresaId  - active tenant; all IDs belong to this empresa
   */
  summaries(
    projetoIds: string[],
    empresaId: string,
  ): Promise<Map<string, ManuscriptSummary>>;
}

/** DI injection token for ManuscriptSummaryPort. Re-exported by proj.tokens.ts */
export const ManuscriptSummaryPort = Symbol('ManuscriptSummaryPort');
