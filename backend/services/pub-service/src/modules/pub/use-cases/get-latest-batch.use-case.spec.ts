import { ForbiddenException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { EpubcheckStatus } from '../../../domain/pub/epubcheck-status.enum';
import { PublicacaoEntity } from '../../../domain/pub/publicacao.entity';
import { type AuthenticatedUser } from '../../../domain/auth/authenticated-user';
import { PUBLICACAO_REPOSITORY_PORT } from '../pub.tokens';
import { type PublicacaoRepositoryPort } from '../ports/publicacao-repository.port';
import { GetLatestBatchUseCase } from './get-latest-batch.use-case';

const PROJETO_A = 'aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const PROJETO_B = 'bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
const PROJETO_C = 'cccccccc-cccc-4ccc-cccc-cccccccccccc';
const PUB_A1 = '11111111-1111-4111-1111-111111111111';
const PUB_A2 = '22222222-2222-4222-2222-222222222222';
const PUB_B1 = '33333333-3333-4333-3333-333333333333';

const makeUser = (empresaId = 'aetos'): AuthenticatedUser => ({
  userId: 'user-001',
  username: 'editor',
  roles: ['pub-user'],
  scopes: ['pub:read'],
  empresaId,
});

const buildPublicado = (id: string, projetoId: string, sequencia: number): PublicacaoEntity =>
  PublicacaoEntity.iniciar({ id, projetoId, sequencia, iniciadaEm: new Date() })
    .iniciarValidacao()
    .concluirPublicado({
      artefatoRef: `publicacoes/${id}/output.epub`,
      epubcheckStatus: EpubcheckStatus.VALIDO,
      totalErros: 0,
      totalAvisos: 0,
      concluidaEm: new Date(),
    });

const buildPendente = (id: string, projetoId: string, sequencia: number): PublicacaoEntity =>
  PublicacaoEntity.iniciar({ id, projetoId, sequencia, iniciadaEm: new Date() });

describe('GetLatestBatchUseCase', () => {
  let useCase: GetLatestBatchUseCase;
  let repository: jest.Mocked<PublicacaoRepositoryPort>;

  beforeEach(async () => {
    repository = {
      findLatestByProjetoIds: jest.fn(),
    } as unknown as jest.Mocked<PublicacaoRepositoryPort>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetLatestBatchUseCase,
        { provide: PUBLICACAO_REPOSITORY_PORT, useValue: repository },
      ],
    }).compile();

    useCase = module.get(GetLatestBatchUseCase);
  });

  it('returns empty array for empty projetoIds without hitting the repository', async () => {
    const result = await useCase.execute({ projetoIds: [] }, makeUser());
    expect(result).toEqual([]);
    expect(repository.findLatestByProjetoIds).not.toHaveBeenCalled();
  });

  it('omits projects with no publications', async () => {
    repository.findLatestByProjetoIds.mockResolvedValue(new Map());
    const result = await useCase.execute({ projetoIds: [PROJETO_A] }, makeUser());
    expect(result).toEqual([]);
    expect(repository.findLatestByProjetoIds).toHaveBeenCalledWith([PROJETO_A]);
  });

  it('returns the latest publication for a single project', async () => {
    const pub = buildPublicado(PUB_A1, PROJETO_A, 1);
    repository.findLatestByProjetoIds.mockResolvedValue(new Map([[PROJETO_A, pub]]));
    const result = await useCase.execute({ projetoIds: [PROJETO_A] }, makeUser());
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      projetoId: PROJETO_A,
      publicacaoId: PUB_A1,
      epubcheckStatus: EpubcheckStatus.VALIDO,
    });
  });

  it('returns the most recent publication when a project has multiple (repository responsibility)', async () => {
    // Repository always returns the latest; use case trusts it
    const latestPub = buildPublicado(PUB_A2, PROJETO_A, 2);
    repository.findLatestByProjetoIds.mockResolvedValue(new Map([[PROJETO_A, latestPub]]));
    const result = await useCase.execute({ projetoIds: [PROJETO_A] }, makeUser());
    expect(result[0]!.publicacaoId).toBe(PUB_A2);
  });

  it('handles a mix: some projects with publications, some without', async () => {
    const pubA = buildPublicado(PUB_A1, PROJETO_A, 1);
    const pubB = buildPendente(PUB_B1, PROJETO_B, 1);
    // PROJETO_C has no publications → absent from map
    repository.findLatestByProjetoIds.mockResolvedValue(
      new Map([
        [PROJETO_A, pubA],
        [PROJETO_B, pubB],
      ]),
    );
    const result = await useCase.execute(
      { projetoIds: [PROJETO_A, PROJETO_B, PROJETO_C] },
      makeUser(),
    );
    expect(result).toHaveLength(2);
    const projetoIds = result.map((r) => r.projetoId);
    expect(projetoIds).toContain(PROJETO_A);
    expect(projetoIds).toContain(PROJETO_B);
    expect(projetoIds).not.toContain(PROJETO_C);
    expect(result.find((r) => r.projetoId === PROJETO_B)?.epubcheckStatus).toBe(
      EpubcheckStatus.PENDENTE,
    );
  });

  it('throws ForbiddenException when user has no empresaId', async () => {
    const userNoEmpresa = { ...makeUser(), empresaId: '' };
    await expect(useCase.execute({ projetoIds: [PROJETO_A] }, userNoEmpresa)).rejects.toThrow(
      ForbiddenException,
    );
  });
});
