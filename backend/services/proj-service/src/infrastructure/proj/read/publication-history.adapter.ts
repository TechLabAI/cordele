/**
 * PubPublicationHistoryAdapter — real HTTP adapter for PublicationHistoryPort.
 *
 * Calls PUB service's endpoints to retrieve publication history and signed URLs.
 * Registered under PUBLICATION_HISTORY_PORT when PUB_SERVICE_URL is set (PROJ-INT-003).
 *
 * Error handling:
 *  - `latest()` and `history()` return empty collection on error (callers degrade).
 *  - `signedDownloadUrl()` propagates the error (the use case must handle it;
 *    a missing signed URL for a downloadable publication is a real failure).
 *
 * RULE-05: infrastructure must not import modules/.
 * RULE-06: outbound HTTP clients belong in infrastructure/.
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

  async latest(
    projetoIds: string[],
    empresaId: string,
  ): Promise<Map<string, LatestPublicationSummary>> {
    if (projetoIds.length === 0) {
      return new Map();
    }

    const baseUrl = this.config.get<string>('PUB_SERVICE_URL');
    if (!baseUrl) {
      this.logger.warn('PUB_SERVICE_URL not configured — returning empty latest');
      return new Map();
    }

    try {
      const response = await fetch(`${baseUrl}/api/v1/pub/publications/latest-batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Empresa-Id': empresaId,
        },
        body: JSON.stringify({ projetoIds }),
      });

      if (!response.ok) {
        this.logger.warn(`PUB latest-batch returned ${response.status} — degrading`);
        return new Map();
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
    } catch (err) {
      this.logger.warn(
        `PubPublicationHistoryAdapter#latest error — degrading: ${(err as Error).message}`,
      );
      return new Map();
    }
  }

  async history(
    projetoId: string,
    empresaId: string,
  ): Promise<PublicationRecord[]> {
    const baseUrl = this.config.get<string>('PUB_SERVICE_URL');
    if (!baseUrl) {
      this.logger.warn('PUB_SERVICE_URL not configured — returning empty history');
      return [];
    }

    try {
      const response = await fetch(
        `${baseUrl}/api/v1/pub/projetos/${projetoId}/publications`,
        {
          headers: { 'X-Empresa-Id': empresaId },
        },
      );

      if (!response.ok) {
        this.logger.warn(`PUB history returned ${response.status} — degrading`);
        return [];
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
    } catch (err) {
      this.logger.warn(
        `PubPublicationHistoryAdapter#history error — degrading: ${(err as Error).message}`,
      );
      return [];
    }
  }

  async signedDownloadUrl(
    publicacaoId: string,
    empresaId: string,
  ): Promise<SignedDownloadUrlResult> {
    const baseUrl = this.config.get<string>('PUB_SERVICE_URL');
    if (!baseUrl) {
      throw new Error('PUB_SERVICE_URL not configured — cannot mint signed URL');
    }

    const response = await fetch(
      `${baseUrl}/api/v1/pub/publications/${publicacaoId}/signed-url`,
      {
        headers: { 'X-Empresa-Id': empresaId },
      },
    );

    if (!response.ok) {
      throw new Error(`PUB signed-url returned ${response.status} for publication ${publicacaoId}`);
    }

    const data = (await response.json()) as PubSignedUrlResponse;
    return {
      arquivoUrl: data.arquivoUrl,
      expiresAt: data.expiresAt,
    };
  }
}
