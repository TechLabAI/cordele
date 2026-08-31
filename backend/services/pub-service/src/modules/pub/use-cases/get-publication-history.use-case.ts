import { ForbiddenException, Inject, Injectable } from '@nestjs/common';

import { PublicacaoEntity } from '../../../domain/pub/publicacao.entity';
import { type AuthenticatedUser } from '../../../domain/auth/authenticated-user';
import { PUBLICACAO_REPOSITORY_PORT } from '../pub.tokens';
import { type PublicacaoRepositoryPort } from '../ports/publicacao-repository.port';

export interface GetPublicationHistoryInput {
  readonly projetoId: string;
}

/**
 * GetPublicationHistoryUseCase — publication history, newest first
 * (api-contract §4.3, T08). Also the read model behind PROJ's
 * `PublicationHistoryPort` (exported in P6).
 *
 * RULE-07: requires the empresa context before touching the repository.
 */
@Injectable()
export class GetPublicationHistoryUseCase {
  constructor(
    @Inject(PUBLICACAO_REPOSITORY_PORT)
    private readonly repository: PublicacaoRepositoryPort,
  ) {}

  async execute(input: GetPublicationHistoryInput, user: AuthenticatedUser): Promise<PublicacaoEntity[]> {
    if (!user?.empresaId) {
      throw new ForbiddenException('Token carries no empresa claim');
    }
    return this.repository.listByProjeto(input.projetoId);
  }
}
