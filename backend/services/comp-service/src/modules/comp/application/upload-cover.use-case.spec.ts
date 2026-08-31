import { UploadCoverUseCase } from './upload-cover.use-case';
import { Metadados } from '../../../domain/comp/metadados.aggregate';
import { DomainException } from '../../../domain/shared/domain-exception';
import type { MetadadosRepository } from '../ports/metadados-repository.port';
import type { FileStoragePort } from '../ports/file-storage.port';
import type { DomainEventEmitter } from '../ports/domain-event-emitter.port';

/**
 * Unit spec for UploadCoverUseCase (COMP-005).
 *
 * All ports are mocked with jest.fn() — no disk, no DB, no Nest.
 *
 * Covers:
 *   - Happy path (JPEG/PNG upload, key derivation, upsert, event, metric)
 *   - MIME validation: image/gif → 415; metric reason='415' incremented
 *   - Size validation: > COMP_COVER_MAX_BYTES → 413; metric reason='413' incremented
 *   - Neither FileStoragePort nor upsert called when validation fails
 *   - Event emission on success
 *   - Metric comp_cover_upload_total incremented on success
 *   - Materializes Metadados when no row exists
 *   - Storage error propagation
 */

const PROJETO_ID = '11111111-1111-4111-8111-111111111111';
const EMPRESA_SLUG = 'aetos';
const MOCK_BUFFER = Buffer.from('fake-image');
const MOCK_URL = 'https://storage/aetos/11111111-1111-4111-8111-111111111111/capa.jpg';

// Mock "buffer" whose length exceeds the default 10MB limit.
// We do NOT allocate 10 MB in the test — the use case only reads `.length` before
// any storage call, so a plain object cast as Buffer is sufficient here.
const OVERSIZED_BUFFER = { length: 10_485_761 } as unknown as Buffer;

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

const makeMetrics = () => ({ increment: jest.fn() });

describe('UploadCoverUseCase', () => {
  let useCase: UploadCoverUseCase;
  let repo: jest.Mocked<MetadadosRepository>;
  let storage: jest.Mocked<FileStoragePort>;
  let eventEmitter: jest.Mocked<DomainEventEmitter>;
  let metrics: ReturnType<typeof makeMetrics>;

  const persistedWith = (capaUrl: string): Metadados =>
    new Metadados({
      projetoId: PROJETO_ID,
      titulo: 'T',
      autor: 'A',
      idioma: 'pt',
      capaUrl,
      empresaSlug: EMPRESA_SLUG,
      materialized: true,
    });

  beforeEach(() => {
    repo = makeRepo();
    storage = makeStorage();
    eventEmitter = makeEventEmitter();
    metrics = makeMetrics();
    useCase = new UploadCoverUseCase(
      repo as unknown as MetadadosRepository,
      storage as unknown as FileStoragePort,
      eventEmitter as unknown as DomainEventEmitter,
      metrics,
    );
  });

  // ---------------------------------------------------------------------------
  // MIME validation (COMP-005 / SPEC-02 — 415)
  // ---------------------------------------------------------------------------

  it('rejects image/gif with DomainException status=415', async () => {
    await expect(useCase.execute({
      projetoId: PROJETO_ID,
      empresaSlug: EMPRESA_SLUG,
      buffer: MOCK_BUFFER,
      mimeType: 'image/gif',
    })).rejects.toMatchObject({ status: 415, code: 'UNSUPPORTED_MEDIA_TYPE' } as Partial<DomainException>);

    expect(storage.store).not.toHaveBeenCalled();
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('rejects application/octet-stream with DomainException status=415', async () => {
    await expect(useCase.execute({
      projetoId: PROJETO_ID,
      empresaSlug: EMPRESA_SLUG,
      buffer: MOCK_BUFFER,
      mimeType: 'application/octet-stream',
    })).rejects.toThrow(DomainException);

    expect(storage.store).not.toHaveBeenCalled();
  });

  it('increments comp_cover_rejection_total{reason=415} when MIME is unsupported', async () => {
    await expect(useCase.execute({
      projetoId: PROJETO_ID,
      empresaSlug: EMPRESA_SLUG,
      buffer: MOCK_BUFFER,
      mimeType: 'image/gif',
    })).rejects.toThrow(DomainException);

    expect(metrics.increment).toHaveBeenCalledWith('comp_cover_rejection_total', { reason: '415' });
  });

  // ---------------------------------------------------------------------------
  // Size validation (COMP-005 / SPEC-02 — 413)
  // ---------------------------------------------------------------------------

  it('rejects files larger than COMP_COVER_MAX_BYTES with DomainException status=413', async () => {
    await expect(useCase.execute({
      projetoId: PROJETO_ID,
      empresaSlug: EMPRESA_SLUG,
      buffer: OVERSIZED_BUFFER,
      mimeType: 'image/jpeg',
    })).rejects.toMatchObject({ status: 413, code: 'PAYLOAD_TOO_LARGE' } as Partial<DomainException>);

    expect(storage.store).not.toHaveBeenCalled();
    expect(repo.upsert).not.toHaveBeenCalled();
  });

  it('increments comp_cover_rejection_total{reason=413} when file is too large', async () => {
    await expect(useCase.execute({
      projetoId: PROJETO_ID,
      empresaSlug: EMPRESA_SLUG,
      buffer: OVERSIZED_BUFFER,
      mimeType: 'image/jpeg',
    })).rejects.toThrow(DomainException);

    expect(metrics.increment).toHaveBeenCalledWith('comp_cover_rejection_total', { reason: '413' });
  });

  // ---------------------------------------------------------------------------
  // Happy path
  // ---------------------------------------------------------------------------

  it('stores binary via FileStoragePort then upserts Metadados', async () => {
    repo.findByProjetoId.mockResolvedValue(null);
    storage.store.mockResolvedValue(MOCK_URL);
    repo.upsert.mockImplementation(async (e) => persistedWith(e.capaUrl!));

    const result = await useCase.execute({
      projetoId: PROJETO_ID,
      empresaSlug: EMPRESA_SLUG,
      buffer: MOCK_BUFFER,
      mimeType: 'image/jpeg',
    });

    expect(storage.store).toHaveBeenCalledTimes(1);
    const [key, buf] = storage.store.mock.calls[0];
    expect(key).toBe(`${EMPRESA_SLUG}/${PROJETO_ID}/capa.jpg`);
    expect(buf).toBe(MOCK_BUFFER);

    expect(repo.upsert).toHaveBeenCalledTimes(1);
    expect(result.capaUrl).toBe(MOCK_URL);
  });

  it('derives correct key for image/png', async () => {
    repo.findByProjetoId.mockResolvedValue(null);
    storage.store.mockResolvedValue('url-png');
    repo.upsert.mockImplementation(async (e) => persistedWith(e.capaUrl!));

    await useCase.execute({
      projetoId: PROJETO_ID,
      empresaSlug: EMPRESA_SLUG,
      buffer: MOCK_BUFFER,
      mimeType: 'image/png',
    });

    expect(storage.store.mock.calls[0][0]).toBe(`${EMPRESA_SLUG}/${PROJETO_ID}/capa.png`);
  });

  it('derives correct key for image/webp', async () => {
    repo.findByProjetoId.mockResolvedValue(null);
    storage.store.mockResolvedValue('url-webp');
    repo.upsert.mockImplementation(async (e) => persistedWith(e.capaUrl!));

    await useCase.execute({
      projetoId: PROJETO_ID,
      empresaSlug: EMPRESA_SLUG,
      buffer: MOCK_BUFFER,
      mimeType: 'image/webp',
    });

    expect(storage.store.mock.calls[0][0]).toBe(`${EMPRESA_SLUG}/${PROJETO_ID}/capa.webp`);
  });

  it('replaces cover when existing Metadados already has capaUrl', async () => {
    const existing = persistedWith('https://storage/old-capa.jpg');
    repo.findByProjetoId.mockResolvedValue(existing);
    storage.store.mockResolvedValue(MOCK_URL);
    repo.upsert.mockImplementation(async (e) => persistedWith(e.capaUrl!));

    const result = await useCase.execute({
      projetoId: PROJETO_ID,
      empresaSlug: EMPRESA_SLUG,
      buffer: MOCK_BUFFER,
      mimeType: 'image/jpeg',
    });

    expect(result.capaUrl).toBe(MOCK_URL);
  });

  // ---------------------------------------------------------------------------
  // Materializes Metadados if absent (COMP-005 acceptance criterion)
  // ---------------------------------------------------------------------------

  it('materializes Metadados when no row exists before upload', async () => {
    repo.findByProjetoId.mockResolvedValue(null);
    storage.store.mockResolvedValue(MOCK_URL);
    repo.upsert.mockImplementation(async (e) => persistedWith(e.capaUrl!));

    await useCase.execute({
      projetoId: PROJETO_ID,
      empresaSlug: EMPRESA_SLUG,
      buffer: MOCK_BUFFER,
      mimeType: 'image/jpeg',
    });

    expect(repo.upsert).toHaveBeenCalledTimes(1);
    const upsertArg = repo.upsert.mock.calls[0][0];
    expect(upsertArg.capaUrl).toBe(MOCK_URL);
  });

  // ---------------------------------------------------------------------------
  // Event emission (COMP-005 / COMP-004 post-persist event)
  // ---------------------------------------------------------------------------

  it('emits MetadataUpdated after successful upload', async () => {
    repo.findByProjetoId.mockResolvedValue(null);
    storage.store.mockResolvedValue(MOCK_URL);
    repo.upsert.mockImplementation(async (e) => persistedWith(e.capaUrl!));

    await useCase.execute({
      projetoId: PROJETO_ID,
      empresaSlug: EMPRESA_SLUG,
      buffer: MOCK_BUFFER,
      mimeType: 'image/jpeg',
    });

    expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
    expect(eventEmitter.emit).toHaveBeenCalledWith(
      'MetadataUpdated',
      expect.objectContaining({ projetoId: PROJETO_ID, empresaSlug: EMPRESA_SLUG }),
    );
  });

  it('does NOT emit MetadataUpdated when MIME validation fails', async () => {
    await expect(useCase.execute({
      projetoId: PROJETO_ID,
      empresaSlug: EMPRESA_SLUG,
      buffer: MOCK_BUFFER,
      mimeType: 'image/gif',
    })).rejects.toThrow(DomainException);

    expect(eventEmitter.emit).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Metrics on success (COMP-019)
  // ---------------------------------------------------------------------------

  it('increments comp_cover_upload_total on successful upload', async () => {
    repo.findByProjetoId.mockResolvedValue(null);
    storage.store.mockResolvedValue(MOCK_URL);
    repo.upsert.mockImplementation(async (e) => persistedWith(e.capaUrl!));

    await useCase.execute({
      projetoId: PROJETO_ID,
      empresaSlug: EMPRESA_SLUG,
      buffer: MOCK_BUFFER,
      mimeType: 'image/jpeg',
    });

    expect(metrics.increment).toHaveBeenCalledWith('comp_cover_upload_total');
  });

  // ---------------------------------------------------------------------------
  // Error propagation — store before upsert
  // ---------------------------------------------------------------------------

  it('does not call upsert when storage.store fails', async () => {
    repo.findByProjetoId.mockResolvedValue(null);
    storage.store.mockRejectedValue(new Error('storage error'));

    await expect(useCase.execute({
      projetoId: PROJETO_ID,
      empresaSlug: EMPRESA_SLUG,
      buffer: MOCK_BUFFER,
      mimeType: 'image/jpeg',
    })).rejects.toThrow('storage error');

    expect(repo.upsert).not.toHaveBeenCalled();
  });
});
