/**
 * ImpManuscriptSummaryAdapter — real HTTP adapter for ManuscriptSummaryPort.
 *
 * Calls IMP service's internal batch-query endpoint to retrieve manuscript
 * summaries for a list of project IDs. Registered under MANUSCRIPT_SUMMARY_PORT
 * when the IMP_SERVICE_URL environment variable is set (env-flag switch in
 * proj.module.ts — PROJ-INT-001).
 *
 * RULE-05: infrastructure must not import modules/.
 * RULE-06: this is the correct place for outbound HTTP clients.
 *
 * Chunking:
 *   projetoIds is split into blocks of CROSS_SERVICE_BATCH_LIMIT (50) because
 *   the IMP batch endpoint rejects requests larger than 50 IDs with HTTP 400
 *   (contractual limit, see IMP api-contract.md). Blocks are fetched in parallel
 *   via Promise.allSettled to reduce latency — the use case already sequences
 *   the three adapters, so parallelism within an adapter avoids quadrupling the
 *   end-to-end time for large libraries (152 IDs = 4 blocks; 4 parallel fetches
 *   cost one network round-trip, not four).
 *
 * Partial degradation:
 *   - All blocks succeed → returns merged Map, no exception.
 *   - Some blocks fail   → throws PartialResultError<Map<...>> carrying the data
 *     from successful blocks; callPort in the use case extracts the partial result
 *     and marks degraded=true.
 *   - All blocks fail    → throws Error; callPort marks degraded=true and returns
 *     the empty-Map fallback.
 *
 * Bearer token is forwarded from the originating request so the IMP service
 * validates the same JWT principal and scope (imp:read). The header is mounted
 * only when a token is present; its value is never logged (security gate).
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  ManuscriptSummary,
  ManuscriptSummaryPort,
} from '../../../domain/proj/ports/outbound/manuscript-summary.port';
import { PartialResultError } from '../../../domain/shared/partial-result.error';
import { chunkArray, CROSS_SERVICE_BATCH_LIMIT } from './batch-chunk.util';

/**
 * Shape of the response from IMP's batch-query endpoint.
 */
interface ImpManuscriptResponse {
  projetoId: string;
  totalCapitulos: number;
  totalImagens: number;
}

@Injectable()
export class ImpManuscriptSummaryAdapter implements ManuscriptSummaryPort {
  private readonly logger = new Logger(ImpManuscriptSummaryAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async summaries(
    projetoIds: string[],
    empresaId: string,
    bearerToken?: string,
  ): Promise<Map<string, ManuscriptSummary>> {
    if (projetoIds.length === 0) {
      return new Map();
    }

    const baseUrl = this.config.get<string>('IMP_SERVICE_URL');
    if (!baseUrl) {
      throw new Error('IMP_SERVICE_URL not configured — cannot fetch manuscript summaries');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Empresa-Id': empresaId,
    };
    if (bearerToken) {
      headers['Authorization'] = `Bearer ${bearerToken}`;
      this.logger.debug('ImpManuscriptSummaryAdapter: Authorization header mounted');
    }

    const chunks = chunkArray(projetoIds, CROSS_SERVICE_BATCH_LIMIT);
    this.logger.log(
      `ImpManuscriptSummaryAdapter: fetching ${projetoIds.length} ids in ${chunks.length} chunks`,
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
  ): Promise<Map<string, ManuscriptSummary>> {
    const url = `${baseUrl}/api/v1/imp/manuscripts/summaries`;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ projetoIds: chunk }),
    });

    if (!response.ok) {
      throw new Error(
        `IMP manuscripts/summaries chunk ${chunkIndex} returned ${response.status} for empresaId=${empresaId}`,
      );
    }

    const data = (await response.json()) as ImpManuscriptResponse[];
    const result = new Map<string, ManuscriptSummary>();
    for (const item of data) {
      result.set(item.projetoId, {
        totalCapitulos: item.totalCapitulos,
        totalImagens: item.totalImagens,
      });
    }
    return result;
  }

  private mergeSettled(
    settled: PromiseSettledResult<Map<string, ManuscriptSummary>>[],
    totalChunks: number,
    empresaId: string,
  ): Map<string, ManuscriptSummary> {
    const merged = new Map<string, ManuscriptSummary>();
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
          `ImpManuscriptSummaryAdapter: chunk failed for empresaId=${empresaId}: ${lastError.message}`,
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
