import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { PublicacaoEntity } from '../../../domain/pub/publicacao.entity';
import { type AuthenticatedUser } from '../../../domain/auth/authenticated-user';
import { type PublicacaoRepositoryPort } from '../ports/publicacao-repository.port';
import { GetPublicationStatusUseCase } from './get-publication-status.use-case';

const makeUser = (): AuthenticatedUser => ({
  userId: 'user-1',
  username: 'editor',
  roles: ['pub-user'],
  scopes: ['pub:read'],
  empresaId: 'empresa-aetos',
});

describe('GetPublicationStatusUseCase', () => {
  let repository: jest.Mocked<PublicacaoRepositoryPort>;
  let useCase: GetPublicationStatusUseCase;

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
    useCase = new GetPublicationStatusUseCase(repository);
  });

  it('throws ForbiddenException when the caller carries no empresa claim', async () => {
    await expect(
      useCase.execute({ projetoId: 'p1', publicacaoId: 'pub1' }, { ...makeUser(), empresaId: '' }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('throws NotFoundException when the publicacao does not exist', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(
      useCase.execute({ projetoId: 'p1', publicacaoId: 'pub1' }, makeUser()),
    ).rejects.toThrow(NotFoundException);
  });

  it('returns the publicacao when found', async () => {
    const publicacao = PublicacaoEntity.iniciar({
      id: 'pub1',
      projetoId: 'p1',
      sequencia: 1,
      iniciadaEm: new Date(),
    });
    repository.findById.mockResolvedValue(publicacao);

    const result = await useCase.execute({ projetoId: 'p1', publicacaoId: 'pub1' }, makeUser());

    expect(result).toBe(publicacao);
    expect(repository.findById).toHaveBeenCalledWith('p1', 'pub1');
  });
});
