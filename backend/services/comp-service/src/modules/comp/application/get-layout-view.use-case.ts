import { Inject, Injectable, Logger } from '@nestjs/common';

import { ConfiguracaoLayout } from '../../../domain/comp/configuracao-layout.aggregate';
import type { ConfiguracaoLayoutRepositoryPort } from '../ports/configuracao-layout-repository.port';
import { COMP_LAYOUT_REPO } from '../comp.tokens';

export interface GetLayoutViewInput {
  readonly projetoId: string;
}

/**
 * Returns layout configuration for a project (T06, api-contract §4.5).
 *
 * Lazy default (D-M): when no row is found the use case returns a default
 * ConfiguracaoLayout with `materialized=false` — it NEVER throws 404.
 *
 * RULE-04: this file is in modules/ and does NOT import from infrastructure/.
 */
@Injectable()
export class GetLayoutViewUseCase {
  private readonly logger = new Logger(GetLayoutViewUseCase.name);

  constructor(
    @Inject(COMP_LAYOUT_REPO)
    private readonly layoutRepo: ConfiguracaoLayoutRepositoryPort,
  ) {}

  async execute(input: GetLayoutViewInput): Promise<ConfiguracaoLayout> {
    this.logger.debug(`GetLayoutView projetoId=${input.projetoId}`);

    const found = await this.layoutRepo.findByProjetoId(input.projetoId);
    if (found) {
      return found;
    }

    // Lazy default (D-M): return placeholder without persisting.
    this.logger.debug(`GetLayoutView no row found — returning default projetoId=${input.projetoId}`);
    return ConfiguracaoLayout.createDefault(input.projetoId);
  }
}
