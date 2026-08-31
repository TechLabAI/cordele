import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * View DTO for the Metadados aggregate (api-contract §6.1).
 *
 * Returned by:
 *  - GET  /api/comp/projetos/{projetoId}/metadados
 *  - PUT  /api/comp/projetos/{projetoId}/metadados
 *  - POST /api/comp/projetos/{projetoId}/capa (partial — only capaUrl + atualizadoEm)
 *
 * `materialized: false` indicates a synthesized default (D-M) — the row does not
 * exist in the database yet. `materialized: true` means it was persisted at least once.
 */
export class MetadadosViewDto {
  @ApiProperty({ description: 'Owning project UUID.', format: 'uuid' })
  readonly projetoId!: string;

  @ApiProperty({ description: 'Project title.', example: 'Romance das Cidades' })
  readonly titulo!: string;

  @ApiProperty({ description: 'Author name.', example: 'Eliana Moraes' })
  readonly autor!: string;

  @ApiPropertyOptional({
    description: 'ISBN (null when not supplied).',
    example: '978-85-1234-567-8',
    nullable: true,
  })
  readonly isbn!: string | null;

  @ApiProperty({
    description: 'Language code.',
    enum: ['pt', 'en', 'es', 'fr'],
    example: 'pt',
  })
  readonly idioma!: 'pt' | 'en' | 'es' | 'fr';

  @ApiPropertyOptional({
    description: 'Subject/category (null when not supplied).',
    nullable: true,
  })
  readonly categoria!: string | null;

  @ApiPropertyOptional({
    description: 'Cover image URL from FileStoragePort. Null when no cover uploaded (D-L).',
    nullable: true,
    example: 'https://storage.example.com/capa-romance.jpg',
  })
  readonly capaUrl!: string | null;

  @ApiPropertyOptional({
    description:
      'Publisher name (denormalized server-side display value; null when empresa has no name configured).',
    nullable: true,
  })
  readonly editoraNome!: string | null;

  @ApiProperty({
    description: 'Last updated timestamp (RFC 3339 UTC).',
    example: '2026-08-25T14:31:46Z',
  })
  readonly atualizadoEm!: string;

  @ApiProperty({
    description:
      'True when the record has been persisted at least once. False for a synthesized default (D-M).',
    example: true,
  })
  readonly materialized!: boolean;
}
