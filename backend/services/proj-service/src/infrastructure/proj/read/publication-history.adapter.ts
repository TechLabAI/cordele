/**
 * PubPublicationHistoryAdapter — real HTTP adapter for PublicationHistoryPort.
 *
 * Calls PUB service's endpoints to retrieve publication history and signed URLs.
 * Registered under PUBLICATION_HISTORY_PORT when PUB_SERVICE_URL is set (PROJ-INT-003).
 *
 * RULE-05: infrastructure must not import modules/.
 * RULE-06: outbound HTTP clients belong in infrastructure/.
 *
 * Degradation contract:
 *   - Empty projetoIds (latest) → returns empty Map (legitimate, not a degradation).
 *   - Missing PUB_SERVICE_URL → throws Error (callPort in use case marks degraded;
 *     signedDownloadUrl propagates as a real failure since URL minting is critical).
 *   - Non-2xx HTTP response → throws Error (callPort in use case marks degraded;
 *     signedDownloadUrl propagates).
 *   - Network/fetch error → propagates.
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
  private buildHeaders(empresaId: string, bearerToken?: string): Record<string, string> {
    const headers: Record<string, string> = { 'X-Empresa-Id': empresaId };
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

    const response = await fetch(`${baseUrl}/api/v1/pub/publications/latest-batch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.buildHeaders(empresaId, bearerToken),
      },
      body: JSON.stringify({ projetoIds }),
    });

    if (!response.ok) {
      throw new Error(
        `PUB publications/latest-batch returned ${response.status} for empresaId=${empresaId}`,
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
      { headers: this.buildHeaders(empresaId, bearerToken) },
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
      { headers: this.buildHeaders(empresaId, bearerToken) },
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
