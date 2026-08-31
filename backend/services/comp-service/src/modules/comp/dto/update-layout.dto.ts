import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Image-alignment override payload (write shape — api-contract §6.3, D-H).
 *
 * On write, `id` and `stale` are not supplied; they are server-assigned/computed.
 * `tipo = em-branco` is reserved (post-POC) and the API rejects it with 422 (D-H).
 */
export class LayoutOverrideInputDto {
  @ApiProperty({
    description: 'Reference to an existing manuscript node (read-only reference to IMP content tree).',
    example: 'img-017',
  })
  @IsString()
  @IsNotEmpty()
  readonly referenciaNo!: string;

  @ApiProperty({
    description:
      'Override type. Only "imagem" is accepted in the POC (D-H); "em-branco" yields 422.',
    enum: ['imagem', 'em-branco'],
    example: 'imagem',
  })
  @IsEnum(['imagem', 'em-branco'])
  readonly tipo!: 'imagem' | 'em-branco';

  @ApiPropertyOptional({
    description: 'Image alignment parameter honoured by the PUB stylesheet (§7.3).',
    enum: ['full', 'centralizado', 'junto-esquerda', 'junto-direita'],
    example: 'centralizado',
  })
  @IsOptional()
  @IsEnum(['full', 'centralizado', 'junto-esquerda', 'junto-direita'])
  readonly alinhamento?: 'full' | 'centralizado' | 'junto-esquerda' | 'junto-direita';

  @ApiProperty({ description: 'Position in the page sequence (int ≥ 0).', example: 1 })
  @IsInt()
  @Min(0)
  readonly ordem!: number;
}

/**
 * Payload for upserting layout configuration (T06).
 *
 * Maps to PUT /api/comp/projetos/{projetoId}/layout (api-contract §4.6).
 * Typography bounds are enforced by the domain (§7.2):
 *  fonteCorpoTamanho: 12–20px
 *  espacamentoLinha: 1.2–2.0
 *  margemLateral: 10–40mm
 *  h1Tamanho, h2Tamanho, h3Tamanho: 14–48px; h1 ≥ h2 ≥ h3.
 */
export class UpdateLayoutDto {
  @ApiProperty({
    description: 'Body font family.',
    enum: ['serif', 'sans-serif'],
    example: 'serif',
  })
  @IsEnum(['serif', 'sans-serif'])
  readonly fonteCorpoFamilia!: 'serif' | 'sans-serif';

  @ApiProperty({ description: 'Body font size in px (12–20).', minimum: 12, maximum: 20, example: 12 })
  @IsInt()
  @Min(12)
  @Max(20)
  readonly fonteCorpoTamanho!: number;

  @ApiProperty({ description: 'Line spacing multiplier (1.2–2.0).', minimum: 1.2, maximum: 2.0, example: 1.5 })
  @IsNumber()
  @Min(1.2)
  @Max(2.0)
  readonly espacamentoLinha!: number;

  @ApiProperty({ description: 'Side margin in mm (10–40).', minimum: 10, maximum: 40, example: 20 })
  @IsInt()
  @Min(10)
  @Max(40)
  readonly margemLateral!: number;

  @ApiProperty({ description: 'H1 size in px (14–48; ≥ h2Tamanho).', minimum: 14, maximum: 48, example: 28 })
  @IsInt()
  @Min(14)
  @Max(48)
  readonly h1Tamanho!: number;

  @ApiProperty({ description: 'H2 size in px (14–48; ≥ h3Tamanho).', minimum: 14, maximum: 48, example: 22 })
  @IsInt()
  @Min(14)
  @Max(48)
  readonly h2Tamanho!: number;

  @ApiProperty({ description: 'H3 size in px (14–48).', minimum: 14, maximum: 48, example: 18 })
  @IsInt()
  @Min(14)
  @Max(48)
  readonly h3Tamanho!: number;

  @ApiPropertyOptional({
    description: 'Image-alignment overrides (D-H). Full set replaces any existing overrides.',
    type: [LayoutOverrideInputDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LayoutOverrideInputDto)
  readonly overrides?: LayoutOverrideInputDto[];
}
