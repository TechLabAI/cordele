import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { PublicacaoEntity } from '../../../domain/pub/publicacao.entity';
import { type AuthenticatedUser } from '../../../domain/auth/authenticated-user';
import { PUBLICACAO_REPOSITORY_PORT } from '../pub.tokens';
import { type PublicacaoRepositoryPort } from '../ports/publicacao-repository.port';

export interface GetPublicationStatusInput {
  readonly projetoId: string;
  readonly publicacaoId: string;
}

/**
 * GetPublicationStatusUseCase — poll build status (api-contract §4.2).
 *
 * RULE-07: requires the empresa context before touching the repository.
 */
@Injectable()
export class GetPublicationStatusUseCase {
  constructor(
    @Inject(PUBLICACAO_REPOSITORY_PORT)
    private readonly repository: PublicacaoRepositoryPort,
  ) {}

  async execute(input: GetPublicationStatusInput, user: AuthenticatedUser): Promise<PublicacaoEntity> {
    if (!user?.empresaId) {
      throw new ForbiddenException('Token carries no empresa claim');
    }

    const publicacao = await this.repository.findById(input.projetoId, input.publicacaoId);
    if (!publicacao) {
      throw new NotFoundException('urn:cordele:pub:publicacao-not-found');
    }
    return publicacao;
  }
}
