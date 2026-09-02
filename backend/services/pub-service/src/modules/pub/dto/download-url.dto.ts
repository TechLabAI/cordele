import { ApiProperty } from '@nestjs/swagger';

/** Signed download URL response (api-contract.md §4.4 — T08, D-F/D-R). */
export class DownloadUrlDto {
  @ApiProperty({ format: 'uuid' })
  publicacaoId!: string;

  @ApiProperty()
  arquivoUrl!: string;

  @ApiProperty({ format: 'date-time' })
  expiresAt!: string;
}
