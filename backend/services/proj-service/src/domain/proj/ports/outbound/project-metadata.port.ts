/**
 * Outbound port: ProjectMetadataPort
 *
 * Queries the COMP context for editorial metadata (author, layout, etc.) for
 * a batch of projects. Called once per library/detail request with ALL projetoIds
 * to enforce the batching invariant (SPEC-10 clause 3 — no N+1 port calls).
 *
 * RULE-01: zero @prisma/client imports.
 * RULE-02: zero @nestjs/* imports.
 * RULE-06: the real HTTP adapter lives in src/infrastructure/proj/read/.
 */

/** Composition metadata for one project (sourced from COMP). */
export interface ProjectMetadata {
  /**
   * Author name as composed by COMP.
   * Undefined when COMP has not yet produced metadata for the project.
   */
  readonly autor?: string | null;
}

/**
 * Port interface for batch-reading project metadata from COMP.
 *
 * Implementations:
 *  - Stub (P4): src/infrastructure/stubs/proj/project-metadata.stub.ts
 *  - Real HTTP adapter (PROJ-INT-002): src/infrastructure/proj/read/project-metadata.adapter.ts
 */
export interface ProjectMetadataPort {
  /**
   * Returns a Map keyed by projetoId with the metadata for each project.
   * Projects without COMP metadata are absent from the Map (not an error).
   * Called ONCE per request with all projetoIds.
   *
   * @param projetoIds - list of project UUIDs to query
   * @param empresaId  - active tenant
   */
  metadata(
    projetoIds: string[],
    empresaId: string,
  ): Promise<Map<string, ProjectMetadata>>;
}

/** DI injection token for ProjectMetadataPort. Re-exported by proj.tokens.ts */
export const ProjectMetadataPort = Symbol('ProjectMetadataPort');
