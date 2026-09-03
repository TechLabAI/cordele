import { PublicacaoEntity } from '../../domain/pub/publicacao.entity';
import { EpubcheckStatus } from '../../domain/pub/epubcheck-status.enum';
import type { PublicacaoRepositoryPort } from '../../domain/pub/ports/publicacao-repository.port';
import type { FileStoragePort } from './ports/file-storage.port';
import { PublicationErasureService } from './publication-erasure.service';

/**
 * Unit tests for `PublicationErasureService` (PUB-015).
 *
 * `PublicationErasureService` implements `PublicationErasurePort.erase()` and
 * purges all publication data for a project as the first leaf of the LGPD
 * erasure cascade (PROJ-016).
 *
 * Behaviours verified:
 *   - `erase()` collects artefatoRefs BEFORE deleting DB rows (leaf-first order).
 *   - `erase()` calls `repository.deleteAllByProjeto(projetoId)` once.
 *   - `erase()` calls `fileStorage.delete(ref)` for each artefatoRef.
 *   - `erase()` does NOT call `fileStorage.delete` for publications with no artefatoRef.
 *   - `erase()` is idempotent: a second call for an already-erased project
 *     succeeds without error (empty listByProjeto → no delete calls).
 *   - `erase()` propagates unexpected errors from the repository.
 *   - `erase()` propagates unexpected storage errors (non-ENOENT).
 *
 * RULE-04: this spec is in modules/ and only imports from domain/ and other
 * modules/ — no infrastructure/ imports.
 */
describe('PublicationErasureService', () => {
  let repository: jest.Mocked<PublicacaoRepositoryPort>;
  let fileStorage: jest.Mocked<FileStoragePort>;
  let service: PublicationErasureService;

  /** Builds a minimal `gerando` entity without an artefatoRef. */
  const makeGerandoEntity = (id = 'pub-1', projetoId = 'proj-1'): PublicacaoEntity =>
    PublicacaoEntity.iniciar({
      id,
      projetoId,
      sequencia: 1,
      iniciadaEm: new Date('2026-01-01T00:00:00Z'),
    });

  /** Builds a `publicado` entity with an artefatoRef. */
  const makePublicadoEntity = (id: string, ref: string, projetoId = 'proj-1'): PublicacaoEntity =>
    makeGerandoEntity(id, projetoId)
      .iniciarValidacao()
      .concluirPublicado({
        artefatoRef: ref,
        epubcheckStatus: EpubcheckStatus.VALIDO,
        totalErros: 0,
        totalAvisos: 0,
        concluidaEm: new Date('2026-01-01T00:01:00Z'),
      });

  beforeEach(() => {
    repository = {
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

    fileStorage = {
      put: jest.fn(),
      get: jest.fn(),
      delete: jest.fn(),
      signUrl: jest.fn(),
    };

    repository.deleteAllByProjeto.mockResolvedValue(undefined);
    fileStorage.delete.mockResolvedValue(undefined);

    service = new PublicationErasureService(repository, fileStorage);
  });

  // -------------------------------------------------------------------------
  // Core erase behaviour
  // -------------------------------------------------------------------------

  describe('erase()', () => {
    it('calls repository.deleteAllByProjeto with the correct projetoId', async () => {
      repository.listByProjeto.mockResolvedValue([]);

      await service.erase('proj-abc', 'empresa-aetos');

      expect(repository.deleteAllByProjeto).toHaveBeenCalledTimes(1);
      expect(repository.deleteAllByProjeto).toHaveBeenCalledWith('proj-abc');
    });

    it('calls fileStorage.delete for each artefatoRef collected before delete', async () => {
      const ref1 = 'emp_aetos/publicacoes/pub-1/output.epub';
      const ref2 = 'emp_aetos/publicacoes/pub-2/output.epub';
      const pub1 = makePublicadoEntity('pub-1', ref1);
      const pub2 = makePublicadoEntity('pub-2', ref2);
      repository.listByProjeto.mockResolvedValue([pub1, pub2]);

      await service.erase('proj-1', 'empresa-aetos');

      expect(fileStorage.delete).toHaveBeenCalledTimes(2);
      expect(fileStorage.delete).toHaveBeenCalledWith(ref1);
      expect(fileStorage.delete).toHaveBeenCalledWith(ref2);
    });

    it('does NOT call fileStorage.delete for publications without an artefatoRef', async () => {
      // A gerando entity has no artefatoRef.
      const gerando = makeGerandoEntity('pub-no-ref', 'proj-1');
      const publicado = makePublicadoEntity('pub-with-ref', 'emp_aetos/publicacoes/pub-with-ref/output.epub', 'proj-1');
      repository.listByProjeto.mockResolvedValue([gerando, publicado]);

      await service.erase('proj-1', 'empresa-aetos');

      // Only the one with an artefatoRef should be deleted from storage.
      expect(fileStorage.delete).toHaveBeenCalledTimes(1);
      expect(fileStorage.delete).toHaveBeenCalledWith('emp_aetos/publicacoes/pub-with-ref/output.epub');
    });

    it('collects artefatoRefs BEFORE deleting DB rows (leaf-first order)', async () => {
      const ref = 'emp_aetos/publicacoes/pub-1/output.epub';
      const pub = makePublicadoEntity('pub-1', ref);
      repository.listByProjeto.mockResolvedValue([pub]);

      const callOrder: string[] = [];
      repository.listByProjeto.mockImplementation(async () => {
        callOrder.push('listByProjeto');
        return [pub];
      });
      repository.deleteAllByProjeto.mockImplementation(async () => {
        callOrder.push('deleteAllByProjeto');
      });
      fileStorage.delete.mockImplementation(async () => {
        callOrder.push('fileStorage.delete');
      });

      await service.erase('proj-1', 'empresa-aetos');

      // Correct sequence: list (collect refs) → deleteMany → delete storage files.
      expect(callOrder).toEqual(['listByProjeto', 'deleteAllByProjeto', 'fileStorage.delete']);
    });

    // -----------------------------------------------------------------------
    // Idempotence
    // -----------------------------------------------------------------------

    it('is idempotent: a second erase on an already-erased project succeeds', async () => {
      // First call: project has 2 publications.
      const pub = makePublicadoEntity('pub-1', 'emp_aetos/publicacoes/pub-1/output.epub');
      repository.listByProjeto
        .mockResolvedValueOnce([pub])     // first call
        .mockResolvedValueOnce([]);       // second call (already erased)

      await service.erase('proj-1', 'empresa-aetos');
      await expect(service.erase('proj-1', 'empresa-aetos')).resolves.toBeUndefined();

      expect(repository.deleteAllByProjeto).toHaveBeenCalledTimes(2);
    });

    it('does not call fileStorage.delete when project has no publications', async () => {
      repository.listByProjeto.mockResolvedValue([]);

      await service.erase('proj-empty', 'empresa-aetos');

      expect(fileStorage.delete).not.toHaveBeenCalled();
      expect(repository.deleteAllByProjeto).toHaveBeenCalledWith('proj-empty');
    });

    // -----------------------------------------------------------------------
    // Error propagation
    // -----------------------------------------------------------------------

    it('propagates repository errors (DB down)', async () => {
      repository.listByProjeto.mockRejectedValue(new Error('DB connection refused'));

      await expect(service.erase('proj-1', 'empresa-aetos')).rejects.toThrow(
        'DB connection refused',
      );
    });

    it('propagates unexpected fileStorage errors (non-ENOENT)', async () => {
      const pub = makePublicadoEntity('pub-1', 'emp_aetos/publicacoes/pub-1/output.epub');
      repository.listByProjeto.mockResolvedValue([pub]);
      fileStorage.delete.mockRejectedValue(new Error('Access denied'));

      await expect(service.erase('proj-1', 'empresa-aetos')).rejects.toThrow(
        'Access denied',
      );
    });
  });
});
