import { ApiProperty } from '@nestjs/swagger';

import { EpubcheckStatus } from '../../../domain/pub/epubcheck-status.enum';
import { PublicacaoStatus } from '../../../domain/pub/publicacao-status.enum';

/** KPI projection (api-contract.md §6.3 — T07/T08, D-O). */
export class PublicationStatsDto {
  @ApiProperty({ format: 'uuid' })
  projetoId!: string;

  @ApiProperty()
  total!: number;

  @ApiProperty()
  publicadas!: number;

  @ApiProperty()
  comAvisos!: number;

  @ApiProperty()
  comErros!: number;

  @ApiProperty()
  emAndamento!: number;

  @ApiProperty({ enum: PublicacaoStatus, nullable: true })
  ultimoStatus!: PublicacaoStatus | null;

  @ApiProperty({ enum: EpubcheckStatus, nullable: true })
  ultimoEpubcheckStatus!: EpubcheckStatus | null;

  @ApiProperty({ format: 'date-time', nullable: true })
  ultimaPublicacaoEm!: string | null;
}
