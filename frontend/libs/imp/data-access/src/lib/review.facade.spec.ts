/**
 * review.facade.spec.ts — unit tests for ReviewFacade (FE-IMP-011).
 *
 * Uses HttpClientTestingModule + HttpTestingController to exercise the real
 * adapter chain. Does NOT use mock adapters in production-path tests (plan §3 P2).
 *
 * Covers (plan §3 P2 — criterios de aceite):
 *   - loadStructure hydrates `estrutura` signal from GET /manuscritos/:id
 *   - ignorarSegmento rolls back on HTTP 500
 *   - confirmarEstrutura navigates to /comp on success
 *   - phase signal reflects state transitions correctly
 */
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ReviewFacade } from './review.facade';
import { ManuscritoHttpAdapter } from './adapters/manuscrito-http.adapter';
import { SegmentoCuradoriaHttpAdapter } from './adapters/segmento-curadoria-http.adapter';
import { MANUSCRITO_PORT } from './ports/manuscrito.port';
import { SEGMENTO_CURADORIA_PORT } from './ports/segmento-curadoria.port';
import { ManuscritoDetail, IgnoredSegmentsResponse, SegmentoCuradoriaDto } from './models/imp.models';
import { ImpShellIntegrationService } from '@cordele/imp/integration';

const MOCK_MANUSCRITO: ManuscritoDetail = {
  id: 'ms-review-001',
  projetoId: 'proj-001',
  nomeArquivo: 'livro.docx',
  formato: 'docx',
  status: 'imported',
  totalCapitulos: 2,
  totalImagens: 0,
  trechosNaoParseados: 2,
  tamanhoBytes: 2048,
  estrutura: {
    schemaVersion: '1.0',
    formato: 'docx',
    chapters: [
      {
        id: 'ch-1', order: 0, title: 'Capítulo 1',
        blocks: [
          { type: 'unparsed', id: 'seg-1', order: 0, rawContent: '<w:tbl/>', reason: 'complex_table',
            sourceLocation: { kind: 'docx', paragraphIndex: 5, styleName: 'TableGrid' } },
          { type: 'unparsed', id: 'seg-2', order: 1, rawContent: '<w:txbx/>', reason: 'embedded_object',
            sourceLocation: { kind: 'docx', paragraphIndex: 12, styleName: 'TextBox' } },
        ],
        sections: [],
      },
    ],
  },
  criadoEm: '2026-08-31T10:00:00Z',
};

const MOCK_IGNORED: IgnoredSegmentsResponse = {
  manuscritoId: 'ms-review-001',
  ignoredSegmentoIds: [],
};

describe('ReviewFacade', () => {
  let facade: ReviewFacade;
  let httpMock: HttpTestingController;
  let router: Router;

  beforeEach(() => {
    // FE-IMP-023: include emitLifecycleEvent in the mock (P6 addition)
    const mockIntegrationSvc = {
      empresaChanged: signal(0),
      emitLifecycleEvent: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        provideRouter([]),
        ReviewFacade,
        ManuscritoHttpAdapter,
        SegmentoCuradoriaHttpAdapter,
        { provide: MANUSCRITO_PORT,          useClass: ManuscritoHttpAdapter },
        { provide: SEGMENTO_CURADORIA_PORT,  useClass: SegmentoCuradoriaHttpAdapter },
        { provide: ImpShellIntegrationService, useValue: mockIntegrationSvc },
      ],
    });

    facade   = TestBed.inject(ReviewFacade);
    httpMock = TestBed.inject(HttpTestingController);
    router   = TestBed.inject(Router);
  });

  afterEach(() => {
    // ignoreCancelled: true — forkJoin cancels the parallel getIgnored request when the
    // first observable errors; HttpTestingController marks it as cancelled but still
    // counts it in verify() by default. ignoreCancelled avoids false-positive failures.
    httpMock.verify({ ignoreCancelled: true });
  });

  // ── Initial state ──────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('should start in idle phase', () => {
      expect(facade.phase()).toBe('idle');
    });

    it('should have null estrutura initially', () => {
      expect(facade.estrutura()).toBeNull();
    });

    it('should have null errorMessage initially', () => {
      expect(facade.errorMessage()).toBeNull();
    });

    it('should have empty ignoredIds initially', () => {
      expect(facade.ignoredIds().size).toBe(0);
    });
  });

  // ── hydrateFromResponse ────────────────────────────────────────────────────

  describe('hydrateFromResponse()', () => {
    it('should hydrate manuscrito and estrutura signals', () => {
      facade.hydrateFromResponse(MOCK_MANUSCRITO);

      expect(facade.manuscrito()).toEqual(MOCK_MANUSCRITO);
      expect(facade.estrutura()).toEqual(MOCK_MANUSCRITO.estrutura);
    });

    it('should set phase to idle and clear errors', () => {
      facade.hydrateFromResponse(MOCK_MANUSCRITO);
      expect(facade.phase()).toBe('idle');
      expect(facade.errorMessage()).toBeNull();
    });
  });

  // ── loadStructure ──────────────────────────────────────────────────────────

  describe('loadStructure()', () => {
    it('should set phase to loading while requests are in flight', () => {
      facade.loadStructure('ms-review-001');

      expect(facade.phase()).toBe('loading');

      // Flush to satisfy afterEach verify()
      httpMock.expectOne('/api/v1/imp/manuscripts/ms-review-001').flush(MOCK_MANUSCRITO);
      httpMock.expectOne('/api/v1/imp/manuscripts/ms-review-001/segmentos/ignored').flush(MOCK_IGNORED);
    });

    it('should hydrate estrutura signal on successful load', () => {
      facade.loadStructure('ms-review-001');

      httpMock.expectOne('/api/v1/imp/manuscripts/ms-review-001').flush(MOCK_MANUSCRITO);
      httpMock.expectOne('/api/v1/imp/manuscripts/ms-review-001/segmentos/ignored').flush(MOCK_IGNORED);

      expect(facade.phase()).toBe('idle');
      expect(facade.estrutura()).toEqual(MOCK_MANUSCRITO.estrutura);
    });

    it('should populate ignoredIds from getIgnored response', () => {
      facade.loadStructure('ms-review-001');

      httpMock.expectOne('/api/v1/imp/manuscripts/ms-review-001').flush(MOCK_MANUSCRITO);
      httpMock.expectOne('/api/v1/imp/manuscripts/ms-review-001/segmentos/ignored').flush({
        ...MOCK_IGNORED,
        ignoredSegmentoIds: ['seg-1'],
      });

      expect(facade.ignoredIds().has('seg-1')).toBe(true);
    });

    it('should set phase to error and expose errorMessage on HTTP failure', () => {
      facade.loadStructure('ms-review-001');

      httpMock.expectOne('/api/v1/imp/manuscripts/ms-review-001').flush(
        { detail: 'Manuscrito não encontrado.' },
        { status: 404, statusText: 'Not Found' },
      );
      // forkJoin cancels the second request on error — no need to flush getIgnored

      expect(facade.phase()).toBe('error');
      expect(facade.errorMessage()).toBeTruthy();
    });
  });

  // ── ignorarSegmento ────────────────────────────────────────────────────────

  describe('ignorarSegmento()', () => {
    beforeEach(() => {
      facade.hydrateFromResponse(MOCK_MANUSCRITO);
    });

    it('should optimistically add segmentoId to ignoredIds', () => {
      facade.ignorarSegmento('seg-1');

      expect(facade.ignoredIds().has('seg-1')).toBe(true);

      // Flush to satisfy verify()
      httpMock.expectOne('/api/v1/imp/manuscripts/ms-review-001/segmentos/seg-1/ignore')
        .flush({} as SegmentoCuradoriaDto);
    });

    it('should rollback optimistic state on HTTP 500', () => {
      facade.ignorarSegmento('seg-1');
      expect(facade.ignoredIds().has('seg-1')).toBe(true); // optimistic

      httpMock.expectOne('/api/v1/imp/manuscripts/ms-review-001/segmentos/seg-1/ignore')
        .flush({ detail: 'Internal error' }, { status: 500, statusText: 'Internal Server Error' });

      // After rollback, seg-1 should no longer be in ignoredIds
      expect(facade.ignoredIds().has('seg-1')).toBe(false);
    });

    it('should not mutate existing Set on optimistic update (immutable spread)', () => {
      const originalSet = facade.ignoredIds();
      facade.ignorarSegmento('seg-2');

      expect(facade.ignoredIds()).not.toBe(originalSet); // new reference
      httpMock.expectOne('/api/v1/imp/manuscripts/ms-review-001/segmentos/seg-2/ignore')
        .flush({} as SegmentoCuradoriaDto);
    });
  });

  // ── restaurarSegmento ─────────────────────────────────────────────────────

  describe('restaurarSegmento()', () => {
    beforeEach(() => {
      facade.hydrateFromResponse(MOCK_MANUSCRITO);
      // Pre-seed ignored set
      facade.ignorarSegmento('seg-1');
      httpMock.expectOne('/api/v1/imp/manuscripts/ms-review-001/segmentos/seg-1/ignore')
        .flush({} as SegmentoCuradoriaDto);
    });

    it('should optimistically remove segmentoId from ignoredIds', () => {
      facade.restaurarSegmento('seg-1');
      expect(facade.ignoredIds().has('seg-1')).toBe(false);

      httpMock.expectOne('/api/v1/imp/manuscripts/ms-review-001/segmentos/seg-1/ignore').flush(null);
    });

    it('should rollback (re-add) on DELETE failure', () => {
      facade.restaurarSegmento('seg-1');
      expect(facade.ignoredIds().has('seg-1')).toBe(false);

      httpMock.expectOne('/api/v1/imp/manuscripts/ms-review-001/segmentos/seg-1/ignore')
        .flush(null, { status: 404, statusText: 'Not Found' });

      expect(facade.ignoredIds().has('seg-1')).toBe(true); // rolled back
    });
  });

  // ── confirmarEstrutura ────────────────────────────────────────────────────

  describe('confirmarEstrutura()', () => {
    // Stub navigate in all tests: the router has no /comp route registered
    // (provideRouter([])), so without a stub Angular emits code 4002 on success.
    let navigateStub: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      facade.hydrateFromResponse(MOCK_MANUSCRITO);
      navigateStub = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    });

    afterEach(() => {
      navigateStub.mockRestore();
    });

    it('should set phase to confirming while request is in flight', () => {
      facade.confirmarEstrutura();

      expect(facade.phase()).toBe('confirming');

      httpMock.expectOne('/api/v1/imp/manuscripts/ms-review-001/confirm-estrutura').flush(null);
    });

    it('should navigate to /comp on success', () => {
      const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);
      facade.confirmarEstrutura();

      httpMock.expectOne('/api/v1/imp/manuscripts/ms-review-001/confirm-estrutura')
        .flush(null, { status: 200, statusText: 'OK' });

      expect(facade.phase()).toBe('idle');
      expect(navigateSpy).toHaveBeenCalledWith(['/comp']);
    });

    it('should set phase to error and expose errorMessage on HTTP failure', () => {
      facade.confirmarEstrutura();

      httpMock.expectOne('/api/v1/imp/manuscripts/ms-review-001/confirm-estrutura')
        .flush({ detail: 'Confirm falhou.' }, { status: 500, statusText: 'Internal Server Error' });

      expect(facade.phase()).toBe('error');
      expect(facade.errorMessage()).toBeTruthy();
    });

    it('should NOT navigate on confirm error', () => {
      const navigateSpy = vi.spyOn(router, 'navigate');
      facade.confirmarEstrutura();

      httpMock.expectOne('/api/v1/imp/manuscripts/ms-review-001/confirm-estrutura')
        .flush(null, { status: 500, statusText: 'Internal Server Error' });

      expect(navigateSpy).not.toHaveBeenCalled();
    });
  });
});
