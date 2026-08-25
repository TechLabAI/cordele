import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Response envelope for one project in the library list (T02).
 *
 * Aligned with api-contract.md §6.2 (ProjetoCard). Cross-context fields
 * (autor, totalCapitulos, totalImagens, ultimoEpubcheckStatus) are resolved
 * from outbound read ports in P4 (PROJ-010); stubs return null / 0 in P1.
 *
 * Controllers MUST return this DTO (never a Prisma model) at the HTTP boundary.
 */
export class ProjetoCardDto {
  @ApiProperty({ description: 'Unique project identifier (UUID v4).', format: 'uuid' })
  readonly id!: string;

  @ApiProperty({ description: 'Title of the editorial project.', maxLength: 200 })
  readonly nome!: string;

  /**
   * Author name from COMP metadata.
   * Null until COMP has composed metadata for the project.
   */
  @ApiPropertyOptional({
    nullable: true,
    description: 'Author name from COMP metadata. Null until metadata exists.',
  })
  readonly autor?: string | null;

  @ApiProperty({
    description: 'Lifecycle status of the project.',
    example: 'rascunho',
    enum: ['rascunho', 'em_composicao', 'publicado', 'com_erros'],
  })
  readonly status!: string;

  /**
   * Total number of chapters in the latest manuscript (IMP).
   * 0 while the project has no imported manuscript.
   */
  @ApiProperty({ description: 'Total chapters in the latest manuscript. 0 when no manuscript.', default: 0 })
  readonly totalCapitulos!: number;

  /**
   * Total number of images in the latest manuscript (IMP).
   * 0 while the project has no imported manuscript.
   */
  @ApiProperty({ description: 'Total images in the latest manuscript. 0 when no manuscript.', default: 0 })
  readonly totalImagens!: number;

  /**
   * epubcheck status of the latest publication (PUB).
   * Null when the project has never been exported.
   */
  @ApiPropertyOptional({
    nullable: true,
    description: 'epubcheck status of the latest publication. Null when never exported.',
    enum: ['valido', 'avisos', 'erros_criticos', 'pendente'],
  })
  readonly ultimoEpubcheckStatus?: string | null;

  @ApiProperty({
    description: 'ISO-8601 UTC timestamp of the last activity on this project.',
    format: 'date-time',
  })
  readonly ultimaAtividadeEm!: string;

  @ApiProperty({ description: 'ISO-8601 UTC creation timestamp.', format: 'date-time' })
  readonly criadoEm!: string;
}
