import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, IsArray, IsUUID } from 'class-validator';

/**
 * Request body for `POST /api/v1/comp/metadata/batch`.
 *
 * Used by PROJ's `CompProjectMetadataAdapter` to fetch author metadata for a
 * list of project IDs in a single HTTP call (COMP-017).
 *
 * Validation:
 *  - `projetoIds` must be an array of valid UUID v4 strings.
 *  - Empty array is valid — returns [] (no DB call is made).
 *  - Max 50 IDs per request (cross-module standard).
 *    Exceeding returns 400 with `type: urn:cordele:comp:validation`.
 */
export class MetadataBatchRequestDto {
  @ApiProperty({
    description: 'List of project UUIDs to fetch metadata for (max 50).',
    type: [String],
    format: 'uuid',
    example: ['00000000-0000-0000-0000-000000000001'],
    maxItems: 50,
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(50)
  readonly projetoIds!: string[];
}
