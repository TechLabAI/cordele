import { ApiProperty } from '@nestjs/swagger';

import { LayoutViewDto } from './layout-view.dto';
import { LayoutOverrideViewDto } from './layout-view.dto';

/**
 * Manuscript content tree node (read-only; owned by IMP — api-contract §6.4, D-K).
 *
 * The shape mirrors what ManuscriptContentPort.getContentTree returns.
 * COMP never copies or mutates this data; it is passed through as-is.
 */
export class ManuscritoEstrutura {
  @ApiProperty({ description: 'Manuscript UUID.', format: 'uuid' })
  readonly manuscritoId!: string;

  @ApiProperty({
    description:
      'Read-only content tree nodes (chapters → paragraphs, image nodes). ' +
      'Structure is opaque to COMP — forwarded verbatim from ManuscriptContentPort.',
    type: 'array',
    items: { type: 'object' },
  })
  readonly estrutura!: unknown[];
}

/**
 * View DTO for the preview-context endpoint (api-contract §6.4, D-K).
 *
 * Assembles the read-only manuscript content tree (via ManuscriptContentPort) +
 * ConfiguracaoLayout + overrides into a single JSON payload the SPA renders
 * client-side. Nothing is persisted and no rendered HTML/canvas is returned.
 *
 * `staleOverrides` contains overrides whose `referenciaNo` no longer resolves;
 * they are excluded from the `layout.overrides` honoured set.
 */
export class PreviewContextDto {
  @ApiProperty({ description: 'Owning project UUID.', format: 'uuid' })
  readonly projetoId!: string;

  @ApiProperty({ description: 'Read-only manuscript content tree (from IMP via ManuscriptContentPort).' })
  readonly manuscrito!: ManuscritoEstrutura;

  @ApiProperty({
    description:
      'Current ConfiguracaoLayout with only honoured (non-stale) overrides applied (D-K).',
    type: LayoutViewDto,
  })
  readonly layout!: LayoutViewDto;

  @ApiProperty({
    description:
      'Overrides whose referenciaNo is absent from the current content tree (stale=true). ' +
      'Excluded from the honoured set; returned so the UI can warn the editor.',
    type: [LayoutOverrideViewDto],
  })
  readonly staleOverrides!: LayoutOverrideViewDto[];
}
