import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Single item in the response array for `POST /api/v1/comp/metadata/batch`.
 *
 * Only projects that have a persisted `Metadados` row in the current empresa
 * are included. Projects with no row are **omitted** — absence signals
 * "no metadata" to the consumer (PROJ's CompProjectMetadataAdapter) rather
 * than returning an entry with all-null fields (COMP-017, api-contract §4.8).
 *
 * `autor` is a project-level editorial field and may be `null` when the user
 * has persisted a `Metadados` row but left the author blank (the consumer
 * already handles this with `item.autor ?? null`).
 */
export class MetadataBatchResponseItemDto {
  @ApiProperty({
    description: 'Project UUID.',
    format: 'uuid',
    example: '00000000-0000-0000-0000-000000000001',
  })
  readonly projetoId!: string;

  @ApiPropertyOptional({
    description: 'Author name from persisted Metadados. Null when author field is blank.',
    nullable: true,
    example: 'Eliana Moraes',
  })
  readonly autor!: string | null;
}
