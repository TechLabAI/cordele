/**
 * CompositionErasureUseCase — unit tests (COMP-017).
 *
 * Tests the application-layer purge logic using jest.fn() mocks for both
 * MetadadosRepository and FileStoragePort. No DB or storage I/O involved.
 *
 * Contracts verified:
 *   - purge existing project: metadados deleted + FileStoragePort.delete called
 *   - purge already-absent project: no-op, no error (idempotent)
 *   - FileStoragePort.delete on missing file: purge still completes
 */

import { CompositionErasureUseCase } from './composition-erasure.use-case';
import type { MetadadosRepository } from '../ports/metadados-repository.port';
import type { FileStoragePort } from '../ports/file-storage.port';
import { Metadados } from '../../../domain/comp/metadados.aggregate';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PROJETO_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const CAPA_URL = 'http://storage/emp_test/proj/capa.jpg';

function buildMetadados(capaUrl: string | null = null): Metadados {
  return new Metadados({
    id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    projetoId: PROJETO_ID,
    titulo: 'Livro Teste',
    autor: 'Autor Teste',
    idioma: 'pt',
    capaUrl: capaUrl ?? undefined,
    empresaSlug: 'aetos',
    materialized: true,
  });
}

function buildMocks(): {
  metadadosRepo: jest.Mocked<MetadadosRepository>;
  fileStorage: jest.Mocked<FileStoragePort>;
} {
  return {
    metadadosRepo: {
      findByProjetoId: jest.fn(),
      findManyByProjetoIds: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    },
    fileStorage: {
      store: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    },
  };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('CompositionErasureUseCase', () => {
  // -------------------------------------------------------------------------
  // Purge existing project
  // -------------------------------------------------------------------------

  it('purge existing project: deletes metadados and calls FileStoragePort.delete for capaUrl', async () => {
    const { metadadosRepo, fileStorage } = buildMocks();
    metadadosRepo.findByProjetoId.mockResolvedValue(buildMetadados(CAPA_URL));

    const useCase = new CompositionErasureUseCase(
      metadadosRepo as unknown as MetadadosRepository,
      fileStorage as unknown as FileStoragePort,
    );

    await useCase.purge(PROJETO_ID);

    expect(metadadosRepo.findByProjetoId).toHaveBeenCalledWith(PROJETO_ID);
    expect(fileStorage.delete).toHaveBeenCalledWith(CAPA_URL);
    expect(metadadosRepo.delete).toHaveBeenCalledWith(PROJETO_ID);
  });

  it('purge existing project without cover: does not call FileStoragePort.delete', async () => {
    const { metadadosRepo, fileStorage } = buildMocks();
    metadadosRepo.findByProjetoId.mockResolvedValue(buildMetadados(null));

    const useCase = new CompositionErasureUseCase(
      metadadosRepo as unknown as MetadadosRepository,
      fileStorage as unknown as FileStoragePort,
    );

    await useCase.purge(PROJETO_ID);

    expect(fileStorage.delete).not.toHaveBeenCalled();
    expect(metadadosRepo.delete).toHaveBeenCalledWith(PROJETO_ID);
  });

  // -------------------------------------------------------------------------
  // Purge already-absent project (idempotent no-op)
  // -------------------------------------------------------------------------

  it('purge already-absent project: no-op, does not throw', async () => {
    const { metadadosRepo, fileStorage } = buildMocks();
    // No metadados row in DB — findByProjetoId returns null
    metadadosRepo.findByProjetoId.mockResolvedValue(null);

    const useCase = new CompositionErasureUseCase(
      metadadosRepo as unknown as MetadadosRepository,
      fileStorage as unknown as FileStoragePort,
    );

    await expect(useCase.purge(PROJETO_ID)).resolves.not.toThrow();

    expect(fileStorage.delete).not.toHaveBeenCalled();
    // metadadosRepo.delete still called (deleteMany is idempotent)
    expect(metadadosRepo.delete).toHaveBeenCalledWith(PROJETO_ID);
  });

  it('purge called twice: second call completes without error', async () => {
    const { metadadosRepo, fileStorage } = buildMocks();
    metadadosRepo.findByProjetoId
      .mockResolvedValueOnce(buildMetadados(CAPA_URL))
      .mockResolvedValueOnce(null); // second call — row already deleted

    const useCase = new CompositionErasureUseCase(
      metadadosRepo as unknown as MetadadosRepository,
      fileStorage as unknown as FileStoragePort,
    );

    await useCase.purge(PROJETO_ID);
    await expect(useCase.purge(PROJETO_ID)).resolves.not.toThrow();
  });

  // -------------------------------------------------------------------------
  // FileStoragePort.delete error on missing file: purge still completes
  // -------------------------------------------------------------------------

  it('FileStoragePort.delete throws for missing file: purge still completes (best-effort)', async () => {
    const { metadadosRepo, fileStorage } = buildMocks();
    metadadosRepo.findByProjetoId.mockResolvedValue(buildMetadados(CAPA_URL));
    fileStorage.delete.mockRejectedValue(new Error('ENOENT: file not found'));

    const useCase = new CompositionErasureUseCase(
      metadadosRepo as unknown as MetadadosRepository,
      fileStorage as unknown as FileStoragePort,
    );

    // Storage error must NOT abort the purge
    await expect(useCase.purge(PROJETO_ID)).resolves.not.toThrow();

    // metadadosRepo.delete is still called despite storage failure
    expect(metadadosRepo.delete).toHaveBeenCalledWith(PROJETO_ID);
  });

  it('FileStoragePort.delete throws: metadados row is still deleted', async () => {
    const { metadadosRepo, fileStorage } = buildMocks();
    metadadosRepo.findByProjetoId.mockResolvedValue(buildMetadados(CAPA_URL));
    fileStorage.delete.mockRejectedValue(new Error('StorageUnavailable'));

    const useCase = new CompositionErasureUseCase(
      metadadosRepo as unknown as MetadadosRepository,
      fileStorage as unknown as FileStoragePort,
    );

    await useCase.purge(PROJETO_ID);

    expect(metadadosRepo.delete).toHaveBeenCalledTimes(1);
    expect(metadadosRepo.delete).toHaveBeenCalledWith(PROJETO_ID);
  });
});
