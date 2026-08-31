import { Inject, Injectable, Logger } from '@nestjs/common';

import type {
  MetadadosDto,
  ProjectMetadataPort,
} from '../../../domain/ports/project-metadata.port';
import type { MetadadosRepository } from '../ports/metadados-repository.port';
import { COMP_METADADOS_REPO } from '../comp.tokens';

/**
 * Application use case implementing `ProjectMetadataPort` (COMP-017).
 *
 * Fetches metadata for multiple projects in a **single** `findManyByProjetoIds`
 * call — never a loop of findByProjetoId (no N+1). The heavy lifting
 * (batch query + tenant routing) is delegated to `MetadadosRepository`.
 *
 * Exported from CompModule via `COMP_PROJECT_METADATA_PORT` so PUB and PROJ
 * can inject it in-process without an HTTP call.
 *
 * Multi-empresa: schema routing is handled by the repository adapter via
 * AsyncLocalStorage (RULE-07). Callers must execute in a request context
 * where EmpresaContext is set (populated by EmpresaContextMiddleware).
 *
 * RULE-01/02: no @prisma/client or unconventional @nestjs imports — pure application layer.
 * RULE-04: does not import from infrastructure/ directly.
 */
@Injectable()
export class ProjectMetadataUseCase implements ProjectMetadataPort {
  private readonly logger = new Logger(ProjectMetadataUseCase.name);

  constructor(
    @Inject(COMP_METADADOS_REPO)
    private readonly metadadosRepo: MetadadosRepository,
  ) {}

  /**
   * Returns a map of projetoId → MetadadosDto for the requested project IDs.
   *
   * Uses a single repository call regardless of list size. Missing projects
   * (no row in DB) are absent from the returned map. Callers should treat
   * absence as `materialized=false`, consistent with the D-M lazy default.
   *
   * @param projetoIds  UUIDs of the projects to fetch.
   * @returns           Map keyed by projetoId; missing keys = not found.
   */
  async metadata(projetoIds: string[]): Promise<Map<string, MetadadosDto>> {
    if (projetoIds.length === 0) {
      return new Map();
    }

    this.logger.debug(`metadata batch count=${projetoIds.length}`);

    const entities = await this.metadadosRepo.findManyByProjetoIds(projetoIds);

    this.logger.debug(
      `metadata batch found=${entities.length} of requested=${projetoIds.length}`,
    );

    const result = new Map<string, MetadadosDto>();
    for (const entity of entities) {
      result.set(entity.projetoId, {
        projetoId: entity.projetoId,
        titulo: entity.titulo,
        autor: entity.autor,
        idioma: entity.idioma,
        isbn: entity.isbn,
        capaUrl: entity.capaUrl,
        materialized: entity.materialized,
      });
    }
    return result;
  }
}
