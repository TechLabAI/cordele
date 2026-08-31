import { ApiProperty } from '@nestjs/swagger';

import { EpubcheckStatus } from '../../../domain/pub/epubcheck-status.enum';

/**
 * One publication history row (api-contract.md §6.2 — T08).
 *
 * Identical field set to what PROJ's `PublicationHistoryPort` returns
 * (proj api-contract §6.3 / integration-contracts §2.3); this contract is
 * the authoritative source of the shape.
 */
export class PublicacaoHistoryItemDto {
  @ApiProperty({ format: 'uuid' })
  publicacaoId!: string;

  @ApiProperty({ format: 'uuid' })
  projetoId!: string;

  @ApiProperty({ enum: EpubcheckStatus })
  epubcheckStatus!: EpubcheckStatus;

  @ApiProperty()
  totalErros!: number;

  @ApiProperty()
  totalAvisos!: number;

  @ApiProperty({ nullable: true })
  erros!: string | null;

  @ApiProperty({ nullable: true })
  arquivoUrl!: string | null;

  @ApiProperty({ format: 'date-time' })
  criadoEm!: string;
}
