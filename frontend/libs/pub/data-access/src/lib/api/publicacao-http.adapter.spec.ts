/**
 * publicacao-http.adapter.spec.ts — URL base path regression guard.
 *
 * Purpose: lock the versioned base path /api/v1/pub/... so that any regression
 * (accidentally reverting to /api/pub/...) is caught by the test gate instead of
 * only in runtime.
 *
 * pub-service uses NestJS URI versioning:
 *   app.setGlobalPrefix('api');
 *   app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
 * → every route is served under /api/v1/pub/...
 *   /api/pub/... returns 404.
 *
 * Tests here do NOT call a real backend — they use HttpClientTestingModule
 * to intercept and assert the exact URL that the adapter constructs.
 */
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { PublicacaoHttpAdapter } from './publicacao-http.adapter';
import { ACCESS_EMPRESA_ID } from '@cordele/shared/access-http-base';

const PROJETO_ID = 'proj-abc';
const PUB_ID     = 'pub-xyz';

describe('PublicacaoHttpAdapter — base path regression guard', () => {
  let adapter: PublicacaoHttpAdapter;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        PublicacaoHttpAdapter,
        { provide: ACCESS_EMPRESA_ID, useValue: 'emp-aetos' },
      ],
    });

    adapter = TestBed.inject(PublicacaoHttpAdapter);
    http    = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('triggerExport uses /api/v1/pub/ prefix (not /api/pub/)', () => {
    adapter.triggerExport(PROJETO_ID).subscribe();
    const req = http.expectOne(r => r.url.startsWith('/api/v1/pub/'));
    expect(req.request.url).toBe(`/api/v1/pub/projetos/${PROJETO_ID}/publicacoes`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('pollStatus uses /api/v1/pub/ prefix', () => {
    adapter.pollStatus(PROJETO_ID, PUB_ID).subscribe();
    const req = http.expectOne(r => r.url.startsWith('/api/v1/pub/'));
    expect(req.request.url).toBe(
      `/api/v1/pub/projetos/${PROJETO_ID}/publicacoes/${PUB_ID}/status`,
    );
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('list uses /api/v1/pub/ prefix', () => {
    adapter.list(PROJETO_ID).subscribe();
    const req = http.expectOne(r => r.url.startsWith('/api/v1/pub/'));
    expect(req.request.url).toBe(`/api/v1/pub/projetos/${PROJETO_ID}/publicacoes`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getDownloadUrl uses /api/v1/pub/ prefix', () => {
    adapter.getDownloadUrl(PROJETO_ID, PUB_ID).subscribe();
    const req = http.expectOne(r => r.url.startsWith('/api/v1/pub/'));
    expect(req.request.url).toBe(
      `/api/v1/pub/projetos/${PROJETO_ID}/publicacoes/${PUB_ID}/download`,
    );
    req.flush({});
  });

  it('getStats uses /api/v1/pub/ prefix', () => {
    adapter.getStats(PROJETO_ID).subscribe();
    const req = http.expectOne(r => r.url.startsWith('/api/v1/pub/'));
    expect(req.request.url).toBe(
      `/api/v1/pub/projetos/${PROJETO_ID}/publicacoes/stats`,
    );
    req.flush({});
  });

  it('getValidationMessages uses /api/v1/pub/ prefix without severity param', () => {
    adapter.getValidationMessages(PROJETO_ID, PUB_ID).subscribe();
    const req = http.expectOne(r => r.url.startsWith('/api/v1/pub/'));
    expect(req.request.url).toBe(
      `/api/v1/pub/projetos/${PROJETO_ID}/publicacoes/${PUB_ID}/validation-messages`,
    );
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('getValidationMessages appends severity=error when specified', () => {
    adapter.getValidationMessages(PROJETO_ID, PUB_ID, 'error').subscribe();
    const req = http.expectOne(r => r.url.includes('validation-messages'));
    expect(req.request.url).toBe(
      `/api/v1/pub/projetos/${PROJETO_ID}/publicacoes/${PUB_ID}/validation-messages?severity=error`,
    );
    req.flush([]);
  });

  it('getValidationMessages appends severity=warning when specified', () => {
    adapter.getValidationMessages(PROJETO_ID, PUB_ID, 'warning').subscribe();
    const req = http.expectOne(r => r.url.includes('validation-messages'));
    expect(req.request.url).toContain('severity=warning');
    req.flush([]);
  });

  it('sends X-Empresa-Id header on every request', () => {
    adapter.triggerExport(PROJETO_ID).subscribe();
    const req = http.expectOne(r => r.url.includes('publicacoes'));
    expect(req.request.headers.get('X-Empresa-Id')).toBe('emp-aetos');
    req.flush({});
  });
});
