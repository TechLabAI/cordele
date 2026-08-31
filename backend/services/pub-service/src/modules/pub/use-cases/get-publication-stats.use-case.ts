import { ForbiddenException, Inject, Injectable } from '@nestjs/common';

import { EpubcheckStatus } from '../../../domain/pub/epubcheck-status.enum';
import { PublicacaoEntity } from '../../../domain/pub/publicacao.entity';
import { PublicacaoStatus } from '../../../domain/pub/publicacao-status.enum';
import { type AuthenticatedUser } from '../../../domain/auth/authenticated-user';
import { PUBLICACAO_REPOSITORY_PORT } from '../pub.tokens';
import { type PublicacaoRepositoryPort } from '../ports/publicacao-repository.port';

export interface GetPublicationStatsInput {
  readonly projetoId: string;
}

export interface PublicationStatsResult {
  readonly projetoId: string;
  readonly total: number;
  readonly publicadas: number;
  readonly comAvisos: number;
  readonly comErros: number;
  readonly emAndamento: number;
  readonly ultimoStatus: PublicacaoStatus | null;
  readonly ultimoEpubcheckStatus: EpubcheckStatus | null;
  readonly ultimaPublicacaoEm: string | null;
}

/**
 * GetPublicationStatsUseCase — publication KPIs (api-contract §4.5, T07/T08,
 * D-O). Computed live from PUB's own `Publicacao` rows — never from a
 * separate analytics store.
 *
 * RULE-07: requires the empresa context before touching the repository.
 */
@Injectable()
export class GetPublicationStatsUseCase {
  constructor(
    @Inject(PUBLICACAO_REPOSITORY_PORT)
    private readonly repository: PublicacaoRepositoryPort,
  ) {}

  async execute(input: GetPublicationStatsInput, user: AuthenticatedUser): Promise<PublicationStatsResult> {
    if (!user?.empresaId) {
      throw new ForbiddenException('Token carries no empresa claim');
    }

    const publicacoes = await this.repository.listByProjeto(input.projetoId);
    return this.aggregate(input.projetoId, publicacoes);
  }

  private aggregate(projetoId: string, publicacoes: PublicacaoEntity[]): PublicationStatsResult {
    const publicadas = publicacoes.filter((p) => p.status === PublicacaoStatus.PUBLICADO);
    const comAvisos = publicadas.filter((p) => p.epubcheckStatus === EpubcheckStatus.AVISOS);
    const comErros = publicacoes.filter((p) => p.status === PublicacaoStatus.COM_ERROS);
    const emAndamento = publicacoes.filter(
      (p) => p.status === PublicacaoStatus.GERANDO || p.status === PublicacaoStatus.VALIDANDO,
    );

    // listByProjeto returns newest-first (api-contract §4.3).
    const ultima = publicacoes[0] ?? null;

    return {
      projetoId,
      total: publicacoes.length,
      publicadas: publicadas.length,
      comAvisos: comAvisos.length,
      comErros: comErros.length,
      emAndamento: emAndamento.length,
      ultimoStatus: ultima?.status ?? null,
      ultimoEpubcheckStatus: ultima?.epubcheckStatus ?? null,
      ultimaPublicacaoEm: ultima?.iniciadaEm.toISOString() ?? null,
    };
  }
}
