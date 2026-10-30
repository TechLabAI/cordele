/**
 * Unit spec for AdvanceProjetoStatusUseCase.
 *
 * Repository mocked via advanceStatusAtomic (the atomic lock + validate + write
 * method introduced in PROJ-004 to eliminate the TOCTOU race). Previous tests
 * used findById + updateStatus as two separate calls — those are replaced here
 * because the use case no longer calls them directly.
 *
 * What this spec covers:
 *   - Legal transition: advanceStatusAtomic returns changed=true → event emitted
 *   - Idempotent no-op: advanceStatusAtomic returns changed=false → no event
 *   - Illegal transition: advanceStatusAtomic throws IllegalStatusTransitionError
 *   - Not found: advanceStatusAtomic returns null → NotFoundException
 *
 * What this spec does NOT cover (by design):
 *   - The SELECT FOR UPDATE serialization between concurrent calls — that
 *     requires a real database and is tested in the e2e concurrency test.
 */

import { NotFoundException } from '@nestjs/common';
import { AdvanceProjetoStatusUseCase } from './advance-projeto-status.use-case';
import { ProjetoStatus } from '../../../domain/proj/value-objects/project-status.vo';
import { IllegalStatusTransitionError } from '../../../domain/proj/errors/illegal-status-transition.error';
import { ProjectStatusChangedEvent } from '../../../domain/proj/events/project-status-changed.event';
import type {
  ProjetoEditorialRepository,
  ProjetoEditorialData,
  AdvanceStatusAtomicResult,
} from '../../../domain/proj/projeto-editorial.repository';
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

const makeAtomicResult = (
  previousStatus: ProjetoStatus,
  newStatus: ProjetoStatus,
  changed: boolean,
): AdvanceStatusAtomicResult => ({
  data: makeProjetoData(newStatus),
  previousStatus,
  changed,
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
      delete: jest.fn(),
      findAll: jest.fn(),
      advanceStatusAtomic: jest.fn(),
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
    it('rascunho → em_composicao: calls advanceStatusAtomic and emits ProjectStatusChanged', async () => {
      const user = makeUser();
      mockRepository.advanceStatusAtomic.mockResolvedValue(
        makeAtomicResult(ProjetoStatus.rascunho, ProjetoStatus.em_composicao, true),
      );

      const result = await useCase.advanceTo(
        { projetoId: 'projeto-id-1', targetStatus: ProjetoStatus.em_composicao },
        user,
      );

      expect(result.changed).toBe(true);
      expect(result.newStatus).toBe(ProjetoStatus.em_composicao);
      expect(mockRepository.advanceStatusAtomic).toHaveBeenCalledTimes(1);
      expect(mockRepository.advanceStatusAtomic).toHaveBeenCalledWith({
        id: 'projeto-id-1',
        targetStatus: ProjetoStatus.em_composicao,
        changedBy: 'imp',
        empresaId: user.empresaId,
      });
    });

    it('emits ProjectStatusChanged with unique eventId and correct status fields', async () => {
      mockRepository.advanceStatusAtomic.mockResolvedValue(
        makeAtomicResult(ProjetoStatus.rascunho, ProjetoStatus.em_composicao, true),
      );

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

    it('em_composicao → publicado: uses changedBy=pub', async () => {
      mockRepository.advanceStatusAtomic.mockResolvedValue(
        makeAtomicResult(ProjetoStatus.em_composicao, ProjetoStatus.publicado, true),
      );

      await useCase.advanceTo(
        { projetoId: 'projeto-id-1', targetStatus: ProjetoStatus.publicado },
        makeUser(),
      );

      expect(mockRepository.advanceStatusAtomic).toHaveBeenCalledWith(
        expect.objectContaining({ changedBy: 'pub' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Idempotent no-op (SPEC-02 IMP idempotency rule)
  // ---------------------------------------------------------------------------

  describe('advanceTo() — idempotent no-op', () => {
    it('returns changed=false when advanceStatusAtomic returns changed=false', async () => {
      mockRepository.advanceStatusAtomic.mockResolvedValue(
        makeAtomicResult(ProjetoStatus.em_composicao, ProjetoStatus.em_composicao, false),
      );

      const result = await useCase.advanceTo(
        { projetoId: 'projeto-id-1', targetStatus: ProjetoStatus.em_composicao },
        makeUser(),
      );

      expect(result.changed).toBe(false);
      expect(result.newStatus).toBe(ProjetoStatus.em_composicao);
    });

    it('does NOT emit event on idempotent no-op', async () => {
      mockRepository.advanceStatusAtomic.mockResolvedValue(
        makeAtomicResult(ProjetoStatus.em_composicao, ProjetoStatus.em_composicao, false),
      );

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
    it('propagates IllegalStatusTransitionError thrown by advanceStatusAtomic', async () => {
      mockRepository.advanceStatusAtomic.mockRejectedValue(
        new IllegalStatusTransitionError(ProjetoStatus.rascunho, ProjetoStatus.publicado, 'not reachable'),
      );

      await expect(
        useCase.advanceTo(
          { projetoId: 'projeto-id-1', targetStatus: ProjetoStatus.publicado },
          makeUser(),
        ),
      ).rejects.toThrow(IllegalStatusTransitionError);
    });

    it('does not emit event on illegal transition', async () => {
      mockRepository.advanceStatusAtomic.mockRejectedValue(
        new IllegalStatusTransitionError(ProjetoStatus.rascunho, ProjetoStatus.publicado, 'not reachable'),
      );

      await expect(
        useCase.advanceTo(
          { projetoId: 'projeto-id-1', targetStatus: ProjetoStatus.publicado },
          makeUser(),
        ),
      ).rejects.toThrow();

      expect(mockPublisher.publish).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Not found
  // ---------------------------------------------------------------------------

  describe('advanceTo() — project not found', () => {
    it('throws NotFoundException when advanceStatusAtomic returns null', async () => {
      mockRepository.advanceStatusAtomic.mockResolvedValue(null);

      await expect(
        useCase.advanceTo(
          { projetoId: 'non-existent', targetStatus: ProjetoStatus.em_composicao },
          makeUser(),
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
