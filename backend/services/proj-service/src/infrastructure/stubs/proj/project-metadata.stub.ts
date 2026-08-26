/**
 * ProjectMetadataStub — in-memory fallback adapter for ProjectMetadataPort.
 *
 * Registered under PROJECT_METADATA_PORT in P4. Replaced by the real HTTP
 * adapter (CompProjectMetadataAdapter) once COMP service is scaffolded
 * (PROJ-INT-002).
 *
 * Behaviour:
 *   - Returns a Map with `{ autor: null }` for each projetoId so that
 *     the library and detail views render without a COMP service dependency.
 *   - Logs WARN on every call to signal degraded-mode operation (D-480).
 *   - Empty input returns empty Map.
 *
 * RULE-05: infrastructure must not import modules/.
 * RULE-06: this file is the stub; the real HTTP client is in infrastructure/proj/read/.
 */

import { Logger } from '@nestjs/common';

import type {
  ProjectMetadata,
  ProjectMetadataPort,
} from '../../../domain/proj/ports/outbound/project-metadata.port';

export class ProjectMetadataStub implements ProjectMetadataPort {
  private readonly logger = new Logger(ProjectMetadataStub.name);

  async metadata(
    projetoIds: string[],
    empresaId: string,
  ): Promise<Map<string, ProjectMetadata>> {
    if (projetoIds.length === 0) {
      return new Map();
    }
    this.logger.warn(
      `degraded:true port=ProjectMetadataPort empresaId=${empresaId} ids=${projetoIds.length}`,
    );
    // Provide coherent defaults: projects without COMP metadata show null autor.
    const result = new Map<string, ProjectMetadata>();
    for (const id of projetoIds) {
      result.set(id, { autor: null });
    }
    return result;
  }
}
