import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * Request body for `POST /api/v1/pub/publications/latest-batch`.
 *
 * Limit: max 50 IDs per request (cross-module standard).
 * Exceeding returns 400 with `type: urn:cordele:pub:validation`.
 */
export class LatestBatchRequestDto {
  @ApiProperty({
    type: [String],
    description: 'List of project UUIDs to query (max 50)',
    maxItems: 50,
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(50)
  projetoIds!: string[];
}
