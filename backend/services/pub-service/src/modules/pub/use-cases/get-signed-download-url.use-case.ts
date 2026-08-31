import { ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { EpubcheckStatus } from '../../../domain/pub/epubcheck-status.enum';
import { type AuthenticatedUser } from '../../../domain/auth/authenticated-user';
import { FILE_STORAGE_PORT, PUBLICACAO_REPOSITORY_PORT } from '../pub.tokens';
import { type FileStoragePort } from '../ports/file-storage.port';
import { type PublicacaoRepositoryPort } from '../ports/publicacao-repository.port';

export interface GetSignedDownloadUrlInput {
  readonly projetoId: string;
  readonly publicacaoId: string;
}

export interface SignedDownloadUrlResult {
  readonly publicacaoId: string;
  readonly arquivoUrl: string;
  readonly expiresAt: string;
}

/** Short TTL for the minted download URL (D-F/D-R). */
const DOWNLOAD_URL_TTL_SECONDS = 300;

/**
 * GetSignedDownloadUrlUseCase — mint a short-TTL signed download URL
 * (api-contract §4.4, T08, D-F/D-R). Also backs PROJ's
 * `PublicationHistoryPort.signedDownloadUrl` (exported in P6).
 *
 * PUB never streams the `.epub` bytes through the app — only a signed URL.
 *
 * RULE-07: requires the empresa context before touching the repository.
 */
@Injectable()
export class GetSignedDownloadUrlUseCase {
  constructor(
    @Inject(PUBLICACAO_REPOSITORY_PORT)
    private readonly repository: PublicacaoRepositoryPort,
    @Inject(FILE_STORAGE_PORT)
    private readonly fileStoragePort: FileStoragePort,
  ) {}

  async execute(
    input: GetSignedDownloadUrlInput,
    user: AuthenticatedUser,
  ): Promise<SignedDownloadUrlResult> {
    if (!user?.empresaId) {
      throw new ForbiddenException('Token carries no empresa claim');
    }

    const publicacao = await this.repository.findById(input.projetoId, input.publicacaoId);
    if (!publicacao) {
      throw new NotFoundException('urn:cordele:pub:publicacao-not-found');
    }

    const downloadable =
      publicacao.epubcheckStatus === EpubcheckStatus.VALIDO ||
      publicacao.epubcheckStatus === EpubcheckStatus.AVISOS;
    if (!downloadable || !publicacao.artefatoRef) {
      throw new ConflictException('urn:cordele:pub:artifact-not-available');
    }

    const signed = await this.fileStoragePort.signUrl(publicacao.artefatoRef, DOWNLOAD_URL_TTL_SECONDS);
    return {
      publicacaoId: publicacao.id,
      arquivoUrl: signed.url,
      expiresAt: signed.expiresAt,
    };
  }
}
