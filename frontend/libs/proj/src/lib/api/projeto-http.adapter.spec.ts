/**
 * projeto-http.adapter.spec.ts — URL base path regression guard for ProjetoHttpAdapter.
 *
 * Purpose: lock the versioned base path /api/v1/proj/... so that any regression
 * (accidentally reverting to /api/proj/...) is caught by the test gate instead of
 * only in runtime.
 *
 * proj-service uses NestJS URI versioning:
 *   app.setGlobalPrefix('api');
 *   app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
 * → every route is served under /api/v1/proj/...
 *   /api/proj/... returns 404.
 *
 * Tests here do NOT call a real backend — they use provideHttpClientTesting()
 * to intercept and assert the exact URL that the adapter constructs.
 *
 * URL expected in each test is derived from moduleBase('proj') — never a hardcoded literal —
 * so the guard tracks the same source as the production code and cannot become a copy of the bug.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ProjetoHttpAdapter } from './projeto-http.adapter';
import { ACCESS_EMPRESA_ID, AccessHttpClient, moduleBase } from '@cordele/shared/access-http-base';

const PROJETO_ID = 'proj-guard-001';
/** Derives from moduleBase so spec tracks the same source as production code. */
const BASE = `${moduleBase('proj')}/projetos`;

describe('ProjetoHttpAdapter — base path regression guard', () => {
  let adapter: ProjetoHttpAdapter;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ProjetoHttpAdapter,
        AccessHttpClient,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ACCESS_EMPRESA_ID, useValue: 'emp-aetos' },
      ],
    });
    adapter = TestBed.inject(ProjetoHttpAdapter);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list uses /api/v1/proj/ prefix (not /api/proj/)', () => {
    adapter.list().subscribe();
    httpMock.expectNone(r => r.url.startsWith('/api/proj/'));
    const req = httpMock.expectOne(r => r.url.startsWith('/api/v1/proj/'));
    expect(req.request.url).toBe(BASE);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('get uses /api/v1/proj/ prefix (not /api/proj/)', () => {
    adapter.get(PROJETO_ID).subscribe();
    httpMock.expectNone(r => r.url.startsWith('/api/proj/'));
    const req = httpMock.expectOne(r => r.url.startsWith('/api/v1/proj/'));
    expect(req.request.url).toBe(`${BASE}/${PROJETO_ID}`);
    expect(req.request.method).toBe('GET');
    req.flush({ id: PROJETO_ID });
  });

  it('create uses /api/v1/proj/ prefix (not /api/proj/)', () => {
    adapter.create({ nome: 'Test Project' }).subscribe();
    httpMock.expectNone(r => r.url.startsWith('/api/proj/'));
    const req = httpMock.expectOne(r => r.url.startsWith('/api/v1/proj/'));
    expect(req.request.url).toBe(BASE);
    expect(req.request.method).toBe('POST');
    req.flush({ id: 'new-proj' });
  });

  it('reopen uses /api/v1/proj/ prefix (not /api/proj/)', () => {
    adapter.reopen(PROJETO_ID).subscribe();
    httpMock.expectNone(r => r.url.startsWith('/api/proj/'));
    const req = httpMock.expectOne(r => r.url.startsWith('/api/v1/proj/'));
    expect(req.request.url).toBe(`${BASE}/${PROJETO_ID}/reopen`);
    expect(req.request.method).toBe('POST');
    req.flush({ id: PROJETO_ID, status: 'em_composicao' });
  });

  it('delete uses /api/v1/proj/ prefix (not /api/proj/)', () => {
    adapter.delete(PROJETO_ID).subscribe();
    httpMock.expectNone(r => r.url.startsWith('/api/proj/'));
    const req = httpMock.expectOne(r => r.url.startsWith('/api/v1/proj/'));
    expect(req.request.url).toBe(`${BASE}/${PROJETO_ID}`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('does NOT send X-Empresa-Id header — empresa context resolved from JWT claim, not header', () => {
    // Even when ACCESS_EMPRESA_ID token is provided, the header must be absent.
    // Server resolves empresa from JWT `empresa_id` claim (EmpresaContextInterceptor).
    adapter.get(PROJETO_ID).subscribe();
    const req = httpMock.expectOne(`${BASE}/${PROJETO_ID}`);
    expect(req.request.headers.get('X-Empresa-Id')).toBeNull();
    req.flush({ id: PROJETO_ID });
  });
});
