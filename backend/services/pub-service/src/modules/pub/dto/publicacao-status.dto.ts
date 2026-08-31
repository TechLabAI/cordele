import { ApiProperty } from '@nestjs/swagger';

import { EpubcheckStatus } from '../../../domain/pub/epubcheck-status.enum';
import { PublicacaoStatus } from '../../../domain/pub/publicacao-status.enum';

/** Trigger + poll response shape (api-contract.md §6.1 — T07). */
export class PublicacaoStatusDto {
  @ApiProperty({ format: 'uuid' })
  publicacaoId!: string;

  @ApiProperty({ format: 'uuid' })
  projetoId!: string;

  @ApiProperty({ enum: PublicacaoStatus })
  status!: PublicacaoStatus;

  @ApiProperty({ enum: EpubcheckStatus })
  epubcheckStatus!: EpubcheckStatus;

  @ApiProperty()
  sequencia!: number;

  @ApiProperty()
  totalErros!: number;

  @ApiProperty()
  totalAvisos!: number;

  @ApiProperty({ nullable: true })
  resumoErro!: string | null;

  @ApiProperty()
  arquivoDisponivel!: boolean;

  @ApiProperty({ format: 'date-time' })
  iniciadaEm!: string;

  @ApiProperty({ format: 'date-time', nullable: true })
  concluidaEm!: string | null;
}
