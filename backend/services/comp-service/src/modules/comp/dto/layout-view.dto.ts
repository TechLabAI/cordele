import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Read shape of a layout override (api-contract §6.3).
 *
 * On read, `id` (server-assigned UUID) and `stale` (computed flag) are included.
 */
export class LayoutOverrideViewDto {
  @ApiProperty({ description: 'Server-assigned UUID for this override.', format: 'uuid' })
  readonly id!: string;

  @ApiProperty({
    description: 'Reference to a manuscript content tree node.',
    example: 'img-017',
  })
  readonly referenciaNo!: string;

  @ApiProperty({
    description: 'Override type. MVP always "imagem".',
    enum: ['imagem', 'em-branco'],
    example: 'imagem',
  })
  readonly tipo!: 'imagem' | 'em-branco';

  @ApiPropertyOptional({
    description: 'Image alignment parameter honoured by the PUB stylesheet.',
    enum: ['full', 'centralizado', 'junto-esquerda', 'junto-direita'],
    nullable: true,
  })
  readonly alinhamento!: 'full' | 'centralizado' | 'junto-esquerda' | 'junto-direita' | null;

  @ApiProperty({ description: 'Position in page sequence (int ≥ 0).', example: 1 })
  readonly ordem!: number;

  @ApiProperty({
    description:
      'True when referenciaNo no longer resolves in the current manuscript content tree (D-K). ' +
      'Stale overrides are excluded from what PUB honours.',
    example: false,
  })
  readonly stale!: boolean;
}

/**
 * View DTO for the ConfiguracaoLayout aggregate (api-contract §6.2).
 *
 * Returned by:
 *  - GET /api/comp/projetos/{projetoId}/layout
 *  - PUT /api/comp/projetos/{projetoId}/layout
 *
 * `materialized: false` means the row has never been persisted (synthesized default, D-M).
 */
export class LayoutViewDto {
  @ApiProperty({ description: 'Owning project UUID.', format: 'uuid' })
  readonly projetoId!: string;

  @ApiProperty({
    description: 'Body font family.',
    enum: ['serif', 'sans-serif'],
    example: 'serif',
  })
  readonly fonteCorpoFamilia!: 'serif' | 'sans-serif';

  @ApiProperty({ description: 'Body font size in px.', example: 12 })
  readonly fonteCorpoTamanho!: number;

  @ApiProperty({ description: 'Line spacing multiplier.', example: 1.5 })
  readonly espacamentoLinha!: number;

  @ApiProperty({ description: 'Side margin in mm.', example: 20 })
  readonly margemLateral!: number;

  @ApiProperty({ description: 'H1 size in px.', example: 28 })
  readonly h1Tamanho!: number;

  @ApiProperty({ description: 'H2 size in px.', example: 22 })
  readonly h2Tamanho!: number;

  @ApiProperty({ description: 'H3 size in px.', example: 18 })
  readonly h3Tamanho!: number;

  @ApiProperty({ description: 'Image-alignment overrides.', type: [LayoutOverrideViewDto] })
  readonly overrides!: LayoutOverrideViewDto[];

  @ApiProperty({
    description: 'Last updated timestamp (RFC 3339 UTC).',
    example: '2026-08-25T14:40:00Z',
  })
  readonly atualizadoEm!: string;

  @ApiProperty({
    description: 'True when persisted at least once. False for a synthesized default (D-M).',
    example: true,
  })
  readonly materialized!: boolean;
}
