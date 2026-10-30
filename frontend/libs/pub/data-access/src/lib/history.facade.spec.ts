/**
 * history.facade.spec.ts — Unit tests for HistoryFacade (FE-PUB-007).
 *
 * Verifies:
 *   - load() calls listByProjeto and getStats, sets status to loaded.
 *   - isEmpty computed correctly when lista is empty after load.
 *   - download() delegates to ArtifactDownloadService; downloading signal clears on completion.
 *   - Stats null when getStats errors (tiles hidden, not a fatal error).
 *   - error state set on listByProjeto failure.
 */
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { HistoryFacade } from './history.facade';
import { PublicacaoApiService } from './publicacao-api.service';
import { ArtifactDownloadService } from './artifact-download.service';
import { PublicacaoHistoryItem, PublicationStats } from './models/pub.models';

const MOCK_HISTORY: PublicacaoHistoryItem[] = [
  {
    publicacaoId:    'pub-001',
    projetoId:       'proj-001',
    epubcheckStatus: 'valido',
    totalErros:      0,
    totalAvisos:     0,
    erros:           null,
    arquivoUrl:      '/exports/test.epub',
    criadoEm:        '2026-01-01T00:01:00Z',
  },
];

const MOCK_STATS: PublicationStats = {
  total:         1,
  publicadas:    1,
  comAvisos:     0,
  comErros:      0,
  emAndamento:   0,
  latestOutcome: 'valido',
};

describe('HistoryFacade', () => {
  let facade: HistoryFacade;
  let apiMock: Partial<PublicacaoApiService>;
  let downloaderMock: Partial<ArtifactDownloadService>;

  beforeEach(() => {
    apiMock = {
      listByProjeto: (_projetoId: string) => of(MOCK_HISTORY),
      getStats: (_projetoId: string) => of(MOCK_STATS),
      getProjetoHeader: (_projetoId: string) => of(null),
      getAutor: (_projetoId: string) => of(null),
    };
    downloaderMock = {
      download: (_projetoId: string, _publicacaoId: string) =>
        of({ success: true, arquivoUrl: '/exports/test.epub' }),
    };

    TestBed.configureTestingModule({
      providers: [
        HistoryFacade,
        { provide: PublicacaoApiService, useValue: apiMock },
        { provide: ArtifactDownloadService, useValue: downloaderMock },
      ],
    });

    facade = TestBed.inject(HistoryFacade);
  });

  describe('load', () => {
    it('should set status=loaded and populate lista on success', () => {
      facade.load('proj-001');

      expect(facade.status()).toBe('loaded');
      expect(facade.lista()).toEqual(MOCK_HISTORY);
      expect(facade.error()).toBeNull();
    });

    it('should load stats independently and populate stats signal', () => {
      facade.load('proj-001');
      expect(facade.stats()).toEqual(MOCK_STATS);
    });

    it('should set stats=null when getStats errors (tiles hidden, not fatal)', () => {
      apiMock.getStats = (_projetoId: string) =>
        throwError(() => new Error('stats error'));

      facade.load('proj-001');

      expect(facade.status()).toBe('loaded'); // list succeeded
      expect(facade.stats()).toBeNull();      // stats silently null
    });

    it('should set status=error when listByProjeto fails', () => {
      apiMock.listByProjeto = (_projetoId: string) =>
        throwError(() => new Error('network error'));

      facade.load('proj-001');

      expect(facade.status()).toBe('error');
      expect(facade.error()).toContain('network error');
    });
  });

  describe('isEmpty', () => {
    it('should be true when lista is empty after loaded', () => {
      apiMock.listByProjeto = (_projetoId: string) => of([]);
      apiMock.getStats = (_projetoId: string) => of(MOCK_STATS);

      facade.load('proj-001');

      expect(facade.isEmpty()).toBe(true);
    });

    it('should be false when lista has items', () => {
      facade.load('proj-001');
      expect(facade.isEmpty()).toBe(false);
    });
  });

  describe('download', () => {
    it('should delegate to ArtifactDownloadService and clear downloading signal on success', () => {
      let downloadCalled = false;
      downloaderMock.download = (_projetoId: string, _publicacaoId: string) => {
        downloadCalled = true;
        return of({ success: true, arquivoUrl: '/exports/test.epub' });
      };

      facade.download('proj-001', 'pub-001');

      expect(downloadCalled).toBe(true);
      expect(facade.downloading()).toBeNull();
    });

    it('should set downloadError on download failure', () => {
      downloaderMock.download = (_projetoId: string, _publicacaoId: string) =>
        throwError(() => ({ message: 'O link de download expirou.' }));

      facade.download('proj-001', 'pub-001');

      expect(facade.downloading()).toBeNull();
      expect(facade.downloadError()).toContain('expirou');
    });
  });
});
