import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Single override in the preview-context response (api-contract §6.4).
 *
 * Includes a `stale` flag to inform the editor when a referenciaNo no longer
 * resolves in the current content tree (D-K). Stale overrides are returned for
 * editor awareness but excluded from the honoured set used by PUB.
 */
export class PreviewOverrideDto {
  @ApiProperty({
    description: 'Reference to a manuscript content tree node.',
    example: 'img-017',
  })
  readonly referenciaNo!: string;

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
 * Response DTO for the GET preview-context endpoint (api-contract §6.4, D-K).
 *
 * Assembles the read-only manuscript content structure (via ManuscriptContentPort) +
 * ConfiguracaoLayout + overrides into a single JSON payload the SPA renders
 * client-side. Nothing is persisted and no rendered HTML/canvas is returned.
 *
 * Structure:
 *  - `estrutura`: opaque manuscript node array forwarded verbatim from ManuscriptContentPort.
 *  - `layout`: current ConfiguracaoLayout fields (only non-stale overrides honoured by PUB).
 *  - `overrides`: full override list including stale entries (with `stale=true`).
 */
export class PreviewContextResponseDto {
  @ApiProperty({
    description:
      'Read-only manuscript content tree nodes (chapters → paragraphs, image nodes). ' +
      'Structure is opaque to COMP — forwarded verbatim from ManuscriptContentPort.',
    type: 'array',
    items: { type: 'object' },
  })
  readonly estrutura!: unknown[];

  @ApiProperty({
    description: 'Current ConfiguracaoLayout flat typography and margin fields.',
    type: 'object',
    additionalProperties: true,
  })
  readonly layout!: Record<string, unknown>;

  @ApiProperty({
    description:
      'Override list including stale entries (stale=true for entries whose referenciaNo ' +
      'is absent from the current content tree, D-K). Stale overrides excluded from PUB.',
    type: [PreviewOverrideDto],
  })
  readonly overrides!: PreviewOverrideDto[];
}
