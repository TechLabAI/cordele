import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { type AuthenticatedUser } from '../../../domain/auth/authenticated-user';
import { PUBLICACAO_REPOSITORY_PORT } from '../pub.tokens';
import { type PublicacaoRepositoryPort } from '../ports/publicacao-repository.port';
import { type LatestBatchResponseItemDto } from '../dto/latest-batch-response-item.dto';

export interface GetLatestBatchInput {
  readonly projetoIds: string[];
}

/**
 * GetLatestBatchUseCase — returns the latest publication summary for a batch
 * of projects in a SINGLE repository query (api-contract §4.7).
 *
 * Called by PROJ via REST POST /api/v1/pub/publications/latest-batch.
 * Projects with no publications are omitted from the result (absent = never published).
 *
 * RULE-07: requires the empresa context before touching the repository.
 */
@Injectable()
export class GetLatestBatchUseCase {
  constructor(
    @Inject(PUBLICACAO_REPOSITORY_PORT)
    private readonly repository: PublicacaoRepositoryPort,
  ) {}

  async execute(
    input: GetLatestBatchInput,
    user: AuthenticatedUser,
  ): Promise<LatestBatchResponseItemDto[]> {
    if (!user?.empresaId) {
      throw new ForbiddenException('Token carries no empresa claim');
    }
    if (input.projetoIds.length === 0) {
      return [];
    }
    const latestMap = await this.repository.findLatestByProjetoIds(input.projetoIds);
    const result: LatestBatchResponseItemDto[] = [];
    for (const [projetoId, entity] of latestMap) {
      result.push({
        projetoId,
        publicacaoId: entity.id,
        epubcheckStatus: entity.epubcheckStatus,
      });
    }
    return result;
  }
}
