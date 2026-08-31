import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Payload for upserting editorial metadata (T05).
 *
 * Maps to PUT /api/comp/projetos/{projetoId}/metadados (api-contract §4.2).
 * capaUrl is NOT accepted here — it is managed exclusively by the cover endpoints.
 */
export class UpdateMetadadosDto {
  @ApiProperty({
    description: 'Project title. Required, non-empty, ≤ 300 chars.',
    maxLength: 300,
    example: 'Romance das Cidades',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  readonly titulo!: string;

  @ApiProperty({
    description: 'Author name. Required, non-empty, ≤ 300 chars.',
    maxLength: 300,
    example: 'Eliana Moraes',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(300)
  readonly autor!: string;

  @ApiProperty({
    description: 'Language code. Required. One of: pt, en, es, fr.',
    enum: ['pt', 'en', 'es', 'fr'],
    example: 'pt',
  })
  @IsEnum(['pt', 'en', 'es', 'fr'])
  readonly idioma!: 'pt' | 'en' | 'es' | 'fr';

  @ApiPropertyOptional({
    description: 'ISBN (optional, source: mock — no registry lookup in the POC).',
    example: '978-85-1234-567-8',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  readonly isbn?: string | null;

  @ApiPropertyOptional({
    description: 'Subject/category (optional, source: mock).',
    example: 'Literatura Brasileira',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  readonly categoria?: string | null;
}
