/**
 * GetPublicationHistoryUseCase — validates project ownership then delegates to
 * PublicationHistoryPort for the full publication history (T08).
 *
 * Business rules:
 *  - Returns 404 when projetoId does not exist or belongs to a different empresa.
 *  - History is ordered by criadoEm DESC (guaranteed by the port / PUB service).
 *  - Items with erros_criticos or pendente epubcheckStatus have arquivoUrl=null.
 *
 * RULE-04: this file is in modules/ and must NOT import from infrastructure/.
 */

import { Inject, Injectable, NotFoundException } from '@nestjs/common';

import type { ProjetoEditorialRepository } from '../../../domain/proj/projeto-editorial.repository';
import type {
  PublicationHistoryPort,
  PublicationRecord,
} from '../../../domain/proj/ports/outbound/publication-history.port';
import { PublicacaoHistoryItemDto } from '../dto/publicacao-history-item.dto';
import {
  PROJETO_EDITORIAL_REPOSITORY,
  PUBLICATION_HISTORY_PORT,
} from '../proj.tokens';

export interface GetPublicationHistoryInput {
  readonly projetoId: string;
  readonly empresaId: string;
  /** JWT bearer from the originating HTTP request, forwarded to PUB port. */
  readonly bearerToken?: string;
}

@Injectable()
export class GetPublicationHistoryUseCase {
  constructor(
    @Inject(PROJETO_EDITORIAL_REPOSITORY)
    private readonly repository: ProjetoEditorialRepository,
    @Inject(PUBLICATION_HISTORY_PORT)
    private readonly publicationPort: PublicationHistoryPort,
  ) {}

  async execute(input: GetPublicationHistoryInput): Promise<PublicacaoHistoryItemDto[]> {
    // Ownership check: cross-tenant projetoId must not leak any information.
    const exists = await this.repository.findById(input.projetoId, input.empresaId);
    if (!exists) {
      throw new NotFoundException(
        `ProjetoEditorial ${input.projetoId} not found`,
      );
    }

    const records = await this.publicationPort.history(
      input.projetoId,
      input.empresaId,
      input.bearerToken,
    );

    return records.map((r) => this.toDto(r));
  }

  private toDto(record: PublicationRecord): PublicacaoHistoryItemDto {
    const downloadable =
      record.epubcheckStatus === 'valido' || record.epubcheckStatus === 'avisos';
    return {
      publicacaoId: record.publicacaoId,
      projetoId: record.projetoId,
      epubcheckStatus: record.epubcheckStatus,
      totalErros: record.totalErros,
      totalAvisos: record.totalAvisos,
      erros: record.erros ?? null,
      arquivoUrl: downloadable ? (record.arquivoUrl ?? null) : null,
      criadoEm: record.criadoEm,
    };
  }
}
