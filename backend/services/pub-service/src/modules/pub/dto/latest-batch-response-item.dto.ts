import { ApiProperty } from '@nestjs/swagger';
import { EpubcheckStatus } from '../../../domain/pub/epubcheck-status.enum';

export class LatestBatchResponseItemDto {
  @ApiProperty() projetoId!: string;
  @ApiProperty() publicacaoId!: string;
  @ApiProperty({ enum: EpubcheckStatus }) epubcheckStatus!: EpubcheckStatus;
}
