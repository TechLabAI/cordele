import { ForbiddenException } from '@nestjs/common';

import { PublicacaoEntity } from '../../../domain/pub/publicacao.entity';
import { type AuthenticatedUser } from '../../../domain/auth/authenticated-user';
import { type PublicacaoRepositoryPort } from '../ports/publicacao-repository.port';
import { GetPublicationHistoryUseCase } from './get-publication-history.use-case';

const makeUser = (): AuthenticatedUser => ({
  userId: 'user-1',
  username: 'editor',
  roles: ['pub-user'],
  scopes: ['pub:read'],
  empresaId: 'empresa-aetos',
});

describe('GetPublicationHistoryUseCase', () => {
  let repository: jest.Mocked<PublicacaoRepositoryPort>;
  let useCase: GetPublicationHistoryUseCase;

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
    useCase = new GetPublicationHistoryUseCase(repository);
  });

  it('throws ForbiddenException when the caller carries no empresa claim', async () => {
    await expect(
      useCase.execute({ projetoId: 'p1' }, { ...makeUser(), empresaId: '' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('returns the full history for the project (possibly empty)', async () => {
    repository.listByProjeto.mockResolvedValue([]);

    const result = await useCase.execute({ projetoId: 'p1' }, makeUser());

    expect(result).toEqual([]);
    expect(repository.listByProjeto).toHaveBeenCalledWith('p1');
  });

  it('returns the entities produced by the repository', async () => {
    const publicacao = PublicacaoEntity.iniciar({
      id: 'pub1',
      projetoId: 'p1',
      sequencia: 1,
      iniciadaEm: new Date(),
    });
    repository.listByProjeto.mockResolvedValue([publicacao]);

    const result = await useCase.execute({ projetoId: 'p1' }, makeUser());

    expect(result).toEqual([publicacao]);
  });
});
