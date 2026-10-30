/**
 * projeto-api.service.spec.ts — unit tests for ProjetoApiService (FE-PROJ-007, P2).
 *
 * Strategy: mock AccessHttpClient methods via TestBed so no real HTTP occurs.
 * Verifies: correct URLs, ProblemDetail→AppError mapping on error, method delegation.
 *
 * Contract change (api-contract §4.2, 2026-09):
 *   listProjetos() now returns ProjetoListResult { page: ProjetoListPage, degraded: boolean }
 *   instead of ProjetoCard[]. Tests updated to assert on the envelope shape and X-Degraded.
 */
import { HttpErrorResponse, HttpHeaders, HttpResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjetoApiService } from './projeto-api.service';
import { ACCESS_EMPRESA_ID, moduleBase } from '@cordele/shared/access-http-base';
import type { ProjetoListPage, ProjetoListResult } from '../models/proj.models';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeErrorResponse(status: number, body: object): HttpErrorResponse {
  return new HttpErrorResponse({ error: body, status, url: '/api/v1/proj/projetos/test' });
}

/** Build a minimal ProjetoListPage for test fixtures. */
function makePage(count: number, nextCursor: string | null = null): ProjetoListPage {
  const items = Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    nome: `Projeto ${i + 1}`,
    autor: null,
    status: 'rascunho' as const,
    totalCapitulos: 0,
    totalImagens: 0,
    ultimoEpubcheckStatus: null,
    ultimaAtividadeEm: '2024-01-01T00:00:00Z',
    criadoEm: '2024-01-01T00:00:00Z',
  }));
  return { items, nextCursor };
}

/** Wrap a ProjetoListPage in an HttpResponse (simulating getResponse() output). */
function makeHttpResponse(page: ProjetoListPage, degraded = false): HttpResponse<ProjetoListPage> {
  const hdrs = degraded ? new HttpHeaders({ 'X-Degraded': 'true' }) : new HttpHeaders();
  return new HttpResponse({ body: page, status: 200, headers: hdrs });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProjetoApiService', () => {
  let service: ProjetoApiService;
  let getResponseSpy: ReturnType<typeof vi.fn>;
  let postSpy: ReturnType<typeof vi.fn>;
  let deleteSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getResponseSpy = vi.fn();
    postSpy        = vi.fn();
    deleteSpy      = vi.fn();

    TestBed.configureTestingModule({
      providers: [ProjetoApiService],
    });

    service = TestBed.inject(ProjetoApiService);

    // Patch AccessHttpClient methods directly on the instance
    (service as unknown as { getResponse: typeof getResponseSpy }).getResponse = getResponseSpy;
    (service as unknown as { post: typeof postSpy }).post                      = postSpy;
    (service as unknown as { delete: typeof deleteSpy }).delete                 = deleteSpy;
  });

  // ── listProjetos — envelope shape ──────────────────────────────────────────

  describe('listProjetos()', () => {
    it('calls getResponse(/api/v1/proj/projetos) and returns ProjetoListResult with page', () => {
      const page = makePage(2, null);
      getResponseSpy.mockReturnValue(of(makeHttpResponse(page)));

      let result: ProjetoListResult | undefined;
      service.listProjetos().subscribe(r => (result = r));

      expect(getResponseSpy).toHaveBeenCalledWith('/api/v1/proj/projetos');
      expect(result?.page.items).toHaveLength(2);
      expect(result?.page.nextCursor).toBeNull();
      expect(result?.degraded).toBe(false);
    });

    it('returns degraded=true when X-Degraded header is present', () => {
      const page = makePage(1, null);
      getResponseSpy.mockReturnValue(of(makeHttpResponse(page, true)));

      let result: ProjetoListResult | undefined;
      service.listProjetos().subscribe(r => (result = r));

      expect(result?.degraded).toBe(true);
    });

    it('passes limit and cursor as query params', () => {
      const page = makePage(5, 'cursor-abc');
      getResponseSpy.mockReturnValue(of(makeHttpResponse(page)));

      service.listProjetos({ limit: 5, cursor: 'cursor-abc' }).subscribe();

      expect(getResponseSpy).toHaveBeenCalledWith(
        '/api/v1/proj/projetos?limit=5&cursor=cursor-abc',
      );
    });

    it('passes status filter as query param', () => {
      getResponseSpy.mockReturnValue(of(makeHttpResponse(makePage(0))));
      service.listProjetos({ status: 'rascunho' }).subscribe();
      expect(getResponseSpy).toHaveBeenCalledWith('/api/v1/proj/projetos?status=rascunho');
    });

    it('maps ProblemDetail error to AppError on failure', () => {
      const body = { type: 'urn:problem:not-found', title: 'Not found', status: 404, detail: 'Nenhum projeto' };
      getResponseSpy.mockReturnValue(throwError(() => makeErrorResponse(404, body)));

      let appError: { code: string; httpStatus?: number } | undefined;
      service.listProjetos().subscribe({ error: e => (appError = e) });

      expect(appError?.code).toBe('urn:problem:not-found');
      expect(appError?.httpStatus).toBe(404);
    });
  });

  // ── getProjeto ──────────────────────────────────────────────────────────────

  describe('getProjeto()', () => {
    it('calls GET /api/v1/proj/projetos/{id}', () => {
      const getSpy = vi.fn().mockReturnValue(of({ id: 'proj-1' }));
      (service as unknown as { get: typeof getSpy }).get = getSpy;
      service.getProjeto('proj-1').subscribe();
      expect(getSpy).toHaveBeenCalledWith('/api/v1/proj/projetos/proj-1');
    });
  });

  // ── listPublicacoes ─────────────────────────────────────────────────────────

  describe('listPublicacoes()', () => {
    it('calls GET /api/v1/proj/projetos/{id}/publicacoes', () => {
      const getSpy = vi.fn().mockReturnValue(of([]));
      (service as unknown as { get: typeof getSpy }).get = getSpy;
      service.listPublicacoes('proj-1').subscribe();
      expect(getSpy).toHaveBeenCalledWith('/api/v1/proj/projetos/proj-1/publicacoes');
    });
  });

  // ── resolveDownloadUrl ──────────────────────────────────────────────────────

  describe('resolveDownloadUrl()', () => {
    it('calls GET /api/v1/proj/projetos/{id}/publicacoes/{pid}/download', () => {
      const getSpy = vi.fn().mockReturnValue(of({ arquivoUrl: 'https://cdn.example.com/file.epub' }));
      (service as unknown as { get: typeof getSpy }).get = getSpy;
      service.resolveDownloadUrl('proj-1', 'pub-2').subscribe();
      expect(getSpy).toHaveBeenCalledWith('/api/v1/proj/projetos/proj-1/publicacoes/pub-2/download');
    });
  });

  // ── reopenProjeto ───────────────────────────────────────────────────────────

  describe('reopenProjeto()', () => {
    it('calls POST /api/v1/proj/projetos/{id}/reopen with empty body', () => {
      postSpy.mockReturnValue(of({ id: 'proj-1', status: 'em_composicao' }));
      service.reopenProjeto('proj-1').subscribe();
      expect(postSpy).toHaveBeenCalledWith('/api/v1/proj/projetos/proj-1/reopen', {});
    });

    it('maps 409 ProblemDetail error to AppError', () => {
      const body = { type: 'urn:problem:conflict', title: 'Conflict', status: 409 };
      postSpy.mockReturnValue(throwError(() => makeErrorResponse(409, body)));

      let appError: { code: string; httpStatus?: number } | undefined;
      service.reopenProjeto('proj-1').subscribe({ error: e => (appError = e) });

      expect(appError?.code).toBe('urn:problem:conflict');
      expect(appError?.httpStatus).toBe(409);
    });
  });

  // ── deleteProjeto ───────────────────────────────────────────────────────────

  describe('deleteProjeto()', () => {
    it('calls DELETE /api/v1/proj/projetos/{id} and maps to void', () => {
      deleteSpy.mockReturnValue(of(null));
      let emitted: unknown = 'sentinel';
      service.deleteProjeto('proj-1').subscribe(v => (emitted = v));
      expect(deleteSpy).toHaveBeenCalledWith('/api/v1/proj/projetos/proj-1');
      expect(emitted).toBeUndefined();
    });
  });
});

/**
 * ProjetoApiService — URL prefix regression guard.
 *
 * These tests use provideHttpClientTesting() to intercept real HTTP calls and derive
 * the expected URLs from moduleBase('proj') — the same source as production code —
 * so the guard cannot become a copy of the bug.
 *
 * Contract note: listProjetos now uses getResponse() (observe: 'response') so the
 * intercepted request is the same URL but the response must include a body object.
 */
describe('ProjetoApiService — URL prefix regression guard', () => {
  let service: ProjetoApiService;
  let httpMock: HttpTestingController;

  /** Derives from moduleBase so spec tracks the same source as production code. */
  const PROJ_BASE = `${moduleBase('proj')}/projetos`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProjetoApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ACCESS_EMPRESA_ID, useValue: 'emp-aetos' },
      ],
    });
    service  = TestBed.inject(ProjetoApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('listProjetos uses /api/v1/proj/ prefix (not /api/proj/)', () => {
    service.listProjetos().subscribe();
    httpMock.expectNone(r => r.url.startsWith('/api/proj/'));
    const req = httpMock.expectOne(r => r.url.startsWith('/api/v1/proj/'));
    expect(req.request.url).toBe(PROJ_BASE);
    // Flush with envelope shape (api-contract §4.2)
    req.flush({ items: [], nextCursor: null });
  });

  it('listProjetos passes cursor param correctly', () => {
    service.listProjetos({ cursor: 'abc123', limit: 10 }).subscribe();
    const req = httpMock.expectOne(r => r.url.startsWith('/api/v1/proj/'));
    expect(req.request.url).toBe(`${PROJ_BASE}?limit=10&cursor=abc123`);
    req.flush({ items: [], nextCursor: null });
  });

  it('getProjeto uses /api/v1/proj/ prefix (not /api/proj/)', () => {
    service.getProjeto('proj-1').subscribe();
    httpMock.expectNone(r => r.url.startsWith('/api/proj/'));
    const req = httpMock.expectOne(r => r.url.startsWith('/api/v1/proj/'));
    expect(req.request.url).toBe(`${PROJ_BASE}/proj-1`);
    req.flush({ id: 'proj-1' });
  });

  it('listPublicacoes uses /api/v1/proj/ prefix (not /api/proj/)', () => {
    service.listPublicacoes('proj-1').subscribe();
    httpMock.expectNone(r => r.url.startsWith('/api/proj/'));
    const req = httpMock.expectOne(r => r.url.startsWith('/api/v1/proj/'));
    expect(req.request.url).toBe(`${PROJ_BASE}/proj-1/publicacoes`);
    req.flush([]);
  });

  it('resolveDownloadUrl uses /api/v1/proj/ prefix (not /api/proj/)', () => {
    service.resolveDownloadUrl('proj-1', 'pub-1').subscribe();
    httpMock.expectNone(r => r.url.startsWith('/api/proj/'));
    const req = httpMock.expectOne(r => r.url.startsWith('/api/v1/proj/'));
    expect(req.request.url).toBe(`${PROJ_BASE}/proj-1/publicacoes/pub-1/download`);
    req.flush({ publicacaoId: 'pub-1', arquivoUrl: 'https://cdn.example.com/file.epub', expiresAt: '' });
  });

  it('reopenProjeto uses /api/v1/proj/ prefix (not /api/proj/)', () => {
    service.reopenProjeto('proj-1').subscribe();
    httpMock.expectNone(r => r.url.startsWith('/api/proj/'));
    const req = httpMock.expectOne(r => r.url.startsWith('/api/v1/proj/'));
    expect(req.request.url).toBe(`${PROJ_BASE}/proj-1/reopen`);
    req.flush({ id: 'proj-1', status: 'em_composicao' });
  });

  it('createProjeto uses /api/v1/proj/ prefix (not /api/proj/)', () => {
    service.createProjeto({ nome: 'Novo Projeto' }).subscribe();
    httpMock.expectNone(r => r.url.startsWith('/api/proj/'));
    const req = httpMock.expectOne(r => r.url.startsWith('/api/v1/proj/'));
    expect(req.request.url).toBe(PROJ_BASE);
    req.flush({ id: 'new-id' });
  });

  it('deleteProjeto uses /api/v1/proj/ prefix (not /api/proj/)', () => {
    service.deleteProjeto('proj-1').subscribe();
    httpMock.expectNone(r => r.url.startsWith('/api/proj/'));
    const req = httpMock.expectOne(r => r.url.startsWith('/api/v1/proj/'));
    expect(req.request.url).toBe(`${PROJ_BASE}/proj-1`);
    req.flush(null, { status: 204, statusText: 'No Content' });
  });
});
