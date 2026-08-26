/**
 * CompProjectMetadataAdapter — real HTTP adapter for ProjectMetadataPort.
 *
 * Calls COMP service's batch-query endpoint to retrieve editorial metadata
 * (author, layout, etc.) for a list of project IDs. Registered under
 * PROJECT_METADATA_PORT when COMP_SERVICE_URL is set (PROJ-INT-002).
 *
 * Error handling: on any HTTP failure, returns empty Map (callers degrade
 * gracefully — SPEC-07).
 *
 * RULE-05: infrastructure must not import modules/.
 * RULE-06: outbound HTTP clients belong in infrastructure/.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  ProjectMetadata,
  ProjectMetadataPort,
} from '../../../domain/proj/ports/outbound/project-metadata.port';

/**
 * Shape of the response from COMP's batch-query endpoint.
 * Adjust to match COMP's actual contract when COMP is scaffolded.
 */
interface CompMetadataResponse {
  projetoId: string;
  autor?: string | null;
}

@Injectable()
export class CompProjectMetadataAdapter implements ProjectMetadataPort {
  private readonly logger = new Logger(CompProjectMetadataAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async metadata(
    projetoIds: string[],
    empresaId: string,
  ): Promise<Map<string, ProjectMetadata>> {
    if (projetoIds.length === 0) {
      return new Map();
    }

    const baseUrl = this.config.get<string>('COMP_SERVICE_URL');
    if (!baseUrl) {
      this.logger.warn('COMP_SERVICE_URL not configured — returning empty metadata');
      return new Map();
    }

    try {
      const url = `${baseUrl}/api/v1/comp/metadata/batch`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Empresa-Id': empresaId,
        },
        body: JSON.stringify({ projetoIds }),
      });

      if (!response.ok) {
        this.logger.warn(
          `COMP metadata batch returned ${response.status} — degrading`,
        );
        return new Map();
      }

      const data = (await response.json()) as CompMetadataResponse[];
      const result = new Map<string, ProjectMetadata>();
      for (const item of data) {
        result.set(item.projetoId, { autor: item.autor ?? null });
      }
      return result;
    } catch (err) {
      this.logger.warn(
        `CompProjectMetadataAdapter error — degrading: ${(err as Error).message}`,
      );
      return new Map();
    }
  }
}
