/**
 * Unit spec for CreateProjetoEditorialUseCase.
 *
 * Repository and event publisher are mocked with jest.fn() — no DB, no Nest
 * bootstrap, no EventEmitter2. Verifies PROJ-003 acceptance criteria:
 *   - Valid nome creates the project and emits ProjectCreated
 *   - Empty nome throws a validation error; nothing is persisted
 *   - editoraId is resolved from UsuarioContext, never from request body
 */

import { CreateProjetoEditorialUseCase } from './create-projeto-editorial.use-case';
import { ProjetoStatus } from '../../../domain/proj/value-objects/project-status.vo';
import { ProjectCreatedEvent } from '../../../domain/proj/events/project-created.event';
import { type ProjetoEditorialRepository } from '../../../domain/proj/projeto-editorial.repository';
import { type IProjectEventPublisher } from '../proj.event-publisher.interface';
import { type UsuarioContext } from '../../../domain/shared/usuario-context.interface';

const makeUser = (override?: Partial<UsuarioContext>): UsuarioContext => ({
  id: 'user-id-1',
  empresaId: 'empresa-id-aetos',
  scopes: ['proj:write'],
  ...override,
});

const makeProjetoData = (nome: string, empresaId: string) => ({
  id: 'projeto-id-1',
  nome,
  descricao: null,
  editoraId: empresaId,
  status: ProjetoStatus.rascunho,
  criadoEm: new Date('2024-01-01T00:00:00Z'),
  atualizadoEm: new Date('2024-01-01T00:00:00Z'),
});

describe('CreateProjetoEditorialUseCase', () => {
  let useCase: CreateProjetoEditorialUseCase;
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

    // We bypass the Nest DI container for unit tests and inject mocks directly.
    useCase = new CreateProjetoEditorialUseCase(
      mockRepository as unknown as ProjetoEditorialRepository,
      mockPublisher,
    );
  });

  // ---------------------------------------------------------------------------
  // PROJ-003 criterion 1: valid nome creates + emits
  // ---------------------------------------------------------------------------

  describe('execute() — valid input', () => {
    it('persists ProjetoEditorial with status rascunho', async () => {
      const user = makeUser();
      mockRepository.create.mockResolvedValue(makeProjetoData('Romance das Cidades', user.empresaId));

      await useCase.execute({ nome: 'Romance das Cidades' }, user);

      expect(mockRepository.create).toHaveBeenCalledTimes(1);
      const callArg = mockRepository.create.mock.calls[0][0];
      expect(callArg.nome).toBe('Romance das Cidades');
      expect(callArg.status).toBe(ProjetoStatus.rascunho);
    });

    it('emits ProjectCreated with unique eventId after persisting', async () => {
      const user = makeUser();
      mockRepository.create.mockResolvedValue(makeProjetoData('Romance das Cidades', user.empresaId));

      await useCase.execute({ nome: 'Romance das Cidades' }, user);

      expect(mockPublisher.publish).toHaveBeenCalledTimes(1);
      const [eventName, payload] = mockPublisher.publish.mock.calls[0];
      expect(eventName).toBe('ProjectCreated');
      expect(payload).toBeInstanceOf(ProjectCreatedEvent);
      const event = payload as ProjectCreatedEvent;
      expect(event.eventId).toBeDefined();
      expect(event.status).toBe('rascunho');
    });

    it('returns the persisted ProjetoEditorial data', async () => {
      const user = makeUser();
      const expectedData = makeProjetoData('Romance das Cidades', user.empresaId);
      mockRepository.create.mockResolvedValue(expectedData);

      const result = await useCase.execute({ nome: 'Romance das Cidades' }, user);

      expect(result).toEqual(expectedData);
    });

    it('trims whitespace from nome before persisting', async () => {
      const user = makeUser();
      mockRepository.create.mockResolvedValue(makeProjetoData('Romance das Cidades', user.empresaId));

      await useCase.execute({ nome: '  Romance das Cidades  ' }, user);

      const callArg = mockRepository.create.mock.calls[0][0];
      expect(callArg.nome).toBe('Romance das Cidades');
    });
  });

  // ---------------------------------------------------------------------------
  // PROJ-003 criterion 3: editoraId from context, not from body
  // ---------------------------------------------------------------------------

  describe('execute() — editoraId resolved from UsuarioContext', () => {
    it('uses user.empresaId as editoraId, ignoring any body field', async () => {
      const user = makeUser({ empresaId: 'empresa-id-aetos' });
      mockRepository.create.mockResolvedValue(makeProjetoData('Livro', user.empresaId));

      await useCase.execute({ nome: 'Livro' }, user);

      const callArg = mockRepository.create.mock.calls[0][0];
      expect(callArg.editoraId).toBe('empresa-id-aetos');
    });

    it('does not accept editoraId from the input object', async () => {
      const user = makeUser({ empresaId: 'empresa-id-aetos' });
      mockRepository.create.mockResolvedValue(makeProjetoData('Livro', user.empresaId));

      // Even if caller passes a rogue editoraId in the input, it is ignored.
      await useCase.execute(
        { nome: 'Livro', ...({ editoraId: 'rogue-id' } as object) } as Parameters<typeof useCase.execute>[0],
        user,
      );

      const callArg = mockRepository.create.mock.calls[0][0];
      expect(callArg.editoraId).toBe('empresa-id-aetos');
    });
  });

  // ---------------------------------------------------------------------------
  // PROJ-003 criterion 2: empty nome throws ValidationError; nothing persisted
  // ---------------------------------------------------------------------------

  describe('execute() — validation errors', () => {
    it('throws when nome is empty string', async () => {
      await expect(
        useCase.execute({ nome: '' }, makeUser()),
      ).rejects.toThrow(/nome is required/i);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('throws when nome is only whitespace', async () => {
      await expect(
        useCase.execute({ nome: '   ' }, makeUser()),
      ).rejects.toThrow(/nome is required/i);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('throws when nome exceeds 200 characters', async () => {
      const tooLong = 'A'.repeat(201);
      await expect(
        useCase.execute({ nome: tooLong }, makeUser()),
      ).rejects.toThrow(/200/);
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('does not emit an event when validation fails', async () => {
      await expect(
        useCase.execute({ nome: '' }, makeUser()),
      ).rejects.toThrow();
      expect(mockPublisher.publish).not.toHaveBeenCalled();
    });

    // ---------------------------------------------------------------------------
    // PROJ-003 criterion 4: error type maps to HTTP 400 urn:cordele:proj:validation
    // ---------------------------------------------------------------------------

    it('throws with type=urn:cordele:proj:validation when nome is empty (400 mapping)', async () => {
      let caught: unknown;
      try {
        await useCase.execute({ nome: '' }, makeUser());
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeDefined();
      expect((caught as { type?: string }).type).toBe('urn:cordele:proj:validation');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });

    it('throws with type=urn:cordele:proj:validation when nome exceeds 200 chars', async () => {
      let caught: unknown;
      try {
        await useCase.execute({ nome: 'A'.repeat(201) }, makeUser());
      } catch (err) {
        caught = err;
      }
      expect(caught).toBeDefined();
      expect((caught as { type?: string }).type).toBe('urn:cordele:proj:validation');
      expect(mockRepository.create).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // In-process port (CreateProjetoEditorialPort for IMP)
  // ---------------------------------------------------------------------------

  describe('create() — IMP in-process port', () => {
    it('returns projetoId when titulo is valid', async () => {
      const expectedId = 'some-uuid';
      mockRepository.create.mockResolvedValue(
        makeProjetoData('Poesia Concreta', 'context-resolved'),
      );
      // Override the returned id to match what we expect
      mockRepository.create.mockResolvedValueOnce({
        id: expectedId,
        nome: 'Poesia Concreta',
        editoraId: 'context-resolved',
        status: ProjetoStatus.rascunho,
        criadoEm: new Date(),
        atualizadoEm: new Date(),
      });

      const result = await useCase.create({ titulo: 'Poesia Concreta' });

      expect(result).toHaveProperty('projetoId');
      expect(typeof result.projetoId).toBe('string');
    });
  });
});
