/**
 * PublicationHistoryStub — in-memory fallback adapter for PublicationHistoryPort.
 *
 * Registered under PUBLICATION_HISTORY_PORT in P4. Replaced by the real HTTP
 * adapter (PubPublicationHistoryAdapter) once PUB service is scaffolded
 * (PROJ-INT-003).
 *
 * Behaviour:
 *   - `latest()` returns empty Map (no publications is coherent for most projects).
 *   - `history()` returns empty array.
 *   - `signedDownloadUrl()` returns a stub placeholder URL with a far-future expiry.
 *   - Logs WARN on every call to signal degraded-mode operation (D-480).
 *
 * RULE-05: infrastructure must not import modules/.
 * RULE-06: this file is the stub; the real HTTP client is in infrastructure/proj/read/.
 */

import { Logger } from '@nestjs/common';

import type {
  LatestPublicationSummary,
  PublicationHistoryPort,
  PublicationRecord,
  SignedDownloadUrlResult,
} from '../../../domain/proj/ports/outbound/publication-history.port';

export class PublicationHistoryStub implements PublicationHistoryPort {
  private readonly logger = new Logger(PublicationHistoryStub.name);

  async latest(
    projetoIds: string[],
    empresaId: string,
    _bearerToken?: string,
  ): Promise<Map<string, LatestPublicationSummary>> {
    if (projetoIds.length === 0) {
      return new Map();
    }
    this.logger.warn(
      `degraded:true port=PublicationHistoryPort#latest empresaId=${empresaId} ids=${projetoIds.length}`,
    );
    // No publications is coherent for projects that have never been exported.
    return new Map();
  }

  async history(
    projetoId: string,
    empresaId: string,
    _bearerToken?: string,
  ): Promise<PublicationRecord[]> {
    this.logger.warn(
      `degraded:true port=PublicationHistoryPort#history projetoId=${projetoId} empresaId=${empresaId}`,
    );
    return [];
  }

  async signedDownloadUrl(
    publicacaoId: string,
    _projetoId: string,
    empresaId: string,
    _bearerToken?: string,
  ): Promise<SignedDownloadUrlResult> {
    this.logger.warn(
      `degraded:true port=PublicationHistoryPort#signedDownloadUrl publicacaoId=${publicacaoId} empresaId=${empresaId}`,
    );
    // Stub URL — the real adapter mints a pre-signed storage URL.
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
    return {
      arquivoUrl: `https://stub.storage.cordele.local/epub/${publicacaoId}`,
      expiresAt,
    };
  }
}
