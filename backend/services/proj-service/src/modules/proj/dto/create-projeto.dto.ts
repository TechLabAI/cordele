import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/**
 * Payload for creating an editorial project.
 *
 * Aligned with api-contract.md §4.1:
 *   { "nome": "Romance das Cidades", "descricao": "optional" }
 *
 * `editoraId` is NOT here; it is resolved from the JWT tenant claim (RULE-07).
 * The global ValidationPipe (whitelist + forbidNonWhitelisted) rejects any
 * property not declared in this class.
 */
export class CreateProjetoDto {
  @ApiProperty({
    description: 'Title of the editorial project.',
    example: 'Romance das Cidades',
    maxLength: 200,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(1)
  @MaxLength(200)
  readonly nome!: string;

  @ApiPropertyOptional({
    description: 'Optional description of the project.',
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  readonly descricao?: string;
}
