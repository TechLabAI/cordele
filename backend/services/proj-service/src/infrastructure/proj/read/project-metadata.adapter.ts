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
 * Chunking:
 *   projetoIds is split into blocks of CROSS_SERVICE_BATCH_LIMIT (50) because
 *   the COMP batch endpoint rejects requests larger than 50 IDs with HTTP 400
 *   (contractual limit, see COMP api-contract.md). Blocks are fetched in parallel
 *   via Promise.allSettled to reduce latency — see ImpManuscriptSummaryAdapter
 *   for rationale.
 *
 * Partial degradation:
 *   - All blocks succeed → returns merged Map, no exception.
 *   - Some blocks fail   → throws PartialResultError<Map<...>> carrying the data
 *     from successful blocks; callPort in the use case extracts the partial result
 *     and marks degraded=true.
 *   - All blocks fail    → throws Error; callPort marks degraded=true and returns
 *     the empty-Map fallback.
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
import { PartialResultError } from '../../../domain/shared/partial-result.error';
import { chunkArray, CROSS_SERVICE_BATCH_LIMIT } from './batch-chunk.util';

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

    const chunks = chunkArray(projetoIds, CROSS_SERVICE_BATCH_LIMIT);
    this.logger.log(
      `CompProjectMetadataAdapter: fetching ${projetoIds.length} ids in ${chunks.length} chunks`,
    );

    const settled = await Promise.allSettled(
      chunks.map((chunk, index) =>
        this.fetchChunk(baseUrl, headers, empresaId, chunk, index),
      ),
    );

    return this.mergeSettled(settled, chunks.length, empresaId);
  }

  private async fetchChunk(
    baseUrl: string,
    headers: Record<string, string>,
    empresaId: string,
    chunk: string[],
    chunkIndex: number,
  ): Promise<Map<string, ProjectMetadata>> {
    const url = `${baseUrl}/api/v1/comp/metadata/batch`;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ projetoIds: chunk }),
    });

    if (!response.ok) {
      throw new Error(
        `COMP metadata/batch chunk ${chunkIndex} returned ${response.status} for empresaId=${empresaId}`,
      );
    }

    const data = (await response.json()) as CompMetadataResponse[];
    const result = new Map<string, ProjectMetadata>();
    for (const item of data) {
      result.set(item.projetoId, { autor: item.autor ?? null });
    }
    return result;
  }

  private mergeSettled(
    settled: PromiseSettledResult<Map<string, ProjectMetadata>>[],
    totalChunks: number,
    empresaId: string,
  ): Map<string, ProjectMetadata> {
    const merged = new Map<string, ProjectMetadata>();
    let failedChunks = 0;
    let lastError: Error | undefined;

    for (const result of settled) {
      if (result.status === 'fulfilled') {
        for (const [k, v] of result.value) {
          merged.set(k, v);
        }
      } else {
        failedChunks++;
        lastError = result.reason as Error;
        this.logger.warn(
          `CompProjectMetadataAdapter: chunk failed for empresaId=${empresaId}: ${lastError.message}`,
        );
      }
    }

    if (failedChunks === 0) {
      return merged;
    }
    if (failedChunks === totalChunks) {
      throw lastError!;
    }
    throw new PartialResultError(merged, failedChunks, totalChunks, lastError);
  }
}
