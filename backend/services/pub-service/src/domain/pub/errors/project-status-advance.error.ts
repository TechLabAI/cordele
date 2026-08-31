/**
 * The only two terminal targets PUB ever requests — mirrored from the port
 * to keep domain/ free of modules/ imports (RULE-01/02).
 */
export type ProjetoTargetStatusDomain = 'publicado' | 'com_erros';

/**
 * Thrown by `ProjProjectStatusAdapter` when the HTTP call to advance the
 * project status fails for any reason (4xx, 5xx, network error, timeout).
 *
 * `PublicationBuildJob.requestProjectStatus` catches this and logs it without
 * discarding the `Publicacao` outcome — the build result is never lost due to
 * a downstream status-advance failure (integration-contracts.md §2.4).
 *
 * RULE-01/02: domain error — zero @nestjs/*, @prisma/client, and modules/
 * imports. `ProjetoTargetStatus` is redeclared locally to preserve the type
 * constraint without crossing the hexagonal boundary.
 */
export class ProjectStatusAdvanceError extends Error {
  override readonly name = 'ProjectStatusAdvanceError';

  constructor(
    readonly projetoId: string,
    readonly targetStatus: ProjetoTargetStatusDomain,
    readonly reason: string,
    cause?: Error,
  ) {
    super(
      `Failed to advance project ${projetoId} to "${targetStatus}": ${reason}`,
      { cause },
    );
  }
}
