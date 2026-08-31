import { Inject, Injectable, Logger } from '@nestjs/common';

import { ConfiguracaoLayout } from '../../../domain/comp/configuracao-layout.aggregate';
import type { LayoutOverride } from '../../../domain/comp/layout-override.entity';
import { DomainException } from '../../../domain/shared/domain-exception';
import type { ConfiguracaoLayoutRepositoryPort } from '../ports/configuracao-layout-repository.port';
import {
  type ManuscriptContentPort,
  type ContentTreeDto,
  collectNodeIds,
} from '../ports/manuscript-content.port';
import { COMP_LAYOUT_REPO, COMP_MANUSCRIPT_CONTENT_PORT } from '../comp.tokens';

export interface GetLayoutPreviewInput {
  readonly projetoId: string;
}

export interface PreviewContextResult {
  readonly projetoId: string;
  readonly manuscrito: ContentTreeDto;
  readonly layout: ConfiguracaoLayout;
  readonly staleOverrides: ReadonlyArray<LayoutOverride>;
}

/**
 * Assembles the layout preview context for client-side rendering (T06, D-K, api-contract §4.7).
 *
 * Fetches the manuscript content tree and the persisted layout in parallel:
 *   - If the content tree is null (no manuscript imported yet) → 409 `manuscript-missing`.
 *   - ConfiguracaoLayout falls back to the default (D-M) when absent.
 *
 * Validates existing overrides against the current content tree (D-K):
 *   - Overrides whose referenciaNo resolves → active (honoured by PUB).
 *   - Overrides whose referenciaNo is absent → stale (returned for UI warnings).
 *
 * Nothing is persisted — this is a pure read-assembly operation.
 * The caller (CompController) maps the result to PreviewContextResponseDto.
 *
 * RULE-04: this file is in modules/ and does NOT import from infrastructure/.
 */
@Injectable()
export class GetLayoutPreviewUseCase {
  private readonly logger = new Logger(GetLayoutPreviewUseCase.name);

  constructor(
    @Inject(COMP_LAYOUT_REPO)
    private readonly layoutRepo: ConfiguracaoLayoutRepositoryPort,
    @Inject(COMP_MANUSCRIPT_CONTENT_PORT)
    private readonly manuscriptContent: ManuscriptContentPort,
  ) {}

  async execute(input: GetLayoutPreviewInput): Promise<PreviewContextResult> {
    this.logger.debug(`GetLayoutPreview projetoId=${input.projetoId}`);

    // Fetch content tree and layout in parallel.
    const [contentTree, rawLayout] = await Promise.all([
      this.manuscriptContent.getContentTree(input.projetoId),
      this.layoutRepo.findByProjetoId(input.projetoId),
    ]);

    // When no manuscript exists yet → 409 (COMP-008, urn:cordele:comp:manuscript-missing).
    if (contentTree === null) {
      throw new DomainException(
        'MANUSCRIPT_MISSING',
        409,
        'No manuscript imported for this project',
      );
    }

    const layout = rawLayout ?? ConfiguracaoLayout.createDefault(input.projetoId);

    // Validate overrides against the current content tree (D-K).
    let validatedLayout = layout;
    if (layout.overrides.length > 0) {
      const existingNodeIds = collectNodeIds(contentTree.estrutura);
      validatedLayout = layout.withValidatedOverrides(existingNodeIds);
    }

    return {
      projetoId: input.projetoId,
      manuscrito: contentTree,
      layout: validatedLayout,
      staleOverrides: validatedLayout.staleOverrides(),
    };
  }
}
