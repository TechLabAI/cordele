import { Inject, Injectable, Logger } from '@nestjs/common';

import { Metadados } from '../../../domain/comp/metadados.aggregate';
import type { MetadadosRepository } from '../ports/metadados-repository.port';
import { COMP_METADADOS_REPO } from '../comp.tokens';

export interface GetMetadadosViewInput {
  readonly projetoId: string;
  readonly empresaSlug: string;
}

/**
 * Returns editorial metadata for a project (COMP-004, api-contract §4.1, T05).
 *
 * Lazy default (D-M): when no row is found the use case returns a default
 * Metadados aggregate with `materialized=false` — it NEVER throws 404.
 *
 * The repository must already be scoped to the correct tenant schema via
 * EmpresaContext (wired in the persistence layer; the repository reads
 * EmpresaContext.slug set up by PrismaEmpresaService).
 *
 * RULE-04: this file is in modules/ and does NOT import from infrastructure/.
 */
@Injectable()
export class GetMetadadosViewUseCase {
  private readonly logger = new Logger(GetMetadadosViewUseCase.name);

  constructor(
    @Inject(COMP_METADADOS_REPO)
    private readonly metadadosRepo: MetadadosRepository,
  ) {}

  async execute(input: GetMetadadosViewInput): Promise<Metadados> {
    this.logger.debug(`GetMetadadosView projetoId=${input.projetoId} empresa=${input.empresaSlug}`);

    const found = await this.metadadosRepo.findByProjetoId(input.projetoId);
    if (found) {
      return found;
    }

    // Lazy default (D-M): synthesize placeholder without persisting.
    this.logger.debug(
      `GetMetadadosView no row found — returning default projetoId=${input.projetoId}`,
    );
    return Metadados.defaultsFor(input.projetoId, input.empresaSlug);
  }
}
