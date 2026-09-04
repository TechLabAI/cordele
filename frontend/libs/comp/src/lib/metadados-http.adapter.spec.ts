/**
 * metadados-http.adapter.spec.ts — HttpTestingController tests for MetadadosHttpAdapter.
 * FE-COMP-006: GET/PUT metadados, POST/DELETE capa — URL, method and body verification.
 * INT-FE-COMP-001 (P4): verifies X-Empresa-Id header is propagated via AccessHttpClient.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MetadadosHttpAdapter } from './api/metadados-http.adapter';
import { ACCESS_EMPRESA_ID, AccessHttpClient, moduleBase } from '@cordele/shared/access-http-base';
import type { MetadadosDto } from './models/comp.models';

describe('MetadadosHttpAdapter', () => {
  let adapter: MetadadosHttpAdapter;
  let httpMock: HttpTestingController;

  const PROJECT_ID = 'proj-abc-001';
  /** Derives from moduleBase so spec tracks the same source as production code. */
  const BASE = `${moduleBase('comp')}/projetos/${PROJECT_ID}`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        MetadadosHttpAdapter,
        AccessHttpClient,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ACCESS_EMPRESA_ID, useValue: 'emp_aetos' },
      ],
    });
    adapter = TestBed.inject(MetadadosHttpAdapter);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('GET /metadados — uses correct URL and method', () => {
    const mockDto: MetadadosDto = {
      projetoId: PROJECT_ID,
      titulo: 'Livro Teste',
      autor: 'Autora Silva',
      isbn: null,
      idioma: 'pt',
      categoria: null,
      capaUrl: null,
      materialized: true,
    };

    let received: MetadadosDto | undefined;
    adapter.get(PROJECT_ID).subscribe(dto => { received = dto; });

    const req = httpMock.expectOne(`${BASE}/metadados`);
    expect(req.request.method).toBe('GET');
    req.flush(mockDto);

    expect(received?.titulo).toBe('Livro Teste');
  });

  it('GET /metadados — sends X-Empresa-Id header (INT-FE-COMP-001)', () => {
    adapter.get(PROJECT_ID).subscribe();

    const req = httpMock.expectOne(`${BASE}/metadados`);
    expect(req.request.headers.get('X-Empresa-Id')).toBe('emp_aetos');
    req.flush({
      projetoId: PROJECT_ID,
      titulo: 'T',
      autor: 'A',
      isbn: null,
      idioma: 'pt',
      categoria: null,
      capaUrl: null,
      materialized: false,
    });
  });

  it('PUT /metadados — sends correct URL, method, body and X-Empresa-Id header', () => {
    const putBody: MetadadosDto = {
      projetoId: PROJECT_ID,
      titulo: 'Título Atualizado',
      autor: 'Nova Autora',
      isbn: '978-3-16-148410-0',
      idioma: 'pt',
      categoria: 'Romance',
      capaUrl: null,
      materialized: false,
    };

    adapter.update(PROJECT_ID, putBody).subscribe();

    const req = httpMock.expectOne(`${BASE}/metadados`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(putBody);
    expect(req.request.headers.get('X-Empresa-Id')).toBe('emp_aetos');
    req.flush({ ...putBody, materialized: true });
  });

  it('POST /capa — uses multipart FormData with "file" field', () => {
    const file = new File(['jpeg-bytes'], 'capa.jpg', { type: 'image/jpeg' });

    let capaUrl: string | undefined;
    adapter.uploadCapa(PROJECT_ID, file).subscribe(res => { capaUrl = res.capaUrl; });

    const req = httpMock.expectOne(`${BASE}/capa`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body instanceof FormData).toBe(true);
    expect((req.request.body as FormData).get('file')).toBeTruthy();
    req.flush({ capaUrl: 'https://cdn.example.com/capa.jpg' });

    expect(capaUrl).toBe('https://cdn.example.com/capa.jpg');
  });

  it('DELETE /capa — uses correct URL and method; 204 response', () => {
    let completed = false;
    adapter.removeCapa(PROJECT_ID).subscribe({ complete: () => { completed = true; } });

    const req = httpMock.expectOne(`${BASE}/capa`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  /**
   * URL prefix regression guard.
   *
   * Locks the /api/v1/comp/ prefix so that a revert to /api/comp/ (e.g. removing the
   * /v1 segment from ACCESS_HTTP_BASE or moduleBase) is caught here before reaching runtime.
   *
   * Each test uses a predicate on expectOne so the guard fails when the URL
   * does NOT start with /api/v1/comp/ (no matching request → test error).
   * expectNone on the un-versioned path adds an explicit negative assertion.
   *
   * URL is derived from moduleBase('comp') — never a hardcoded literal — so the guard
   * tracks the same source as the production code and cannot become a copy of the bug.
   */
  describe('URL prefix regression guard', () => {
    it('get uses /api/v1/comp/ prefix (not /api/comp/)', () => {
      adapter.get(PROJECT_ID).subscribe();
      httpMock.expectNone(r => r.url.startsWith('/api/comp/'));
      const req = httpMock.expectOne(r => r.url.startsWith('/api/v1/comp/'));
      expect(req.request.url).toBe(`${BASE}/metadados`);
      req.flush({});
    });

    it('update uses /api/v1/comp/ prefix (not /api/comp/)', () => {
      adapter.update(PROJECT_ID, {}).subscribe();
      httpMock.expectNone(r => r.url.startsWith('/api/comp/'));
      const req = httpMock.expectOne(r => r.url.startsWith('/api/v1/comp/'));
      expect(req.request.url).toBe(`${BASE}/metadados`);
      req.flush({});
    });

    it('uploadCapa uses /api/v1/comp/ prefix (not /api/comp/)', () => {
      const file = new File(['bytes'], 'capa.jpg');
      adapter.uploadCapa(PROJECT_ID, file).subscribe();
      httpMock.expectNone(r => r.url.startsWith('/api/comp/'));
      const req = httpMock.expectOne(r => r.url.startsWith('/api/v1/comp/'));
      expect(req.request.url).toBe(`${BASE}/capa`);
      req.flush({ capaUrl: 'https://cdn.example.com/capa.jpg' });
    });

    it('removeCapa uses /api/v1/comp/ prefix (not /api/comp/)', () => {
      adapter.removeCapa(PROJECT_ID).subscribe();
      httpMock.expectNone(r => r.url.startsWith('/api/comp/'));
      const req = httpMock.expectOne(r => r.url.startsWith('/api/v1/comp/'));
      expect(req.request.url).toBe(`${BASE}/capa`);
      req.flush(null, { status: 204, statusText: 'No Content' });
    });
  });
});
