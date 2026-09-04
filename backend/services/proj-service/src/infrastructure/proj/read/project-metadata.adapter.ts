/**
 * CompProjectMetadataAdapter — real HTTP adapter for ProjectMetadataPort.
 *
 * Calls COMP service's batch-query endpoint to retrieve editorial metadata
 * (author, layout, etc.) for a list of project IDs. Registered under
 * PROJECT_METADATA_PORT when COMP_SERVICE_URL is set (PROJ-INT-002).
 *
 * RULE-05: infrastructure must not import modules/.
 * RULE-06: outbound HTTP clients belong in infrastructure/.
 *
 * Degradation contract:
 *   - Empty projetoIds → returns empty Map (legitimate, not a degradation).
 *   - Missing COMP_SERVICE_URL → throws Error (callPort in use case marks degraded).
 *   - Non-2xx HTTP response → throws Error (callPort in use case marks degraded).
 *   - Network/fetch error → propagates (callPort in use case marks degraded).
 *
 * Bearer token is forwarded from the originating request so the COMP service
 * validates the same JWT principal and scope (comp:read). The header is mounted
 * only when a token is present; its value is never logged (security gate).
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  ProjectMetadata,
  ProjectMetadataPort,
} from '../../../domain/proj/ports/outbound/project-metadata.port';

/**
 * Shape of the response from COMP's batch-query endpoint.
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
    bearerToken?: string,
  ): Promise<Map<string, ProjectMetadata>> {
    if (projetoIds.length === 0) {
      return new Map();
    }

    const baseUrl = this.config.get<string>('COMP_SERVICE_URL');
    if (!baseUrl) {
      throw new Error('COMP_SERVICE_URL not configured — cannot fetch project metadata');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Empresa-Id': empresaId,
    };
    if (bearerToken) {
      headers['Authorization'] = `Bearer ${bearerToken}`;
      this.logger.debug('CompProjectMetadataAdapter: Authorization header mounted');
    }

    const url = `${baseUrl}/api/v1/comp/metadata/batch`;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ projetoIds }),
    });

    if (!response.ok) {
      throw new Error(
        `COMP metadata/batch returned ${response.status} for empresaId=${empresaId}`,
      );
    }

    const data = (await response.json()) as CompMetadataResponse[];
    const result = new Map<string, ProjectMetadata>();
    for (const item of data) {
      result.set(item.projetoId, { autor: item.autor ?? null });
    }
    return result;
  }
}
