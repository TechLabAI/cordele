import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { EpubcheckStatus } from '../../domain/pub/epubcheck-status.enum';
import type {
  LatestPublicationSummary,
  PublicationHistoryPort,
  PublicationRecord,
  SignedDownloadUrlResult,
} from '../../domain/pub/ports/publication-history.port';
import type { PublicacaoRepositoryPort } from '../../domain/pub/ports/publicacao-repository.port';
import { FILE_STORAGE_PORT, PUBLICACAO_REPOSITORY_PORT } from './pub.tokens';
import type { FileStoragePort } from './ports/file-storage.port';

/** Short TTL for PROJ's signed download URL (D-F, matches GetSignedDownloadUrlUseCase). */
const DOWNLOAD_URL_TTL_SECONDS = 300;

/**
 * PublicationHistoryService — in-process implementation of PublicationHistoryPort
 * (PUB-014, P6 — integration-contracts §1.1).
 *
 * Exported by PubModule under the PUBLICATION_HISTORY_PORT token so PROJ can
 * inject it directly in a co-located (monolith) deployment. In microservice
 * deployments PROJ uses the HTTP adapter (proj-service PubPublicationHistoryAdapter)
 * which calls PUB's REST endpoints backed by this service.
 *
 * RULE-04: this file is in modules/ and does NOT import from infrastructure/.
 *   It receives both ports via DI constructor injection.
 * RULE-07: empresaId is passed explicitly on every call — tenant schema isolation
 *   is enforced at the Prisma connection level (schema-per-empresa, ADR-003).
 *   empresaId is used here for logging/tracing only.
 */
@Injectable()
export class PublicationHistoryService implements PublicationHistoryPort {
  private readonly logger = new Logger(PublicationHistoryService.name);

  constructor(
    @Inject(PUBLICACAO_REPOSITORY_PORT)
    private readonly repository: PublicacaoRepositoryPort,
    @Inject(FILE_STORAGE_PORT)
    private readonly fileStorage: FileStoragePort,
  ) {}

  /**
   * Returns the latest publication summary per projetoId.
   * ONE batched repository call — no N+1 (integration-contracts §1.1).
   */
  async latest(
    projetoIds: string[],
    empresaId: string,
  ): Promise<Map<string, LatestPublicationSummary>> {
    if (projetoIds.length === 0) {
      return new Map();
    }

    this.logger.debug(
      `latest: querying ${projetoIds.length} projects empresaId=${empresaId}`,
    );

    const latestMap = await this.repository.findLatestByProjetoIds(projetoIds);

    const result = new Map<string, LatestPublicationSummary>();
    for (const [projetoId, entity] of latestMap) {
      result.set(projetoId, {
        publicacaoId: entity.id,
        epubcheckStatus: entity.epubcheckStatus as LatestPublicationSummary['epubcheckStatus'],
      });
    }
    return result;
  }

  /**
   * Returns the full publication history for one project, newest first.
   * `arquivoUrl` is always null — callers use `signedDownloadUrl()` on demand.
   */
  async history(
    projetoId: string,
    empresaId: string,
  ): Promise<PublicationRecord[]> {
    this.logger.debug(`history: projetoId=${projetoId} empresaId=${empresaId}`);

    const entities = await this.repository.listByProjeto(projetoId);

    return entities.map((entity) => ({
      publicacaoId: entity.id,
      projetoId: entity.projetoId,
      epubcheckStatus: entity.epubcheckStatus as PublicationRecord['epubcheckStatus'],
      totalErros: entity.totalErros,
      totalAvisos: entity.totalAvisos,
      erros: entity.resumoErro ?? null,
      arquivoUrl: null,
      criadoEm: entity.iniciadaEm.toISOString(),
    }));
  }

  /**
   * Mints a short-TTL signed URL for downloading the ePub artifact.
   * Throws NotFoundException when publicacaoId is not found or has no artifact.
   */
  async signedDownloadUrl(
    publicacaoId: string,
    empresaId: string,
  ): Promise<SignedDownloadUrlResult> {
    this.logger.debug(
      `signedDownloadUrl: publicacaoId=${publicacaoId} empresaId=${empresaId}`,
    );

    const entity = await this.repository.findByPublicacaoId(publicacaoId);
    if (!entity) {
      throw new NotFoundException(`urn:cordele:pub:publicacao-not-found:${publicacaoId}`);
    }

    const downloadable =
      entity.epubcheckStatus === EpubcheckStatus.VALIDO ||
      entity.epubcheckStatus === EpubcheckStatus.AVISOS;
    if (!downloadable || !entity.artefatoRef) {
      throw new NotFoundException(
        `urn:cordele:pub:artifact-not-available:${publicacaoId}`,
      );
    }

    const signed = await this.fileStorage.signUrl(entity.artefatoRef, DOWNLOAD_URL_TTL_SECONDS);
    return {
      arquivoUrl: signed.url,
      expiresAt: signed.expiresAt,
    };
  }
}
