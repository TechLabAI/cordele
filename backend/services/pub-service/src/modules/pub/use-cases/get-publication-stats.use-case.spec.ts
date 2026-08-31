/**
 * Unit spec for GetPublicationStatsUseCase (PUB-006).
 *
 * Covers the KPI aggregation (D-O), including the `emAndamento=1` scenario
 * required by the P2 acceptance criteria.
 */

import { ForbiddenException } from '@nestjs/common';

import { EpubcheckStatus } from '../../../domain/pub/epubcheck-status.enum';
import { PublicacaoEntity } from '../../../domain/pub/publicacao.entity';
import { type AuthenticatedUser } from '../../../domain/auth/authenticated-user';
import { type PublicacaoRepositoryPort } from '../ports/publicacao-repository.port';
import { GetPublicationStatsUseCase } from './get-publication-stats.use-case';

const PROJETO_ID = 'p1';

const makeUser = (): AuthenticatedUser => ({
  userId: 'user-1',
  username: 'editor',
  roles: ['pub-user'],
  scopes: ['pub:read'],
  empresaId: 'empresa-aetos',
});

const publicado = (id: string, epubcheckStatus: EpubcheckStatus.VALIDO | EpubcheckStatus.AVISOS): PublicacaoEntity =>
  PublicacaoEntity.iniciar({ id, projetoId: PROJETO_ID, sequencia: 1, iniciadaEm: new Date('2026-08-19T16:30:00Z') })
    .iniciarValidacao()
    .concluirPublicado({
      artefatoRef: `publicacoes/${id}/output.epub`,
      epubcheckStatus,
      totalErros: 0,
      totalAvisos: epubcheckStatus === EpubcheckStatus.AVISOS ? 1 : 0,
      concluidaEm: new Date('2026-08-19T16:31:00Z'),
    });

const comErros = (id: string): PublicacaoEntity =>
  PublicacaoEntity.iniciar({ id, projetoId: PROJETO_ID, sequencia: 1, iniciadaEm: new Date('2026-08-19T16:30:00Z') })
    .iniciarValidacao()
    .concluirComErros({ resumoErro: 'boom', totalErros: 1, totalAvisos: 0, concluidaEm: new Date('2026-08-19T16:31:00Z') });

const gerando = (id: string): PublicacaoEntity =>
  PublicacaoEntity.iniciar({ id, projetoId: PROJETO_ID, sequencia: 1, iniciadaEm: new Date('2026-08-19T16:30:00Z') });

describe('GetPublicationStatsUseCase', () => {
  let repository: jest.Mocked<PublicacaoRepositoryPort>;
  let useCase: GetPublicationStatsUseCase;

  beforeEach(() => {
    repository = {
      findInFlight: jest.fn(),
      nextSequencia: jest.fn(),
      save: jest.fn(),
      findById: jest.fn(),
      listByProjeto: jest.fn(),
      findLatestByProjetoIds: jest.fn(),
      findByPublicacaoId: jest.fn(),
      deleteAllByProjeto: jest.fn(),
      findStaleInFlight: jest.fn(),
    };
    useCase = new GetPublicationStatsUseCase(repository);
  });

  it('throws ForbiddenException when the caller carries no empresa claim', async () => {
    await expect(
      useCase.execute({ projetoId: PROJETO_ID }, { ...makeUser(), empresaId: '' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns all-zero stats with null last-outcome fields when the project was never exported', async () => {
    repository.listByProjeto.mockResolvedValue([]);

    const result = await useCase.execute({ projetoId: PROJETO_ID }, makeUser());

    expect(result).toEqual({
      projetoId: PROJETO_ID,
      total: 0,
      publicadas: 0,
      comAvisos: 0,
      comErros: 0,
      emAndamento: 0,
      ultimoStatus: null,
      ultimoEpubcheckStatus: null,
      ultimaPublicacaoEm: null,
    });
  });

  it('computes emAndamento=1 with exactly one non-terminal publicacao (P2 acceptance criterion)', async () => {
    repository.listByProjeto.mockResolvedValue([gerando('pub-1')]);

    const result = await useCase.execute({ projetoId: PROJETO_ID }, makeUser());

    expect(result.emAndamento).toBe(1);
    expect(result.total).toBe(1);
    expect(result.publicadas).toBe(0);
    expect(result.comErros).toBe(0);
  });

  it('aggregates a mixed history (newest first) into the correct KPI counts', async () => {
    // Newest first, as listByProjeto contracts to return (api-contract §4.3).
    repository.listByProjeto.mockResolvedValue([
      publicado('pub-3', EpubcheckStatus.AVISOS),
      comErros('pub-2'),
      publicado('pub-1', EpubcheckStatus.VALIDO),
    ]);

    const result = await useCase.execute({ projetoId: PROJETO_ID }, makeUser());

    expect(result.total).toBe(3);
    expect(result.publicadas).toBe(2);
    expect(result.comAvisos).toBe(1);
    expect(result.comErros).toBe(1);
    expect(result.emAndamento).toBe(0);
    expect(result.ultimoStatus).toBe('publicado');
    expect(result.ultimoEpubcheckStatus).toBe('avisos');
    expect(result.ultimaPublicacaoEm).toBe('2026-08-19T16:30:00.000Z');
  });
});
