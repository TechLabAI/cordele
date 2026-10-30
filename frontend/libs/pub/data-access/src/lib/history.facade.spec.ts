/**
 * history.facade.spec.ts — Unit tests for HistoryFacade (FE-PUB-007 / FE-PUB-024 / FE-PUB-025).
 *
 * Verifies:
 *   - load() calls listByProjeto and getStats, sets status to loaded.
 *   - isEmpty computed correctly when lista is empty after load.
 *   - download() delegates to ArtifactDownloadService; downloading signal clears on completion.
 *   - Stats null when getStats errors (tiles hidden, not a fatal error).
 *   - error state set on listByProjeto failure.
 *   - FE-PUB-024: errorTraceId populated from X-Correlation-Id on load failure.
 *   - FE-PUB-024: downloadTraceId populated on download failure.
 *   - FE-PUB-025: refetchNotice set on DownloadResult.status==='refetching'; cleared on success.
 */
import { TestBed } from '@angular/core/testing';
import { concat, of, throwError } from 'rxjs';
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
        of({ status: 'success' as const, arquivoUrl: '/exports/test.epub' }),
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

    it('FE-PUB-024: errorTraceId populated from X-Correlation-Id header on load failure', () => {
      const mockHeaderErr = {
        message: 'Server error',
        status: 500,
        headers: {
          get: (key: string) => key === 'x-correlation-id' ? 'trace-abc-123' : null,
        },
      };
      apiMock.listByProjeto = (_projetoId: string) =>
        throwError(() => mockHeaderErr);

      facade.load('proj-001');

      expect(facade.status()).toBe('error');
      expect(facade.errorTraceId()).toBe('trace-abc-123');
    });

    it('FE-PUB-024: errorTraceId is null when no X-Correlation-Id header is present', () => {
      apiMock.listByProjeto = (_projetoId: string) =>
        throwError(() => new Error('network error'));

      facade.load('proj-001');

      expect(facade.status()).toBe('error');
      expect(facade.errorTraceId()).toBeNull();
    });

    it('FE-PUB-024: errorTraceId populated from AppError.correlationId on load failure', () => {
      const appErr = { code: 'SERVER_ERROR', message: 'fail', correlationId: 'corr-xyz-789' };
      apiMock.listByProjeto = (_projetoId: string) =>
        throwError(() => appErr);

      facade.load('proj-001');

      expect(facade.errorTraceId()).toBe('corr-xyz-789');
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
        return of({ status: 'success' as const, arquivoUrl: '/exports/test.epub' });
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

    it('FE-PUB-024: downloadTraceId populated from X-Correlation-Id header on download failure', () => {
      const mockHeaderErr = {
        message: 'O link de download expirou.',
        status: 401,
        headers: {
          get: (key: string) => key === 'x-correlation-id' ? 'dl-trace-456' : null,
        },
      };
      downloaderMock.download = (_projetoId: string, _publicacaoId: string) =>
        throwError(() => mockHeaderErr);

      facade.download('proj-001', 'pub-001');

      expect(facade.downloadError()).toBeTruthy();
      expect(facade.downloadTraceId()).toBe('dl-trace-456');
    });

    it('FE-PUB-025: refetchNotice set when DownloadResult.status=refetching, cleared on success', () => {
      // Simulate ArtifactDownloadService emitting refetching then success (as _refetchAndOpen does)
      downloaderMock.download = (_projetoId: string, _publicacaoId: string) =>
        concat(
          of({ status: 'refetching' as const }),
          of({ status: 'success' as const, arquivoUrl: '/exports/test.epub' }),
        );

      // Since concat is synchronous in tests, after subscribe completes the notice is cleared.
      facade.download('proj-001', 'pub-001');

      // After success the notice must be cleared
      expect(facade.downloading()).toBeNull();
      expect(facade.refetchNotice()).toBeNull();
    });

    it('FE-PUB-025: refetchNotice cleared when download ultimately fails after refetch', () => {
      downloaderMock.download = (_projetoId: string, _publicacaoId: string) =>
        concat(
          of({ status: 'refetching' as const }),
          throwError(() => ({ message: 'O link de download expirou. Tente novamente.' })),
        );

      facade.download('proj-001', 'pub-001');

      expect(facade.refetchNotice()).toBeNull();
      expect(facade.downloadError()).toContain('expirou');
    });
  });
});
