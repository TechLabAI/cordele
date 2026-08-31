import { ForbiddenException, NotFoundException } from '@nestjs/common';

import { type AuthenticatedUser } from '../../../domain/auth/authenticated-user';
import { type PublicacaoRepositoryPort } from '../ports/publicacao-repository.port';
import { type ValidationMessageRepositoryPort } from '../../../domain/pub/ports/validation-message-repository.port';
import { ValidationMessageEntity } from '../../../domain/pub/validation-message.entity';
import { ValidationSeverity } from '../../../domain/pub/validation-severity.enum';
import { PublicacaoEntity } from '../../../domain/pub/publicacao.entity';
import { ListValidationMessagesUseCase } from './list-validation-messages.use-case';

const makeUser = (): AuthenticatedUser => ({
  userId: 'user-1',
  username: 'editor',
  roles: ['pub-user'],
  scopes: ['pub:read'],
  empresaId: 'empresa-aetos',
});

const makePublicacao = (): PublicacaoEntity =>
  PublicacaoEntity.iniciar({
    id: 'pub-uuid-1',
    projetoId: 'proj-uuid-1',
    sequencia: 1,
    iniciadaEm: new Date('2026-08-25T12:00:00Z'),
  });

const makeMessage = (overrides: Partial<{
  id: string;
  severity: ValidationSeverity;
  code: string;
  message: string;
  location: string;
  ordem: number;
}>): ValidationMessageEntity =>
  new ValidationMessageEntity({
    id: overrides.id ?? 'msg-uuid-1',
    publicacaoId: 'pub-uuid-1',
    severity: overrides.severity ?? ValidationSeverity.ERROR,
    code: overrides.code ?? 'OPF-033',
    message: overrides.message ?? 'Duplicate spine item',
    location: overrides.location,
    ordem: overrides.ordem ?? 0,
    criadoEm: new Date('2026-08-25T12:01:00Z'),
  });

describe('ListValidationMessagesUseCase', () => {
  let publicacaoRepository: jest.Mocked<PublicacaoRepositoryPort>;
  let validationMessageRepository: jest.Mocked<ValidationMessageRepositoryPort>;
  let useCase: ListValidationMessagesUseCase;

  beforeEach(() => {
    publicacaoRepository = {
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
    validationMessageRepository = {
      findByPublicacaoAndSeverity: jest.fn(),
    };
    useCase = new ListValidationMessagesUseCase(
      publicacaoRepository,
      validationMessageRepository,
    );
  });

  describe('empresa guard', () => {
    it('throws ForbiddenException when the caller carries no empresa claim', async () => {
      await expect(
        useCase.execute(
          { projetoId: 'proj-uuid-1', publicacaoId: 'pub-uuid-1' },
          { ...makeUser(), empresaId: '' },
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('cross-tenant guard', () => {
    it('throws NotFoundException when publicacao does not exist in the project/empresa', async () => {
      publicacaoRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute(
          { projetoId: 'proj-uuid-1', publicacaoId: 'pub-uuid-other' },
          makeUser(),
        ),
      ).rejects.toThrow(NotFoundException);

      expect(publicacaoRepository.findById).toHaveBeenCalledWith('proj-uuid-1', 'pub-uuid-other');
      expect(validationMessageRepository.findByPublicacaoAndSeverity).not.toHaveBeenCalled();
    });
  });

  describe('returns messages filtered by severity', () => {
    it('returns only error messages when severity=error is provided', async () => {
      publicacaoRepository.findById.mockResolvedValue(makePublicacao());
      const errorMsg = makeMessage({ severity: ValidationSeverity.ERROR, ordem: 0 });
      validationMessageRepository.findByPublicacaoAndSeverity.mockResolvedValue([errorMsg]);

      const result = await useCase.execute(
        { projetoId: 'proj-uuid-1', publicacaoId: 'pub-uuid-1', severity: 'error' },
        makeUser(),
      );

      expect(validationMessageRepository.findByPublicacaoAndSeverity).toHaveBeenCalledWith(
        'pub-uuid-1',
        'error',
      );
      expect(result).toHaveLength(1);
      expect(result[0].severity).toBe(ValidationSeverity.ERROR);
    });

    it('returns all messages when severity is omitted', async () => {
      publicacaoRepository.findById.mockResolvedValue(makePublicacao());
      const messages = [
        makeMessage({ id: 'msg-1', severity: ValidationSeverity.ERROR, ordem: 0 }),
        makeMessage({ id: 'msg-2', severity: ValidationSeverity.WARNING, ordem: 1 }),
        makeMessage({ id: 'msg-3', severity: ValidationSeverity.INFO, ordem: 2 }),
      ];
      validationMessageRepository.findByPublicacaoAndSeverity.mockResolvedValue(messages);

      const result = await useCase.execute(
        { projetoId: 'proj-uuid-1', publicacaoId: 'pub-uuid-1' },
        makeUser(),
      );

      expect(validationMessageRepository.findByPublicacaoAndSeverity).toHaveBeenCalledWith(
        'pub-uuid-1',
        undefined,
      );
      expect(result).toHaveLength(3);
    });
  });

  describe('ordering', () => {
    it('returns messages in the order provided by the repository (ordered by ordem ASC)', async () => {
      publicacaoRepository.findById.mockResolvedValue(makePublicacao());
      const messages = [
        makeMessage({ id: 'msg-a', ordem: 0 }),
        makeMessage({ id: 'msg-b', ordem: 1 }),
        makeMessage({ id: 'msg-c', ordem: 2 }),
      ];
      validationMessageRepository.findByPublicacaoAndSeverity.mockResolvedValue(messages);

      const result = await useCase.execute(
        { projetoId: 'proj-uuid-1', publicacaoId: 'pub-uuid-1' },
        makeUser(),
      );

      expect(result.map((m) => m.ordem)).toEqual([0, 1, 2]);
    });
  });

  describe('empty result', () => {
    it('returns empty array when no messages exist for the publication', async () => {
      publicacaoRepository.findById.mockResolvedValue(makePublicacao());
      validationMessageRepository.findByPublicacaoAndSeverity.mockResolvedValue([]);

      const result = await useCase.execute(
        { projetoId: 'proj-uuid-1', publicacaoId: 'pub-uuid-1' },
        makeUser(),
      );

      expect(result).toEqual([]);
    });
  });
});
