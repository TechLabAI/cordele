/**
 * projeto-api.service.spec.ts — unit tests for ProjetoApiService (FE-PROJ-007, P2).
 *
 * Strategy: mock AccessHttpClient methods via TestBed so no real HTTP occurs.
 * Verifies: correct URLs, ProblemDetail→AppError mapping on error, method delegation.
 */
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ProjetoApiService } from './projeto-api.service';
import { ACCESS_EMPRESA_ID, moduleBase } from '@cordele/shared/access-http-base';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeErrorResponse(status: number, body: object): HttpErrorResponse {
  return new HttpErrorResponse({ error: body, status, url: '/api/v1/proj/projetos/test' });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ProjetoApiService', () => {
  let service: ProjetoApiService;
  let getSpy: ReturnType<typeof vi.fn>;
  let postSpy: ReturnType<typeof vi.fn>;
  let deleteSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    getSpy    = vi.fn();
    postSpy   = vi.fn();
    deleteSpy = vi.fn();

    TestBed.configureTestingModule({
      providers: [ProjetoApiService],
    });

    service = TestBed.inject(ProjetoApiService);

    // Patch AccessHttpClient methods directly on the instance
    (service as unknown as { get: typeof getSpy }).get    = getSpy;
    (service as unknown as { post: typeof postSpy }).post  = postSpy;
    (service as unknown as { delete: typeof deleteSpy }).delete = deleteSpy;
  });

  // ── listProjetos ────────────────────────────────────────────────────────────

  describe('listProjetos()', () => {
    it('calls GET /api/v1/proj/projetos and emits result', () => {
      const cards = [{ id: 'p1', nome: 'Test' }];
      getSpy.mockReturnValue(of(cards));

      let result: unknown;
      service.listProjetos().subscribe(r => (result = r));

      expect(getSpy).toHaveBeenCalledWith('/api/v1/proj/projetos');
      expect(result).toEqual(cards);
    });

    it('calls GET /api/v1/proj/projetos?status=rascunho when status filter provided', () => {
      getSpy.mockReturnValue(of([]));
      service.listProjetos({ status: 'rascunho' }).subscribe();
      expect(getSpy).toHaveBeenCalledWith('/api/v1/proj/projetos?status=rascunho');
    });

    it('maps ProblemDetail error to AppError on failure', () => {
      const body = { type: 'urn:problem:not-found', title: 'Not found', status: 404, detail: 'Nenhum projeto' };
      getSpy.mockReturnValue(throwError(() => makeErrorResponse(404, body)));

      let appError: { code: string; httpStatus?: number } | undefined;
      service.listProjetos().subscribe({ error: e => (appError = e) });

      expect(appError?.code).toBe('urn:problem:not-found');
      expect(appError?.httpStatus).toBe(404);
    });
  });

  // ── getProjeto ──────────────────────────────────────────────────────────────

  describe('getProjeto()', () => {
    it('calls GET /api/v1/proj/projetos/{id}', () => {
      getSpy.mockReturnValue(of({ id: 'proj-1' }));
      service.getProjeto('proj-1').subscribe();
      expect(getSpy).toHaveBeenCalledWith('/api/v1/proj/projetos/proj-1');
    });
  });

  // ── listPublicacoes ─────────────────────────────────────────────────────────

  describe('listPublicacoes()', () => {
    it('calls GET /api/v1/proj/projetos/{id}/publicacoes', () => {
      getSpy.mockReturnValue(of([]));
      service.listPublicacoes('proj-1').subscribe();
      expect(getSpy).toHaveBeenCalledWith('/api/v1/proj/projetos/proj-1/publicacoes');
    });
  });

  // ── resolveDownloadUrl ──────────────────────────────────────────────────────

  describe('resolveDownloadUrl()', () => {
    it('calls GET /api/v1/proj/projetos/{id}/publicacoes/{pid}/download', () => {
      getSpy.mockReturnValue(of({ arquivoUrl: 'https://cdn.example.com/file.epub' }));
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
 * The tests above (spy-based) already verify URL strings but with hardcoded literals.
 * These tests use provideHttpClientTesting() to intercept real HTTP calls and derive
 * the expected URLs from moduleBase('proj') — the same source as production code —
 * so the guard cannot become a copy of the bug.
 *
 * A revert of ACCESS_HTTP_BASE from '/api/v1' to '/api' would change what moduleBase()
 * returns AND what the adapter constructs, causing both to change together; that's why
 * deriving from moduleBase() is the correct approach: if someone changes only one side,
 * the guard catches it. If both sides are changed (the regression), the guard also catches
 * it because the expectOne predicate would find no matching request.
 *
 * ProjetoApiService extends AccessHttpClient which wraps inject(HttpClient).
 * With provideHttpClientTesting(), Angular replaces the HttpBackend with a mock,
 * so every inherited get/post/delete call is intercepted here.
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
    req.flush([]);
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
