/**
 * projeto-api.service.spec.ts — unit tests for ProjetoApiService (FE-PROJ-007, P2).
 *
 * Strategy: mock AccessHttpClient methods via TestBed so no real HTTP occurs.
 * Verifies: correct URLs, ProblemDetail→AppError mapping on error, method delegation.
 */
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { HttpErrorResponse } from '@angular/common/http';
import { ProjetoApiService } from './projeto-api.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeErrorResponse(status: number, body: object): HttpErrorResponse {
  return new HttpErrorResponse({ error: body, status, url: '/api/proj/projetos/test' });
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
    it('calls GET /api/proj/projetos and emits result', () => {
      const cards = [{ id: 'p1', nome: 'Test' }];
      getSpy.mockReturnValue(of(cards));

      let result: unknown;
      service.listProjetos().subscribe(r => (result = r));

      expect(getSpy).toHaveBeenCalledWith('/api/proj/projetos');
      expect(result).toEqual(cards);
    });

    it('calls GET /api/proj/projetos?status=rascunho when status filter provided', () => {
      getSpy.mockReturnValue(of([]));
      service.listProjetos({ status: 'rascunho' }).subscribe();
      expect(getSpy).toHaveBeenCalledWith('/api/proj/projetos?status=rascunho');
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
    it('calls GET /api/proj/projetos/{id}', () => {
      getSpy.mockReturnValue(of({ id: 'proj-1' }));
      service.getProjeto('proj-1').subscribe();
      expect(getSpy).toHaveBeenCalledWith('/api/proj/projetos/proj-1');
    });
  });

  // ── listPublicacoes ─────────────────────────────────────────────────────────

  describe('listPublicacoes()', () => {
    it('calls GET /api/proj/projetos/{id}/publicacoes', () => {
      getSpy.mockReturnValue(of([]));
      service.listPublicacoes('proj-1').subscribe();
      expect(getSpy).toHaveBeenCalledWith('/api/proj/projetos/proj-1/publicacoes');
    });
  });

  // ── resolveDownloadUrl ──────────────────────────────────────────────────────

  describe('resolveDownloadUrl()', () => {
    it('calls GET /api/proj/projetos/{id}/publicacoes/{pid}/download', () => {
      getSpy.mockReturnValue(of({ arquivoUrl: 'https://cdn.example.com/file.epub' }));
      service.resolveDownloadUrl('proj-1', 'pub-2').subscribe();
      expect(getSpy).toHaveBeenCalledWith('/api/proj/projetos/proj-1/publicacoes/pub-2/download');
    });
  });

  // ── reopenProjeto ───────────────────────────────────────────────────────────

  describe('reopenProjeto()', () => {
    it('calls POST /api/proj/projetos/{id}/reopen with empty body', () => {
      postSpy.mockReturnValue(of({ id: 'proj-1', status: 'em_composicao' }));
      service.reopenProjeto('proj-1').subscribe();
      expect(postSpy).toHaveBeenCalledWith('/api/proj/projetos/proj-1/reopen', {});
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
    it('calls DELETE /api/proj/projetos/{id} and maps to void', () => {
      deleteSpy.mockReturnValue(of(null));
      let emitted: unknown = 'sentinel';
      service.deleteProjeto('proj-1').subscribe(v => (emitted = v));
      expect(deleteSpy).toHaveBeenCalledWith('/api/proj/projetos/proj-1');
      expect(emitted).toBeUndefined();
    });
  });
});
