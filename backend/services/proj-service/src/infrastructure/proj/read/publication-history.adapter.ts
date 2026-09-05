/**
 * PubPublicationHistoryAdapter — real HTTP adapter for PublicationHistoryPort.
 *
 * Calls PUB service's endpoints to retrieve publication history and signed URLs.
 * Registered under PUBLICATION_HISTORY_PORT when PUB_SERVICE_URL is set (PROJ-INT-003).
 *
 * RULE-05: infrastructure must not import modules/.
 * RULE-06: outbound HTTP clients belong in infrastructure/.
 *
 * Chunking (latest() only):
 *   projetoIds in latest() is split into blocks of CROSS_SERVICE_BATCH_LIMIT (50)
 *   because the PUB batch endpoint rejects requests larger than 50 IDs with HTTP 400
 *   (contractual limit, see PUB api-contract.md). Blocks are fetched in parallel
 *   via Promise.allSettled to reduce latency — see ImpManuscriptSummaryAdapter
 *   for rationale.
 *   history() and signedDownloadUrl() operate on a single projetoId and do not need
 *   chunking.
 *
 * Partial degradation (latest() only):
 *   - All blocks succeed → returns merged Map, no exception.
 *   - Some blocks fail   → throws PartialResultError<Map<...>> carrying the data
 *     from successful blocks; callPort in the use case extracts the partial result
 *     and marks degraded=true.
 *   - All blocks fail    → throws Error; callPort marks degraded=true and returns
 *     the empty-Map fallback.
 *
 * PUB endpoint mapping (real contract as of 2026-09-04):
 *   - latest()           → POST /api/v1/pub/publications/latest-batch
 *   - history()          → GET  /api/v1/pub/projetos/{projetoId}/publicacoes
 *   - signedDownloadUrl() → GET  /api/v1/pub/projetos/{projetoId}/publicacoes/{publicacaoId}/download
 *
 * Bearer token is forwarded from the originating request so the PUB service
 * validates the same JWT principal and scope (pub:read). The header is mounted
 * only when a token is present; its value is never logged (security gate).
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  LatestPublicationSummary,
  PublicationHistoryPort,
  PublicationRecord,
  SignedDownloadUrlResult,
} from '../../../domain/proj/ports/outbound/publication-history.port';
import { PartialResultError } from '../../../domain/shared/partial-result.error';
import { chunkArray, CROSS_SERVICE_BATCH_LIMIT } from './batch-chunk.util';

/** PUB batch-latest response shape. */
interface PubLatestResponse {
  projetoId: string;
  publicacaoId: string;
  epubcheckStatus: 'valido' | 'avisos' | 'erros_criticos' | 'pendente';
}

/** PUB history item response shape. */
interface PubHistoryItem {
  publicacaoId: string;
  projetoId: string;
  epubcheckStatus: 'valido' | 'avisos' | 'erros_criticos' | 'pendente';
  totalErros: number;
  totalAvisos: number;
  erros?: string | null;
  arquivoUrl?: string | null;
  criadoEm: string;
}

/** PUB signed-URL response shape. */
interface PubSignedUrlResponse {
  arquivoUrl: string;
  expiresAt: string;
}

@Injectable()
export class PubPublicationHistoryAdapter implements PublicationHistoryPort {
  private readonly logger = new Logger(PubPublicationHistoryAdapter.name);

  constructor(private readonly config: ConfigService) {}

  /** Build auth headers, mounting Authorization only when a token is present. */
  private buildHeaders(bearerToken?: string): Record<string, string> {
    const headers: Record<string, string> = {};
    if (bearerToken) {
      headers['Authorization'] = `Bearer ${bearerToken}`;
      this.logger.debug('PubPublicationHistoryAdapter: Authorization header mounted');
    }
    return headers;
  }

  async latest(
    projetoIds: string[],
    empresaId: string,
    bearerToken?: string,
  ): Promise<Map<string, LatestPublicationSummary>> {
    if (projetoIds.length === 0) {
      return new Map();
    }

    const baseUrl = this.config.get<string>('PUB_SERVICE_URL');
    if (!baseUrl) {
      throw new Error('PUB_SERVICE_URL not configured — cannot fetch latest publications');
    }

    const chunks = chunkArray(projetoIds, CROSS_SERVICE_BATCH_LIMIT);
    this.logger.log(
      `PubPublicationHistoryAdapter: fetching ${projetoIds.length} ids in ${chunks.length} chunks`,
    );

    const settled = await Promise.allSettled(
      chunks.map((chunk, index) =>
        this.fetchLatestChunk(baseUrl, empresaId, chunk, index, bearerToken),
      ),
    );

    return this.mergeSettled(settled, chunks.length, empresaId);
  }

  private async fetchLatestChunk(
    baseUrl: string,
    empresaId: string,
    chunk: string[],
    chunkIndex: number,
    bearerToken?: string,
  ): Promise<Map<string, LatestPublicationSummary>> {
    const response = await fetch(`${baseUrl}/api/v1/pub/publications/latest-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.buildHeaders(bearerToken),
      },
      body: JSON.stringify({ projetoIds: chunk }),
    });

    if (!response.ok) {
      throw new Error(
        `PUB publications/latest-batch chunk ${chunkIndex} returned ${response.status} for empresaId=${empresaId}`,
      );
    }

    const data = (await response.json()) as PubLatestResponse[];
    const result = new Map<string, LatestPublicationSummary>();
    for (const item of data) {
      result.set(item.projetoId, {
        publicacaoId: item.publicacaoId,
        epubcheckStatus: item.epubcheckStatus,
      });
    }
    return result;
  }

  private mergeSettled(
    settled: PromiseSettledResult<Map<string, LatestPublicationSummary>>[],
    totalChunks: number,
    empresaId: string,
  ): Map<string, LatestPublicationSummary> {
    const merged = new Map<string, LatestPublicationSummary>();
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
          `PubPublicationHistoryAdapter: chunk failed for empresaId=${empresaId}: ${lastError.message}`,
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

  async history(
    projetoId: string,
    empresaId: string,
    bearerToken?: string,
  ): Promise<PublicationRecord[]> {
    const baseUrl = this.config.get<string>('PUB_SERVICE_URL');
    if (!baseUrl) {
      throw new Error('PUB_SERVICE_URL not configured — cannot fetch publication history');
    }

    const response = await fetch(
      `${baseUrl}/api/v1/pub/projetos/${projetoId}/publicacoes`,
      { headers: this.buildHeaders(bearerToken) },
    );

    if (!response.ok) {
      throw new Error(
        `PUB projetos/${projetoId}/publicacoes returned ${response.status} for empresaId=${empresaId}`,
      );
    }

    const data = (await response.json()) as PubHistoryItem[];
    return data.map((item) => ({
      publicacaoId: item.publicacaoId,
      projetoId: item.projetoId,
      epubcheckStatus: item.epubcheckStatus,
      totalErros: item.totalErros,
      totalAvisos: item.totalAvisos,
      erros: item.erros ?? null,
      arquivoUrl: item.arquivoUrl ?? null,
      criadoEm: item.criadoEm,
    }));
  }

  async signedDownloadUrl(
    publicacaoId: string,
    projetoId: string,
    empresaId: string,
    bearerToken?: string,
  ): Promise<SignedDownloadUrlResult> {
    const baseUrl = this.config.get<string>('PUB_SERVICE_URL');
    if (!baseUrl) {
      throw new Error('PUB_SERVICE_URL not configured — cannot mint signed URL');
    }

    const response = await fetch(
      `${baseUrl}/api/v1/pub/projetos/${projetoId}/publicacoes/${publicacaoId}/download`,
      { headers: this.buildHeaders(bearerToken) },
    );

    if (!response.ok) {
      throw new Error(
        `PUB projetos/${projetoId}/publicacoes/${publicacaoId}/download returned ${response.status}`,
      );
    }

    const data = (await response.json()) as PubSignedUrlResponse;
    return {
      arquivoUrl: data.arquivoUrl,
      expiresAt: data.expiresAt,
    };
  }
}
