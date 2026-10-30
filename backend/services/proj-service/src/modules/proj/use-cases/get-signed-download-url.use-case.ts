/**
 * GetSignedDownloadUrlUseCase — obtains a short-TTL signed URL for downloading
 * an ePub artifact (api-contract §4.5 / D-F).
 *
 * Business rules (PROJ-013 / SPEC-06 clause 4):
 *  - Only publications with epubcheckStatus `valido` or `avisos` are downloadable.
 *  - `erros_criticos` and `pendente` → throw ArtifactNotAvailableError (maps to 409).
 *  - The use case validates ownership and status; PublicationHistoryPort mints the URL.
 *  - PROJ never proxies bytes — the signed URL is returned to the SPA for direct use.
 *
 * RULE-04: this file is in modules/ and must NOT import from infrastructure/.
 */

import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import type { ProjetoEditorialRepository } from '../../../domain/proj/projeto-editorial.repository';
import type { PublicationHistoryPort } from '../../../domain/proj/ports/outbound/publication-history.port';
import { SignedDownloadUrlDto } from '../dto/signed-download-url.dto';
import {
  PROJETO_EDITORIAL_REPOSITORY,
  PUBLICATION_HISTORY_PORT,
} from '../proj.tokens';

/** Epubcheck statuses from which a download is allowed. */
const DOWNLOADABLE_STATUSES = new Set(['valido', 'avisos']);

export interface GetSignedDownloadUrlInput {
  readonly projetoId: string;
  readonly publicacaoId: string;
  readonly empresaId: string;
  /** JWT bearer from the originating HTTP request, forwarded to PUB port. */
  readonly bearerToken?: string;
}

@Injectable()
export class GetSignedDownloadUrlUseCase {
  private readonly logger = new Logger(GetSignedDownloadUrlUseCase.name);

  constructor(
    @Inject(PROJETO_EDITORIAL_REPOSITORY)
    private readonly repository: ProjetoEditorialRepository,
    @Inject(PUBLICATION_HISTORY_PORT)
    private readonly publicationPort: PublicationHistoryPort,
  ) {}

  async execute(input: GetSignedDownloadUrlInput): Promise<SignedDownloadUrlDto> {
    // 1. Ownership check — returns null for cross-tenant or non-existent project.
    const project = await this.repository.findById(input.projetoId, input.empresaId);
    if (!project) {
      throw new NotFoundException(
        `ProjetoEditorial ${input.projetoId} not found`,
      );
    }

    // 2. Fetch publication history to validate this publication belongs here.
    const records = await this.publicationPort.history(
      input.projetoId,
      input.empresaId,
      input.bearerToken,
    );
    const record = records.find((r) => r.publicacaoId === input.publicacaoId);
    if (!record) {
      throw new NotFoundException(
        `Publicacao ${input.publicacaoId} not found for project ${input.projetoId}`,
      );
    }

    // 3. Guard: only valido|avisos are downloadable.
    if (!DOWNLOADABLE_STATUSES.has(record.epubcheckStatus)) {
      throw new ConflictException({
        message: `Publication ${input.publicacaoId} is not downloadable: epubcheckStatus is '${record.epubcheckStatus}'`,
        type: 'urn:cordele:proj:artifact-not-available',
        publicacaoId: input.publicacaoId,
        epubcheckStatus: record.epubcheckStatus,
      });
    }

    // 4. Mint the signed URL (port delegates to PUB / storage service).
    const signed = await this.publicationPort.signedDownloadUrl(
      input.publicacaoId,
      input.projetoId,
      input.empresaId,
      input.bearerToken,
    );

    this.logger.log(
      `Signed URL minted for publication ${input.publicacaoId}, expires ${signed.expiresAt}`,
    );

    return {
      publicacaoId: input.publicacaoId,
      arquivoUrl: signed.arquivoUrl,
      expiresAt: signed.expiresAt,
    };
  }
}
