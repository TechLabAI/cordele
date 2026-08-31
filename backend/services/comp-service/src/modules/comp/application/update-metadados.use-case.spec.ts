import { UpdateMetadadosUseCase } from './update-metadados.use-case';
import { Metadados } from '../../../domain/comp/metadados.aggregate';
import type { MetadadosRepository } from '../ports/metadados-repository.port';
import type { DomainEventEmitter } from '../ports/domain-event-emitter.port';
import { DomainException } from '../../../domain/shared/domain-exception';

/**
 * Unit spec for UpdateMetadadosUseCase (COMP-004).
 *
 * Repository and DomainEventEmitter are mocked with jest.fn() — no DB, no Nest bootstrap.
 *
 * Covers:
 *   - Create path (no existing row)
 *   - Update path (existing row with different fields)
 *   - Idempotency: identical payload → no second upsert, no event emitted
 *   - Event emission on real mutation
 *   - Domain invariant propagation (blank titulo, invalid idioma)
 */

const PROJETO_ID = '11111111-1111-4111-8111-111111111111';
const EMPRESA_SLUG = 'aetos';

const makeRepo = (): jest.Mocked<MetadadosRepository> => ({
  findByProjetoId: jest.fn(),
  findManyByProjetoIds: jest.fn(),
  upsert: jest.fn(),
  delete: jest.fn(),
});

const makeEventEmitter = (): jest.Mocked<DomainEventEmitter> => ({
  emit: jest.fn(),
});

const makePersistedAggregate = (overrides: {
  titulo?: string;
  autor?: string;
  idioma?: 'pt' | 'en' | 'es' | 'fr';
  isbn?: string | null;
  categoria?: string | null;
} = {}): Metadados =>
  new Metadados({
    projetoId: PROJETO_ID,
    titulo: overrides.titulo ?? 'Titulo Original',
    autor: overrides.autor ?? 'Autor Original',
    idioma: overrides.idioma ?? 'pt',
    isbn: overrides.isbn ?? null,
    categoria: overrides.categoria ?? null,
    empresaSlug: EMPRESA_SLUG,
    materialized: true,
  });

describe('UpdateMetadadosUseCase', () => {
  let useCase: UpdateMetadadosUseCase;
  let repo: jest.Mocked<MetadadosRepository>;
  let eventEmitter: jest.Mocked<DomainEventEmitter>;

  beforeEach(() => {
    repo = makeRepo();
    eventEmitter = makeEventEmitter();
    useCase = new UpdateMetadadosUseCase(
      repo as unknown as MetadadosRepository,
      eventEmitter as unknown as DomainEventEmitter,
    );
  });

  // ---------------------------------------------------------------------------
  // Create path (no existing row)
  // ---------------------------------------------------------------------------

  it('creates a new row (upsert) when no existing record is found', async () => {
    const persisted = makePersistedAggregate({ titulo: 'Novo Livro' });
    repo.findByProjetoId.mockResolvedValue(null);
    repo.upsert.mockResolvedValue(persisted);

    const result = await useCase.execute({
      projetoId: PROJETO_ID,
      empresaSlug: EMPRESA_SLUG,
      titulo: 'Novo Livro',
      autor: 'Autor',
      idioma: 'pt',
    });

    expect(repo.upsert).toHaveBeenCalledTimes(1);
    const upsertArg = repo.upsert.mock.calls[0][0];
    expect(upsertArg.titulo).toBe('Novo Livro');
    expect(upsertArg.materialized).toBe(true);
    expect(result).toBe(persisted);
  });

  it('emits MetadataUpdated after creating a new row', async () => {
    const persisted = makePersistedAggregate({ titulo: 'Novo Livro' });
    repo.findByProjetoId.mockResolvedValue(null);
    repo.upsert.mockResolvedValue(persisted);

    await useCase.execute({
      projetoId: PROJETO_ID,
      empresaSlug: EMPRESA_SLUG,
      titulo: 'Novo Livro',
      autor: 'Autor',
      idioma: 'pt',
    });

    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'MetadataUpdated',
      expect.objectContaining({ projetoId: PROJETO_ID, empresaSlug: EMPRESA_SLUG }),
    );
  });

  // ---------------------------------------------------------------------------
  // Update path (existing row with different fields)
  // ---------------------------------------------------------------------------

  it('updates an existing row preserving other fields', async () => {
    const existing = makePersistedAggregate();
    const updatedAggregate = existing.update({
      titulo: 'Titulo Novo',
      autor: 'Autor Original',
      idioma: 'pt',
    });
    repo.findByProjetoId.mockResolvedValue(existing);
    repo.upsert.mockResolvedValue(updatedAggregate);

    await useCase.execute({
      projetoId: PROJETO_ID,
      empresaSlug: EMPRESA_SLUG,
      titulo: 'Titulo Novo',
      autor: 'Autor Original',
      idioma: 'pt',
    });

    const upsertArg = repo.upsert.mock.calls[0][0];
    expect(upsertArg.titulo).toBe('Titulo Novo');
    expect(upsertArg.materialized).toBe(true);
  });

  it('emits MetadataUpdated after updating an existing row with different fields', async () => {
    const existing = makePersistedAggregate();
    const updated = existing.update({ titulo: 'Titulo Novo', autor: 'Autor Original', idioma: 'pt' });
    repo.findByProjetoId.mockResolvedValue(existing);
    repo.upsert.mockResolvedValue(updated);

    await useCase.execute({
      projetoId: PROJETO_ID,
      empresaSlug: EMPRESA_SLUG,
      titulo: 'Titulo Novo',
      autor: 'Autor Original',
      idioma: 'pt',
    });

    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith('MetadataUpdated', expect.any(Object));
  });

  it('stores optional isbn and categoria when provided', async () => {
    repo.findByProjetoId.mockResolvedValue(null);
    repo.upsert.mockImplementation(async (e) => e);

    await useCase.execute({
      projetoId: PROJETO_ID,
      empresaSlug: EMPRESA_SLUG,
      titulo: 'T',
      autor: 'A',
      idioma: 'pt',
      isbn: '978-85-1234-567-8',
      categoria: 'Literatura',
    });

    const upsertArg = repo.upsert.mock.calls[0][0];
    expect(upsertArg.isbn).toBe('978-85-1234-567-8');
    expect(upsertArg.categoria).toBe('Literatura');
  });

  // ---------------------------------------------------------------------------
  // Idempotency (COMP-004 / SPEC-05): identical payload → no-op
  // ---------------------------------------------------------------------------

  it('is a no-op when the payload is identical to the persisted state (upsert not called)', async () => {
    const existing = makePersistedAggregate({
      titulo: 'Titulo',
      autor: 'Autor',
      idioma: 'pt',
      isbn: null,
      categoria: null,
    });
    repo.findByProjetoId.mockResolvedValue(existing);

    const result = await useCase.execute({
      projetoId: PROJETO_ID,
      empresaSlug: EMPRESA_SLUG,
      titulo: 'Titulo',
      autor: 'Autor',
      idioma: 'pt',
    });

    // upsert must NOT be called on no-op.
    expect(repo.upsert).not.toHaveBeenCalled();
    // Returns the existing entity unchanged.
    expect(result).toBe(existing);
  });

  it('does NOT emit MetadataUpdated when the payload is identical (no-op)', async () => {
    const existing = makePersistedAggregate({
      titulo: 'Titulo',
      autor: 'Autor',
      idioma: 'pt',
    });
    repo.findByProjetoId.mockResolvedValue(existing);

    await useCase.execute({
      projetoId: PROJETO_ID,
      empresaSlug: EMPRESA_SLUG,
      titulo: 'Titulo',
      autor: 'Autor',
      idioma: 'pt',
    });

    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('is NOT a no-op when only isbn changes', async () => {
    const existing = makePersistedAggregate({ isbn: '978-00-0000-000-0' });
    repo.findByProjetoId.mockResolvedValue(existing);
    repo.upsert.mockImplementation(async (e) => e);

    await useCase.execute({
      projetoId: PROJETO_ID,
      empresaSlug: EMPRESA_SLUG,
      titulo: 'Titulo Original',
      autor: 'Autor Original',
      idioma: 'pt',
      isbn: '978-11-1111-111-1',
    });

    expect(repo.upsert).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
  });

  it('is a no-op even when the non-materialized placeholder exists (edge case: GET before first PUT)', async () => {
    // A non-materialized placeholder (materialized=false) is returned by GET
    // before the first PUT. A subsequent PUT should still write (not skip).
    const placeholder = new Metadados({
      projetoId: PROJETO_ID,
      titulo: '',
      autor: '',
      idioma: 'pt',
      empresaSlug: EMPRESA_SLUG,
      materialized: false,
    });
    repo.findByProjetoId.mockResolvedValue(placeholder);
    repo.upsert.mockImplementation(async (e) => e);

    // First real PUT — should not be treated as no-op even if fields happen to match.
    await useCase.execute({
      projetoId: PROJETO_ID,
      empresaSlug: EMPRESA_SLUG,
      titulo: 'Real Titulo',
      autor: 'Real Autor',
      idioma: 'pt',
    });

    // Must write (placeholder is not materialized → idempotency check is skipped).
    expect(repo.upsert).toHaveBeenCalledTimes(1);
  });

  // ---------------------------------------------------------------------------
  // Domain invariants (delegated to Metadados.update)
  // ---------------------------------------------------------------------------

  it('rejects blank titulo via domain invariant', async () => {
    repo.findByProjetoId.mockResolvedValue(null);

    await expect(useCase.execute({
      projetoId: PROJETO_ID,
      empresaSlug: EMPRESA_SLUG,
      titulo: '',
      autor: 'A',
      idioma: 'pt',
    })).rejects.toThrow(DomainException);

    expect(repo.upsert).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  it('rejects invalid idioma via domain invariant', async () => {
    repo.findByProjetoId.mockResolvedValue(null);

    await expect(useCase.execute({
      projetoId: PROJETO_ID,
      empresaSlug: EMPRESA_SLUG,
      titulo: 'T',
      autor: 'A',
      idioma: 'de' as 'pt',
    })).rejects.toThrow(DomainException);
  });
});
