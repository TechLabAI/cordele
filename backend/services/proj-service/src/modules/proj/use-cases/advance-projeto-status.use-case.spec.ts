/**
 * Unit spec for AdvanceProjetoStatusUseCase.
 *
 * Repository and event publisher mocked with jest.fn(). Verifies PROJ-004:
 *   - Legal transition applies status + emits ProjectStatusChanged
 *   - Idempotent no-op returns changed=false without event
 *   - Illegal transition surfaces IllegalStatusTransitionError
 */

import { NotFoundException } from '@nestjs/common';
import { AdvanceProjetoStatusUseCase } from './advance-projeto-status.use-case';
import { ProjetoStatus } from '../../../domain/proj/value-objects/project-status.vo';
import { IllegalStatusTransitionError } from '../../../domain/proj/errors/illegal-status-transition.error';
import { ProjectStatusChangedEvent } from '../../../domain/proj/events/project-status-changed.event';
import { type ProjetoEditorialRepository, type ProjetoEditorialData } from '../../../domain/proj/projeto-editorial.repository';
import { type IProjectEventPublisher } from '../proj.event-publisher.interface';
import { type UsuarioContext } from '../../../domain/shared/usuario-context.interface';

const makeUser = (): UsuarioContext => ({
  id: 'user-id-1',
  empresaId: 'empresa-id-aetos',
  scopes: ['proj:write'],
});

const makeProjetoData = (status: ProjetoStatus): ProjetoEditorialData => ({
  id: 'projeto-id-1',
  nome: 'Meu Projeto',
  descricao: null,
  editoraId: 'empresa-id-aetos',
  status,
  criadoEm: new Date('2024-01-01T00:00:00Z'),
  atualizadoEm: new Date('2024-01-01T00:00:00Z'),
});

const makeUpdatedData = (status: ProjetoStatus): ProjetoEditorialData => ({
  ...makeProjetoData(status),
  atualizadoEm: new Date('2024-01-02T00:00:00Z'),
});

describe('AdvanceProjetoStatusUseCase', () => {
  let useCase: AdvanceProjetoStatusUseCase;
  let mockRepository: jest.Mocked<ProjetoEditorialRepository>;
  let mockPublisher: jest.Mocked<IProjectEventPublisher>;

  beforeEach(() => {
    mockRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      updateStatus: jest.fn(),
      existsByIdAndEmpresa: jest.fn(),
    };

    mockPublisher = {
      publish: jest.fn(),
    };

    useCase = new AdvanceProjetoStatusUseCase(
      mockRepository as unknown as ProjetoEditorialRepository,
      mockPublisher,
    );
  });

  // ---------------------------------------------------------------------------
  // Legal transitions
  // ---------------------------------------------------------------------------

  describe('advanceTo() — legal transition applies status + emits event', () => {
    it('rascunho → em_composicao: updates status and emits ProjectStatusChanged', async () => {
      const user = makeUser();
      mockRepository.findById.mockResolvedValue(makeProjetoData(ProjetoStatus.rascunho));
      mockRepository.updateStatus.mockResolvedValue(makeUpdatedData(ProjetoStatus.em_composicao));

      const result = await useCase.advanceTo(
        { projetoId: 'projeto-id-1', targetStatus: ProjetoStatus.em_composicao },
        user,
      );

      expect(result.changed).toBe(true);
      expect(result.newStatus).toBe(ProjetoStatus.em_composicao);
      expect(mockRepository.updateStatus).toHaveBeenCalledTimes(1);
    });

    it('emits ProjectStatusChanged with unique eventId', async () => {
      mockRepository.findById.mockResolvedValue(makeProjetoData(ProjetoStatus.rascunho));
      mockRepository.updateStatus.mockResolvedValue(makeUpdatedData(ProjetoStatus.em_composicao));

      await useCase.advanceTo(
        { projetoId: 'projeto-id-1', targetStatus: ProjetoStatus.em_composicao },
        makeUser(),
      );

      expect(mockPublisher.publish).toHaveBeenCalledTimes(1);
      const [eventName, payload] = mockPublisher.publish.mock.calls[0];
      expect(eventName).toBe('ProjectStatusChanged');
      expect(payload).toBeInstanceOf(ProjectStatusChangedEvent);
      const event = payload as ProjectStatusChangedEvent;
      expect(event.eventId).toBeDefined();
      expect(event.statusDe).toBe(ProjetoStatus.rascunho);
      expect(event.statusPara).toBe(ProjetoStatus.em_composicao);
    });
  });

  // ---------------------------------------------------------------------------
  // Idempotent no-op (SPEC-02 IMP idempotency rule)
  // ---------------------------------------------------------------------------

  describe('advanceTo() — idempotent no-op', () => {
    it('returns changed=false when project already has targetStatus', async () => {
      mockRepository.findById.mockResolvedValue(makeProjetoData(ProjetoStatus.em_composicao));

      const result = await useCase.advanceTo(
        { projetoId: 'projeto-id-1', targetStatus: ProjetoStatus.em_composicao },
        makeUser(),
      );

      expect(result.changed).toBe(false);
      expect(result.newStatus).toBe(ProjetoStatus.em_composicao);
    });

    it('does NOT call updateStatus on no-op', async () => {
      mockRepository.findById.mockResolvedValue(makeProjetoData(ProjetoStatus.em_composicao));

      await useCase.advanceTo(
        { projetoId: 'projeto-id-1', targetStatus: ProjetoStatus.em_composicao },
        makeUser(),
      );

      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('does NOT emit event on idempotent no-op', async () => {
      mockRepository.findById.mockResolvedValue(makeProjetoData(ProjetoStatus.em_composicao));

      await useCase.advanceTo(
        { projetoId: 'projeto-id-1', targetStatus: ProjetoStatus.em_composicao },
        makeUser(),
      );

      expect(mockPublisher.publish).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Illegal transition
  // ---------------------------------------------------------------------------

  describe('advanceTo() — illegal transition', () => {
    it('throws IllegalStatusTransitionError for rascunho → publicado', async () => {
      mockRepository.findById.mockResolvedValue(makeProjetoData(ProjetoStatus.rascunho));

      await expect(
        useCase.advanceTo(
          { projetoId: 'projeto-id-1', targetStatus: ProjetoStatus.publicado },
          makeUser(),
        ),
      ).rejects.toThrow(IllegalStatusTransitionError);
    });

    it('does not persist or emit on illegal transition', async () => {
      mockRepository.findById.mockResolvedValue(makeProjetoData(ProjetoStatus.rascunho));

      await expect(
        useCase.advanceTo(
          { projetoId: 'projeto-id-1', targetStatus: ProjetoStatus.publicado },
          makeUser(),
        ),
      ).rejects.toThrow();

      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockPublisher.publish).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Not found
  // ---------------------------------------------------------------------------

  describe('advanceTo() — project not found', () => {
    it('throws NotFoundException when findById returns null', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.advanceTo(
          { projetoId: 'non-existent', targetStatus: ProjetoStatus.em_composicao },
          makeUser(),
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
