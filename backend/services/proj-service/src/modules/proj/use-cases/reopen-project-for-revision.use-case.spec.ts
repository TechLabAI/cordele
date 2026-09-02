/**
 * Unit spec for ReopenProjectForRevisionUseCase.
 *
 * Repository and event publisher mocked with jest.fn(). Verifies PROJ-005:
 *   - Reopen from publicado returns 200 with em_composicao
 *   - Idempotent on em_composicao (no event, no DB write)
 *   - Rejects from rascunho with IllegalStatusTransitionError
 *   - ProjectStatusChanged emitted with solicitadoPor=editor on actual change
 */

import { NotFoundException } from '@nestjs/common';
import { ReopenProjectForRevisionUseCase } from './reopen-project-for-revision.use-case';
import { ProjetoStatus } from '../../../domain/proj/value-objects/project-status.vo';
import { IllegalStatusTransitionError } from '../../../domain/proj/errors/illegal-status-transition.error';
import { ProjectStatusChangedEvent } from '../../../domain/proj/events/project-status-changed.event';
import { type ProjetoEditorialRepository, type ProjetoEditorialData } from '../../../domain/proj/projeto-editorial.repository';
import { type IProjectEventPublisher } from '../proj.event-publisher.interface';
import { type UsuarioContext } from '../../../domain/shared/usuario-context.interface';

const makeUser = (): UsuarioContext => ({
  id: 'user-editor-1',
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

describe('ReopenProjectForRevisionUseCase', () => {
  let useCase: ReopenProjectForRevisionUseCase;
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

    useCase = new ReopenProjectForRevisionUseCase(
      mockRepository as unknown as ProjetoEditorialRepository,
      mockPublisher,
    );
  });

  // ---------------------------------------------------------------------------
  // Successful reopen
  // ---------------------------------------------------------------------------

  describe('reopen() — successful backward transitions', () => {
    it('publicado → em_composicao: returns changed=true with new status', async () => {
      mockRepository.findById.mockResolvedValue(makeProjetoData(ProjetoStatus.publicado));
      mockRepository.updateStatus.mockResolvedValue(makeProjetoData(ProjetoStatus.em_composicao));

      const result = await useCase.reopen('projeto-id-1', makeUser());

      expect(result.changed).toBe(true);
      expect(result.newStatus).toBe(ProjetoStatus.em_composicao);
    });

    it('com_erros → em_composicao: returns changed=true', async () => {
      mockRepository.findById.mockResolvedValue(makeProjetoData(ProjetoStatus.com_erros));
      mockRepository.updateStatus.mockResolvedValue(makeProjetoData(ProjetoStatus.em_composicao));

      const result = await useCase.reopen('projeto-id-1', makeUser());

      expect(result.changed).toBe(true);
      expect(result.newStatus).toBe(ProjetoStatus.em_composicao);
    });

    it('emits ProjectStatusChanged with solicitadoPor=editor on actual change', async () => {
      mockRepository.findById.mockResolvedValue(makeProjetoData(ProjetoStatus.publicado));
      mockRepository.updateStatus.mockResolvedValue(makeProjetoData(ProjetoStatus.em_composicao));

      await useCase.reopen('projeto-id-1', makeUser());

      expect(mockPublisher.publish).toHaveBeenCalledTimes(1);
      const [eventName, payload] = mockPublisher.publish.mock.calls[0];
      expect(eventName).toBe('ProjectStatusChanged');
      expect(payload).toBeInstanceOf(ProjectStatusChangedEvent);
      const event = payload as ProjectStatusChangedEvent;
      expect(event.solicitadoPor).toBe('editor');
      expect(event.statusDe).toBe(ProjetoStatus.publicado);
      expect(event.statusPara).toBe(ProjetoStatus.em_composicao);
    });
  });

  // ---------------------------------------------------------------------------
  // Idempotent no-op
  // ---------------------------------------------------------------------------

  describe('reopen() — idempotent on em_composicao', () => {
    it('returns changed=false when project is already em_composicao', async () => {
      mockRepository.findById.mockResolvedValue(makeProjetoData(ProjetoStatus.em_composicao));

      const result = await useCase.reopen('projeto-id-1', makeUser());

      expect(result.changed).toBe(false);
      expect(result.newStatus).toBe(ProjetoStatus.em_composicao);
    });

    it('does NOT call updateStatus on no-op', async () => {
      mockRepository.findById.mockResolvedValue(makeProjetoData(ProjetoStatus.em_composicao));

      await useCase.reopen('projeto-id-1', makeUser());

      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
    });

    it('does NOT emit event on no-op (idempotent)', async () => {
      mockRepository.findById.mockResolvedValue(makeProjetoData(ProjetoStatus.em_composicao));

      await useCase.reopen('projeto-id-1', makeUser());

      expect(mockPublisher.publish).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Rejection: rascunho → IllegalStatusTransitionError
  // ---------------------------------------------------------------------------

  describe('reopen() — rascunho rejected', () => {
    it('throws IllegalStatusTransitionError when project is in rascunho', async () => {
      mockRepository.findById.mockResolvedValue(makeProjetoData(ProjetoStatus.rascunho));

      await expect(useCase.reopen('projeto-id-1', makeUser())).rejects.toThrow(
        IllegalStatusTransitionError,
      );
    });

    it('does not persist or emit when rascunho rejection fires', async () => {
      mockRepository.findById.mockResolvedValue(makeProjetoData(ProjetoStatus.rascunho));

      await expect(useCase.reopen('projeto-id-1', makeUser())).rejects.toThrow();

      expect(mockRepository.updateStatus).not.toHaveBeenCalled();
      expect(mockPublisher.publish).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Not found
  // ---------------------------------------------------------------------------

  describe('reopen() — project not found', () => {
    it('throws NotFoundException when findById returns null', async () => {
      mockRepository.findById.mockResolvedValue(null);

      await expect(useCase.reopen('non-existent', makeUser())).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
