/**
 * publicacao-http.adapter.spec.ts — URL base path regression guard for PROJ PublicacaoHttpAdapter.
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
 * NOTE: This is the PROJ module's PublicacaoHttpAdapter (GET publication history + signed download URL).
 * It is distinct from the PUB module's PublicacaoHttpAdapter (trigger export + poll status).
 *
 * URL expected in each test is derived from moduleBase('proj') — never a hardcoded literal —
 * so the guard tracks the same source as the production code and cannot become a copy of the bug.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PublicacaoHttpAdapter } from './publicacao-http.adapter';
import { ACCESS_EMPRESA_ID, AccessHttpClient, moduleBase } from '@cordele/shared/access-http-base';

const PROJETO_ID    = 'proj-guard-001';
const PUBLICACAO_ID = 'pub-guard-42';
/** Derives from moduleBase so spec tracks the same source as production code. */
const BASE = `${moduleBase('proj')}/projetos`;

describe('PublicacaoHttpAdapter (proj) — base path regression guard', () => {
  let adapter: PublicacaoHttpAdapter;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PublicacaoHttpAdapter,
        AccessHttpClient,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ACCESS_EMPRESA_ID, useValue: 'emp-aetos' },
      ],
    });
    adapter = TestBed.inject(PublicacaoHttpAdapter);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('list uses /api/v1/proj/ prefix (not /api/proj/)', () => {
    adapter.list(PROJETO_ID).subscribe();
    httpMock.expectNone(r => r.url.startsWith('/api/proj/'));
    const req = httpMock.expectOne(r => r.url.startsWith('/api/v1/proj/'));
    expect(req.request.url).toBe(`${BASE}/${PROJETO_ID}/publicacoes`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getDownloadUrl uses /api/v1/proj/ prefix (not /api/proj/)', () => {
    adapter.getDownloadUrl(PROJETO_ID, PUBLICACAO_ID).subscribe();
    httpMock.expectNone(r => r.url.startsWith('/api/proj/'));
    const req = httpMock.expectOne(r => r.url.startsWith('/api/v1/proj/'));
    expect(req.request.url).toBe(
      `${BASE}/${PROJETO_ID}/publicacoes/${PUBLICACAO_ID}/download`,
    );
    expect(req.request.method).toBe('GET');
    req.flush({
      publicacaoId: PUBLICACAO_ID,
      arquivoUrl: 'https://cdn.example.com/file.epub',
      expiresAt: '2026-09-04T12:00:00Z',
    });
  });

  it('does NOT send X-Empresa-Id header — empresa context resolved from JWT claim, not header', () => {
    // Even when ACCESS_EMPRESA_ID token is provided, the header must be absent.
    // Server resolves empresa from JWT `empresa_id` claim (EmpresaContextInterceptor).
    adapter.list(PROJETO_ID).subscribe();
    const req = httpMock.expectOne(`${BASE}/${PROJETO_ID}/publicacoes`);
    expect(req.request.headers.get('X-Empresa-Id')).toBeNull();
    req.flush([]);
  });
});
