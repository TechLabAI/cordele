import { NotFoundException } from '@nestjs/common';

import { EpubcheckStatus } from '../../domain/pub/epubcheck-status.enum';
import { PublicacaoEntity } from '../../domain/pub/publicacao.entity';
import type { PublicacaoRepositoryPort } from '../../domain/pub/ports/publicacao-repository.port';
import type { FileStoragePort } from './ports/file-storage.port';
import { PublicationHistoryService } from './publication-history.service';

/**
 * Unit tests for `PublicationHistoryService` (PUB-014).
 *
 * `PublicationHistoryService` implements `PublicationHistoryPort` and provides
 * three operations: `latest` (batched summary), `history` (full list), and
 * `signedDownloadUrl` (mints a short-TTL URL).
 *
 * Behaviours verified:
 *   - `latest([])` returns an empty Map without querying the repository.
 *   - `latest([...])` calls findLatestByProjetoIds exactly once (no N+1).
 *   - `latest([...])` returns one Map entry per project that has a publication.
 *   - `history(projetoId)` returns an empty array when project has no publications.
 *   - `history(projetoId)` maps entities to PublicationRecord with arquivoUrl=null.
 *   - `history(projetoId)` preserves repository order (newest first).
 *   - `signedDownloadUrl` throws NotFoundException when publication does not exist.
 *   - `signedDownloadUrl` throws NotFoundException for gerando (no artifact).
 *   - `signedDownloadUrl` throws NotFoundException for com_erros (no artifact).
 *   - `signedDownloadUrl` returns signed URL for publicado (valido).
 *   - `signedDownloadUrl` returns signed URL for publicado (avisos).
 *
 * RULE-04: this spec is in modules/ and only imports from domain/ and other
 * modules/ — no infrastructure/ imports.
 */
describe('PublicationHistoryService', () => {
  let repository: jest.Mocked<PublicacaoRepositoryPort>;
  let fileStorage: jest.Mocked<FileStoragePort>;
  let service: PublicationHistoryService;

  /** Builds a minimal `gerando` entity. */
  const makeGerandoEntity = (overrides: {
    id?: string;
    projetoId?: string;
    sequencia?: number;
  } = {}): PublicacaoEntity =>
    PublicacaoEntity.iniciar({
      id: overrides.id ?? 'pub-1',
      projetoId: overrides.projetoId ?? 'proj-1',
      sequencia: overrides.sequencia ?? 1,
      iniciadaEm: new Date('2026-01-01T00:00:00Z'),
    });

  /** Builds a `publicado` entity (valido epubcheck) with an artefatoRef. */
  const makePublicadoEntity = (id = 'pub-1', projetoId = 'proj-1'): PublicacaoEntity =>
    makeGerandoEntity({ id, projetoId })
      .iniciarValidacao()
      .concluirPublicado({
        artefatoRef: `emp_aetos/publicacoes/${id}/output.epub`,
        epubcheckStatus: EpubcheckStatus.VALIDO,
        totalErros: 0,
        totalAvisos: 0,
        concluidaEm: new Date('2026-01-01T00:01:00Z'),
      });

  /** Builds a `com_erros` entity (no artefatoRef). */
  const makeComErrosEntity = (id = 'pub-err'): PublicacaoEntity =>
    makeGerandoEntity({ id })
      .iniciarValidacao()
      .concluirComErros({
        resumoErro: 'fatal NCX error',
        totalErros: 3,
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

    service = new PublicationHistoryService(repository, fileStorage);
  });

  // -------------------------------------------------------------------------
  // latest()
  // -------------------------------------------------------------------------

  describe('latest()', () => {
    it('returns an empty Map immediately when projetoIds is empty', async () => {
      const result = await service.latest([], 'empresa-aetos');

      expect(result).toEqual(new Map());
      expect(repository.findLatestByProjetoIds).not.toHaveBeenCalled();
    });

    it('calls findLatestByProjetoIds exactly once with the full list (no N+1)', async () => {
      repository.findLatestByProjetoIds.mockResolvedValue(new Map());

      await service.latest(['proj-1', 'proj-2'], 'empresa-aetos');

      expect(repository.findLatestByProjetoIds).toHaveBeenCalledTimes(1);
      expect(repository.findLatestByProjetoIds).toHaveBeenCalledWith(['proj-1', 'proj-2']);
    });

    it('returns a Map entry for each project that has a publication', async () => {
      const entity = makeGerandoEntity({ id: 'pub-1', projetoId: 'proj-1' });
      repository.findLatestByProjetoIds.mockResolvedValue(new Map([['proj-1', entity]]));

      const result = await service.latest(['proj-1', 'proj-no-pub'], 'empresa-aetos');

      expect(result.size).toBe(1);
      expect(result.get('proj-1')).toEqual({
        publicacaoId: 'pub-1',
        epubcheckStatus: entity.epubcheckStatus,
      });
      // Projects with no publications must be absent from the Map.
      expect(result.has('proj-no-pub')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // history()
  // -------------------------------------------------------------------------

  describe('history()', () => {
    it('returns an empty array when the project has no publications', async () => {
      repository.listByProjeto.mockResolvedValue([]);

      const result = await service.history('proj-1', 'empresa-aetos');

      expect(result).toEqual([]);
      expect(repository.listByProjeto).toHaveBeenCalledWith('proj-1');
    });

    it('maps each entity to a PublicationRecord with arquivoUrl=null', async () => {
      const entity = makeGerandoEntity({ id: 'pub-1', projetoId: 'proj-1' });
      repository.listByProjeto.mockResolvedValue([entity]);

      const result = await service.history('proj-1', 'empresa-aetos');

      expect(result).toHaveLength(1);
      expect(result[0].publicacaoId).toBe('pub-1');
      expect(result[0].projetoId).toBe('proj-1');
      // arquivoUrl is always null from history() — callers use signedDownloadUrl on demand.
      expect(result[0].arquivoUrl).toBeNull();
      expect(result[0].criadoEm).toBe(entity.iniciadaEm.toISOString());
    });

    it('preserves the repository order (newest first)', async () => {
      const older = makeGerandoEntity({ id: 'pub-1', projetoId: 'proj-1', sequencia: 1 });
      const newer = makeGerandoEntity({ id: 'pub-2', projetoId: 'proj-1', sequencia: 2 });
      repository.listByProjeto.mockResolvedValue([newer, older]);

      const result = await service.history('proj-1', 'empresa-aetos');

      expect(result[0].publicacaoId).toBe('pub-2');
      expect(result[1].publicacaoId).toBe('pub-1');
    });
  });

  // -------------------------------------------------------------------------
  // signedDownloadUrl()
  // -------------------------------------------------------------------------

  describe('signedDownloadUrl()', () => {
    it('throws NotFoundException when the publication does not exist', async () => {
      repository.findByPublicacaoId.mockResolvedValue(null);

      await expect(
        service.signedDownloadUrl('pub-missing', 'empresa-aetos'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when the publication is in gerando (no artifact)', async () => {
      // A gerando entity has no artefatoRef.
      const entity = makeGerandoEntity();
      repository.findByPublicacaoId.mockResolvedValue(entity);

      await expect(
        service.signedDownloadUrl(entity.id, 'empresa-aetos'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException when epubcheckStatus is erros_criticos', async () => {
      const entity = makeComErrosEntity();
      repository.findByPublicacaoId.mockResolvedValue(entity);

      await expect(
        service.signedDownloadUrl(entity.id, 'empresa-aetos'),
      ).rejects.toThrow(NotFoundException);
    });

    it('returns a signed URL for a publicado entity with valido epubcheckStatus', async () => {
      const entity = makePublicadoEntity('pub-1', 'proj-1');
      repository.findByPublicacaoId.mockResolvedValue(entity);

      const expiresAt = '2026-01-01T00:05:00Z';
      fileStorage.signUrl.mockResolvedValue({
        url: 'https://storage.example.com/signed-url',
        expiresAt,
      });

      const result = await service.signedDownloadUrl(entity.id, 'empresa-aetos');

      expect(result.arquivoUrl).toBe('https://storage.example.com/signed-url');
      expect(result.expiresAt).toBe(expiresAt);
      expect(fileStorage.signUrl).toHaveBeenCalledWith(
        'emp_aetos/publicacoes/pub-1/output.epub',
        300,
      );
    });

    it('returns a signed URL for a publicado entity with avisos epubcheckStatus', async () => {
      const entity = makeGerandoEntity({ id: 'pub-av' })
        .iniciarValidacao()
        .concluirPublicado({
          artefatoRef: 'emp_aetos/publicacoes/pub-av/output.epub',
          epubcheckStatus: EpubcheckStatus.AVISOS,
          totalErros: 0,
          totalAvisos: 2,
          concluidaEm: new Date(),
        });
      repository.findByPublicacaoId.mockResolvedValue(entity);

      fileStorage.signUrl.mockResolvedValue({
        url: 'https://storage.example.com/signed-url-avisos',
        expiresAt: '2026-01-01T00:05:00Z',
      });

      const result = await service.signedDownloadUrl(entity.id, 'empresa-aetos');

      expect(result.arquivoUrl).toBe('https://storage.example.com/signed-url-avisos');
    });
  });
});
