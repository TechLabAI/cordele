import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * One item in the publication history read-model (T08).
 *
 * Aligned with api-contract.md §6.3 (PublicacaoHistoryItem). This is a
 * read-projection assembled from PUB's Publicacao records via
 * PublicationHistoryPort (ADR-003 / D-E). PROJ stores no publication rows.
 *
 * Controllers MUST return this DTO (never a Prisma model) at the HTTP boundary.
 */
export class PublicacaoHistoryItemDto {
  @ApiProperty({ description: 'Unique publication identifier (UUID v4).', format: 'uuid' })
  readonly publicacaoId!: string;

  @ApiProperty({ description: 'Owning project identifier (UUID v4).', format: 'uuid' })
  readonly projetoId!: string;

  @ApiProperty({
    description: 'epubcheck validation outcome for this publication.',
    enum: ['valido', 'avisos', 'erros_criticos', 'pendente'],
  })
  readonly epubcheckStatus!: string;

  @ApiProperty({ description: 'Total number of critical epubcheck errors.', default: 0 })
  readonly totalErros!: number;

  @ApiProperty({ description: 'Total number of epubcheck warnings.', default: 0 })
  readonly totalAvisos!: number;

  /**
   * Human-readable summary of critical errors (nullable).
   * Surfaced on T08 for erros_criticos publications.
   */
  @ApiPropertyOptional({
    nullable: true,
    description: 'Human-readable summary of critical errors. Null when no errors.',
  })
  readonly erros?: string | null;

  /**
   * URL to the ePub artifact in object storage.
   *
   * - `null` for publications whose epubcheckStatus is erros_criticos or pendente
   *   (no downloadable artifact — D-F).
   * - A placeholder marker or short-TTL signed URL when the status is valido or avisos.
   *   The authoritative minting path is GET /projetos/{id}/publicacoes/{pid}/download (§4.5).
   */
  @ApiPropertyOptional({
    nullable: true,
    description: 'Signed ePub artifact URL. Null for non-downloadable publications.',
  })
  readonly arquivoUrl?: string | null;

  @ApiProperty({ description: 'ISO-8601 UTC creation timestamp of the publication.', format: 'date-time' })
  readonly criadoEm!: string;
}
