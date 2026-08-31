/**
 * Unit spec for GeneratePublicationUseCase (PUB-003 + INT-PUB-006).
 *
 * All outbound ports mocked with jest.fn() — no Nest DI, no real infra.
 * Covers: pre-flight (409 manuscript-missing, 422 metadata-incomplete),
 * idempotent in-flight trigger (D-R), the non-blocking job dispatch, and
 * INT-PUB-006 (EmpresaContext isolation: two jobs for different empresas
 * must not share AsyncLocalStorage context).
 */

import { ConflictException, ForbiddenException, UnprocessableEntityException } from '@nestjs/common';

import { EpubcheckStatus } from '../../../domain/pub/epubcheck-status.enum';
import { PublicacaoEntity } from '../../../domain/pub/publicacao.entity';
import { PublicacaoStatus } from '../../../domain/pub/publicacao-status.enum';
import { type AuthenticatedUser } from '../../../domain/auth/authenticated-user';
import { type CompositionMetadataPort } from '../ports/composition-metadata.port';
import { type EmpresaContextRunnerPort } from '../ports/empresa-context-runner.port';
import { type ManuscriptContentPort } from '../ports/manuscript-content.port';
import { type PublicacaoRepositoryPort } from '../ports/publicacao-repository.port';
import { GeneratePublicationUseCase } from './generate-publication.use-case';
import { PublicationBuildJob } from './publication-build.job';

const PROJETO_ID = '11111111-1111-1111-1111-111111111111';
const PROJETO_ID_B = '33333333-3333-3333-3333-333333333333';

const makeUser = (empresaId = 'empresa-aetos'): AuthenticatedUser => ({
  userId: 'user-1',
  username: 'editor',
  roles: ['pub-user'],
  scopes: ['pub:write'],
  empresaId,
});

describe('GeneratePublicationUseCase', () => {
  let repository: jest.Mocked<PublicacaoRepositoryPort>;
  let manuscriptContentPort: jest.Mocked<ManuscriptContentPort>;
  let compositionMetadataPort: jest.Mocked<CompositionMetadataPort>;
  let buildJob: jest.Mocked<Pick<PublicationBuildJob, 'run'>>;
  let empresaContextRunner: jest.Mocked<EmpresaContextRunnerPort>;
  let useCase: GeneratePublicationUseCase;

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
    manuscriptContentPort = { getContentTree: jest.fn() };
    compositionMetadataPort = { get: jest.fn() };
    buildJob = { run: jest.fn().mockResolvedValue(undefined) };
    // Passthrough mock: execute fn immediately (simulates the ALS wrapping)
    empresaContextRunner = {
      runAs: jest.fn().mockImplementation((_id: string, fn: () => unknown) => fn()),
    };

    useCase = new GeneratePublicationUseCase(
      repository,
      manuscriptContentPort,
      compositionMetadataPort,
      buildJob as unknown as PublicationBuildJob,
      empresaContextRunner,
    );
  });

  it('throws ForbiddenException when the caller carries no empresa claim', async () => {
    await expect(
      useCase.execute({ projetoId: PROJETO_ID }, { ...makeUser(), empresaId: '' }),
    ).rejects.toThrow(ForbiddenException);
    expect(repository.findInFlight).not.toHaveBeenCalled();
  });

  it('returns the in-flight publicacao without creating a second one (D-R)', async () => {
    const inFlight = PublicacaoEntity.iniciar({
      id: 'existing-id',
      projetoId: PROJETO_ID,
      sequencia: 1,
      iniciadaEm: new Date(),
    });
    repository.findInFlight.mockResolvedValue(inFlight);

    const result = await useCase.execute({ projetoId: PROJETO_ID }, makeUser());

    expect(result.isNew).toBe(false);
    expect(result.publicacao.id).toBe('existing-id');
    expect(repository.save).not.toHaveBeenCalled();
    expect(buildJob.run).not.toHaveBeenCalled();
    expect(manuscriptContentPort.getContentTree).not.toHaveBeenCalled();
  });

  it('rejects with 409 when the project has no imported manuscript', async () => {
    repository.findInFlight.mockResolvedValue(null);
    manuscriptContentPort.getContentTree.mockResolvedValue(null);

    await expect(useCase.execute({ projetoId: PROJETO_ID }, makeUser())).rejects.toThrow(
      ConflictException,
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('rejects with 422 when required metadata is incomplete', async () => {
    repository.findInFlight.mockResolvedValue(null);
    manuscriptContentPort.getContentTree.mockResolvedValue({
      manuscritoId: 'manuscrito-1',
      estrutura: [],
    });
    compositionMetadataPort.get.mockResolvedValue({
      projetoId: PROJETO_ID,
      titulo: 'Romance',
      autor: null,
      isbn: null,
      idioma: 'pt',
      categoria: null,
      capaUrl: null,
      editoraNome: null,
      atualizadoEm: new Date().toISOString(),
    });

    await expect(useCase.execute({ projetoId: PROJETO_ID }, makeUser())).rejects.toThrow(
      UnprocessableEntityException,
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('creates a new Publicacao in gerando and dispatches the build job (golden path)', async () => {
    repository.findInFlight.mockResolvedValue(null);
    repository.nextSequencia.mockResolvedValue(1);
    manuscriptContentPort.getContentTree.mockResolvedValue({
      manuscritoId: 'manuscrito-1',
      estrutura: [],
    });
    compositionMetadataPort.get.mockResolvedValue({
      projetoId: PROJETO_ID,
      titulo: 'Romance',
      autor: 'Autora',
      isbn: null,
      idioma: 'pt',
      categoria: null,
      capaUrl: null,
      editoraNome: null,
      atualizadoEm: new Date().toISOString(),
    });
    repository.save.mockImplementation((p) => Promise.resolve(p));

    const result = await useCase.execute({ projetoId: PROJETO_ID }, makeUser());

    expect(result.isNew).toBe(true);
    expect(result.publicacao.status).toBe(PublicacaoStatus.GERANDO);
    expect(result.publicacao.epubcheckStatus).toBe(EpubcheckStatus.PENDENTE);
    expect(result.publicacao.sequencia).toBe(1);
    expect(repository.save).toHaveBeenCalledTimes(1);

    // Dispatch is fire-and-forget (Promise.resolve().then(...)) — flush microtasks.
    await Promise.resolve();
    await Promise.resolve();
    expect(buildJob.run).toHaveBeenCalledWith(
      expect.objectContaining({ projetoId: PROJETO_ID, empresaId: 'empresa-aetos' }),
    );
    // INT-PUB-006: runAs must be called with the empresa captured before dispatch.
    expect(empresaContextRunner.runAs).toHaveBeenCalledWith('empresa-aetos', expect.any(Function));
  });

  it('INT-PUB-006: two concurrent jobs for different empresas do not share EmpresaContext', async () => {
    // Arrange two separate use-case instances (simulating concurrent requests)
    const repoA: jest.Mocked<PublicacaoRepositoryPort> = {
      findInFlight: jest.fn().mockResolvedValue(null),
      nextSequencia: jest.fn().mockResolvedValue(1),
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
      findById: jest.fn(),
      listByProjeto: jest.fn(),
      findLatestByProjetoIds: jest.fn(),
      findByPublicacaoId: jest.fn(),
      deleteAllByProjeto: jest.fn(),
      findStaleInFlight: jest.fn(),
    };
    const repoB: jest.Mocked<PublicacaoRepositoryPort> = {
      findInFlight: jest.fn().mockResolvedValue(null),
      nextSequencia: jest.fn().mockResolvedValue(1),
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
      findById: jest.fn(),
      listByProjeto: jest.fn(),
      findLatestByProjetoIds: jest.fn(),
      findByPublicacaoId: jest.fn(),
      deleteAllByProjeto: jest.fn(),
      findStaleInFlight: jest.fn(),
    };
    const metaMock = {
      projetoId: PROJETO_ID,
      titulo: 'T',
      autor: 'A',
      isbn: null,
      idioma: 'pt',
      categoria: null,
      capaUrl: null,
      editoraNome: null,
      atualizadoEm: new Date().toISOString(),
    };
    const contentMock = { manuscritoId: 'm', estrutura: [] as [] };

    const jobA = { run: jest.fn().mockResolvedValue(undefined) };
    const jobB = { run: jest.fn().mockResolvedValue(undefined) };

    // Each runner captures the empresaId it was called with.
    const capturedEmpresaIds: string[] = [];
    const runnerA: EmpresaContextRunnerPort = {
      runAs: jest.fn().mockImplementation((id: string, fn: () => unknown) => {
        capturedEmpresaIds.push(id);
        return fn();
      }),
    };
    const runnerB: EmpresaContextRunnerPort = {
      runAs: jest.fn().mockImplementation((id: string, fn: () => unknown) => {
        capturedEmpresaIds.push(id);
        return fn();
      }),
    };

    const msPort: jest.Mocked<ManuscriptContentPort> = {
      getContentTree: jest.fn().mockResolvedValue(contentMock),
    };
    const cmPort: jest.Mocked<CompositionMetadataPort> = {
      get: jest.fn().mockResolvedValue(metaMock),
    };

    const ucA = new GeneratePublicationUseCase(
      repoA, msPort, cmPort, jobA as unknown as PublicationBuildJob, runnerA,
    );
    const ucB = new GeneratePublicationUseCase(
      repoB, msPort, cmPort, jobB as unknown as PublicationBuildJob, runnerB,
    );

    // Act: trigger both concurrently with different empresa ids.
    await Promise.all([
      ucA.execute({ projetoId: PROJETO_ID }, makeUser('empresa-aetos')),
      ucB.execute({ projetoId: PROJETO_ID_B }, makeUser('empresa-beta')),
    ]);
    await Promise.resolve();
    await Promise.resolve();

    // Assert: each runner was called with its own empresaId — no sharing.
    expect(capturedEmpresaIds).toContain('empresa-aetos');
    expect(capturedEmpresaIds).toContain('empresa-beta');
    expect(runnerA.runAs).toHaveBeenCalledWith('empresa-aetos', expect.any(Function));
    expect(runnerB.runAs).toHaveBeenCalledWith('empresa-beta', expect.any(Function));
  });
});
