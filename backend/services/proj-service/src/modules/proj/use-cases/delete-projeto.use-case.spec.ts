/**
 * Unit spec for DeleteProjetoUseCase (PROJ-016).
 *
 * Repository and erasure ports mocked with jest.fn(). Verifies the P6
 * contract:
 *   - Purge order PUB → COMP → IMP → DB delete (spy call order)
 *   - Failure at any erasure port aborts the cascade: DB delete NOT called,
 *     BadGatewayException (502) surfaced
 *   - Retry after a partial failure completes without error once the
 *     failing port succeeds (idempotent re-run of the full sequence)
 *   - ProjectDeleted emitted only after the DB delete succeeds
 */

import { BadGatewayException, NotFoundException } from '@nestjs/common';
import { DeleteProjetoUseCase } from './delete-projeto.use-case';
import { type ProjetoEditorialRepository, type ProjetoEditorialData } from '../../../domain/proj/projeto-editorial.repository';
import { ProjetoStatus } from '../../../domain/proj/value-objects/project-status.vo';
import { type PublicationErasurePort } from '../../../domain/proj/ports/outbound/publication-erasure.port';
import { type CompositionErasurePort } from '../../../domain/proj/ports/outbound/composition-erasure.port';
import { type ManuscriptErasurePort } from '../../../domain/proj/ports/outbound/manuscript-erasure.port';
import { type IProjectEventPublisher } from '../proj.event-publisher.interface';
import { type UsuarioContext } from '../../../domain/shared/usuario-context.interface';

const makeUser = (): UsuarioContext => ({
  id: 'user-id-1',
  empresaId: 'empresa-id-aetos',
  scopes: ['proj:write'],
});

const makeProjetoData = (): ProjetoEditorialData => ({
  id: 'projeto-id-1',
  nome: 'Meu Projeto',
  descricao: null,
  editoraId: 'empresa-id-aetos',
  status: ProjetoStatus.publicado,
  criadoEm: new Date('2024-01-01T00:00:00Z'),
  atualizadoEm: new Date('2024-01-01T00:00:00Z'),
});

describe('DeleteProjetoUseCase', () => {
  let useCase: DeleteProjetoUseCase;
  let mockRepository: jest.Mocked<ProjetoEditorialRepository>;
  let mockPublicationErasure: jest.Mocked<PublicationErasurePort>;
  let mockCompositionErasure: jest.Mocked<CompositionErasurePort>;
  let mockManuscriptErasure: jest.Mocked<ManuscriptErasurePort>;
  let mockPublisher: jest.Mocked<IProjectEventPublisher>;
  let callOrder: string[];

  beforeEach(() => {
    callOrder = [];

    mockRepository = {
      create: jest.fn(),
      findById: jest.fn().mockResolvedValue(makeProjetoData()),
      updateStatus: jest.fn(),
      existsByIdAndEmpresa: jest.fn(),
      findAll: jest.fn(),
      delete: jest.fn().mockImplementation(async () => {
        callOrder.push('DB');
      }),
    };

    mockPublicationErasure = {
      erase: jest.fn().mockImplementation(async () => {
        callOrder.push('PUB');
      }),
    };

    mockCompositionErasure = {
      erase: jest.fn().mockImplementation(async () => {
        callOrder.push('COMP');
      }),
    };

    mockManuscriptErasure = {
      erase: jest.fn().mockImplementation(async () => {
        callOrder.push('IMP');
      }),
    };

    mockPublisher = {
      publish: jest.fn(),
    };

    useCase = new DeleteProjetoUseCase(
      mockRepository,
      mockPublicationErasure,
      mockCompositionErasure,
      mockManuscriptErasure,
      mockPublisher,
    );
  });

  it('throws NotFoundException when the project does not exist in this empresa', async () => {
    mockRepository.findById.mockResolvedValueOnce(null);

    await expect(
      useCase.execute({ projetoId: 'missing' }, makeUser()),
    ).rejects.toThrow(NotFoundException);

    expect(mockPublicationErasure.erase).not.toHaveBeenCalled();
  });

  it('purges in order PUB -> COMP -> IMP -> DB delete', async () => {
    await useCase.execute({ projetoId: 'projeto-id-1' }, makeUser());

    expect(callOrder).toEqual(['PUB', 'COMP', 'IMP', 'DB']);
  });

  it('emits ProjectDeleted only after the DB delete succeeds', async () => {
    await useCase.execute({ projetoId: 'projeto-id-1' }, makeUser());

    expect(mockPublisher.publish).toHaveBeenCalledTimes(1);
    expect(mockPublisher.publish).toHaveBeenCalledWith(
      'ProjectDeleted',
      expect.objectContaining({ projetoId: 'projeto-id-1' }),
    );
  });

  it('aborts the cascade and does NOT delete when PUB erasure fails', async () => {
    mockPublicationErasure.erase.mockRejectedValueOnce(new Error('PUB unreachable'));

    await expect(
      useCase.execute({ projetoId: 'projeto-id-1' }, makeUser()),
    ).rejects.toThrow(BadGatewayException);

    expect(mockCompositionErasure.erase).not.toHaveBeenCalled();
    expect(mockManuscriptErasure.erase).not.toHaveBeenCalled();
    expect(mockRepository.delete).not.toHaveBeenCalled();
    expect(mockPublisher.publish).not.toHaveBeenCalled();
  });

  it('aborts the cascade and does NOT delete when COMP erasure fails (PUB already ran)', async () => {
    mockCompositionErasure.erase.mockRejectedValueOnce(new Error('COMP unreachable'));

    await expect(
      useCase.execute({ projetoId: 'projeto-id-1' }, makeUser()),
    ).rejects.toThrow(BadGatewayException);

    expect(mockPublicationErasure.erase).toHaveBeenCalledTimes(1);
    expect(mockManuscriptErasure.erase).not.toHaveBeenCalled();
    expect(mockRepository.delete).not.toHaveBeenCalled();
  });

  it('aborts the cascade and does NOT delete when IMP erasure fails (PUB+COMP already ran)', async () => {
    mockManuscriptErasure.erase.mockRejectedValueOnce(new Error('IMP unreachable'));

    await expect(
      useCase.execute({ projetoId: 'projeto-id-1' }, makeUser()),
    ).rejects.toThrow(BadGatewayException);

    expect(mockPublicationErasure.erase).toHaveBeenCalledTimes(1);
    expect(mockCompositionErasure.erase).toHaveBeenCalledTimes(1);
    expect(mockRepository.delete).not.toHaveBeenCalled();
  });

  it('retry after a partial failure completes without error (idempotent re-run)', async () => {
    // First attempt: IMP fails after PUB/COMP already purged.
    mockManuscriptErasure.erase.mockRejectedValueOnce(new Error('IMP unreachable'));
    await expect(
      useCase.execute({ projetoId: 'projeto-id-1' }, makeUser()),
    ).rejects.toThrow(BadGatewayException);

    callOrder = [];

    // Retry: all ports are idempotent no-ops for already-erased data, so the
    // full sequence now completes.
    await useCase.execute({ projetoId: 'projeto-id-1' }, makeUser());

    expect(callOrder).toEqual(['PUB', 'COMP', 'IMP', 'DB']);
    expect(mockRepository.delete).toHaveBeenCalledTimes(1);
  });
});
