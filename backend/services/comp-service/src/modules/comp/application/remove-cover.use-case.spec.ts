import { RemoveCoverUseCase } from './remove-cover.use-case';
import { Metadados } from '../../../domain/comp/metadados.aggregate';
import type { MetadadosRepository } from '../ports/metadados-repository.port';
import type { FileStoragePort } from '../ports/file-storage.port';
import type { DomainEventEmitter } from '../ports/domain-event-emitter.port';

/**
 * Unit spec for RemoveCoverUseCase (COMP-005).
 *
 * All ports are mocked with jest.fn() — no disk, no DB, no Nest.
 *
 * Covers:
 *   - Happy path: cover exists → storage.delete + upsert + MetadataUpdated event
 *   - Idempotency: no row → no-op, no event
 *   - Idempotency: capaUrl already null → clears but does NOT emit event
 *   - Error propagation
 */

const PROJETO_ID = '11111111-1111-4111-8111-111111111111';
const EMPRESA_SLUG = 'aetos';

const makeRepo = (): jest.Mocked<MetadadosRepository> => ({
  findByProjetoId: jest.fn(),
  findManyByProjetoIds: jest.fn(),
  upsert: jest.fn(),
  delete: jest.fn(),
});

const makeStorage = (): jest.Mocked<FileStoragePort> => ({
  store: jest.fn(),
  delete: jest.fn(),
});

const makeEventEmitter = (): jest.Mocked<DomainEventEmitter> => ({
  emit: jest.fn(),
});

const makeAggregate = (capaUrl: string | null): Metadados =>
  new Metadados({
    projetoId: PROJETO_ID,
    titulo: 'T',
    autor: 'A',
    idioma: 'pt',
    capaUrl: capaUrl ?? undefined,
    empresaSlug: EMPRESA_SLUG,
    materialized: true,
  });

describe('RemoveCoverUseCase', () => {
  let useCase: RemoveCoverUseCase;
  let repo: jest.Mocked<MetadadosRepository>;
  let storage: jest.Mocked<FileStoragePort>;
  let eventEmitter: jest.Mocked<DomainEventEmitter>;

  beforeEach(() => {
    repo = makeRepo();
    storage = makeStorage();
    eventEmitter = makeEventEmitter();
    useCase = new RemoveCoverUseCase(
      repo as unknown as MetadadosRepository,
      storage as unknown as FileStoragePort,
      eventEmitter as unknown as DomainEventEmitter,
    );
  });

  // ---------------------------------------------------------------------------
  // Happy path — cover exists
  // ---------------------------------------------------------------------------

  it('deletes binary from storage and clears capaUrl in DB', async () => {
    const aggregate = makeAggregate('https://storage/capa.jpg');
    repo.findByProjetoId.mockResolvedValue(aggregate);
    storage.delete.mockResolvedValue(undefined);
    repo.upsert.mockResolvedValue(makeAggregate(null));

    await useCase.execute({ projetoId: PROJETO_ID, empresaSlug: EMPRESA_SLUG });

    expect(storage.delete).toHaveBeenCalledWith('https://storage/capa.jpg');
    expect(repo.upsert).toHaveBeenCalledTimes(1);
    const upsertArg = repo.upsert.mock.calls[0][0];
    expect(upsertArg.capaUrl).toBeNull();
  });

  it('emits MetadataUpdated after successfully removing an existing cover', async () => {
    const aggregate = makeAggregate('https://storage/capa.jpg');
    repo.findByProjetoId.mockResolvedValue(aggregate);
    storage.delete.mockResolvedValue(undefined);
    repo.upsert.mockResolvedValue(makeAggregate(null));

    await useCase.execute({ projetoId: PROJETO_ID, empresaSlug: EMPRESA_SLUG });

    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'MetadataUpdated',
      expect.objectContaining({ projetoId: PROJETO_ID, capaUrl: null }),
    );
  });

  // ---------------------------------------------------------------------------
  // Idempotency — no row (COMP-005 acceptance criterion)
  // ---------------------------------------------------------------------------

  it('is a no-op when no Metadados row exists (idempotent)', async () => {
    repo.findByProjetoId.mockResolvedValue(null);

    await useCase.execute({ projetoId: PROJETO_ID, empresaSlug: EMPRESA_SLUG });

    expect(storage.delete).not.toHaveBeenCalled();
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('does NOT emit MetadataUpdated when no Metadados row exists', async () => {
    repo.findByProjetoId.mockResolvedValue(null);

    await useCase.execute({ projetoId: PROJETO_ID, empresaSlug: EMPRESA_SLUG });

    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Idempotency — no cover (capaUrl=null)
  // ---------------------------------------------------------------------------

  it('does not call storage.delete when capaUrl is already null', async () => {
    repo.findByProjetoId.mockResolvedValue(makeAggregate(null));
    repo.upsert.mockResolvedValue(makeAggregate(null));

    await useCase.execute({ projetoId: PROJETO_ID, empresaSlug: EMPRESA_SLUG });

    expect(storage.delete).not.toHaveBeenCalled();
    expect(repo.upsert).toHaveBeenCalledTimes(1);
  });

  it('does NOT emit MetadataUpdated when capaUrl was already null', async () => {
    repo.findByProjetoId.mockResolvedValue(makeAggregate(null));
    repo.upsert.mockResolvedValue(makeAggregate(null));

    await useCase.execute({ projetoId: PROJETO_ID, empresaSlug: EMPRESA_SLUG });

    // No real mutation occurred (capaUrl was already null) — no event.
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Error propagation
  // ---------------------------------------------------------------------------

  it('propagates storage.delete errors', async () => {
    repo.findByProjetoId.mockResolvedValue(makeAggregate('https://storage/capa.jpg'));
    storage.delete.mockRejectedValue(new Error('storage error'));

    await expect(useCase.execute({ projetoId: PROJETO_ID, empresaSlug: EMPRESA_SLUG }))
      .rejects.toThrow('storage error');

    expect(repo.upsert).not.toHaveBeenCalled();
    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });
});
