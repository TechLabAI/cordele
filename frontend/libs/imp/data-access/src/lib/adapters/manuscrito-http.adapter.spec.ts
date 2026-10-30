/**
 * manuscrito-http.adapter.spec.ts — URL base path regression guard for ManuscritoHttpAdapter.
 *
 * Purpose: lock the versioned base path /api/v1/imp/... so that any regression
 * (accidentally reverting to /api/imp/...) is caught by the test gate instead of
 * only in runtime.
 *
 * imp-service uses NestJS URI versioning:
 *   app.setGlobalPrefix('api');
 *   app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
 * → every route is served under /api/v1/imp/...
 *   /api/imp/... returns 404.
 *
 * Tests here do NOT call a real backend — they use HttpClientTestingModule
 * to intercept and assert the exact URL that the adapter constructs.
 */
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ManuscritoHttpAdapter } from './manuscrito-http.adapter';
import { ACCESS_EMPRESA_ID, moduleBase } from '@cordele/shared/access-http-base';
import { ImpHttpClient } from '../imp-http-client';

const IMP_BASE = moduleBase('imp');
const MANUSCRITO_ID = 'ms-test-abc';
const PROJETO_ID    = 'proj-test-xyz';

describe('ManuscritoHttpAdapter — base path regression guard', () => {
  let adapter: ManuscritoHttpAdapter;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        ManuscritoHttpAdapter,
        ImpHttpClient,
        { provide: ACCESS_EMPRESA_ID, useValue: 'emp-aetos' },
      ],
    });

    adapter = TestBed.inject(ManuscritoHttpAdapter);
    http    = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('create uses /api/v1/imp/ prefix (not /api/imp/)', () => {
    const file = new File(['docx content'], 'book.docx');
    adapter.create({ file }).subscribe();
    const req = http.expectOne(r => r.url.startsWith(`${IMP_BASE}/`));
    expect(req.request.url).toBe(`${IMP_BASE}/manuscripts`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('get uses /api/v1/imp/ prefix', () => {
    adapter.get(MANUSCRITO_ID).subscribe();
    const req = http.expectOne(`${IMP_BASE}/manuscripts/${MANUSCRITO_ID}`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('getEstrutura uses /api/v1/imp/ prefix', () => {
    adapter.getEstrutura(MANUSCRITO_ID).subscribe();
    const req = http.expectOne(`${IMP_BASE}/manuscripts/${MANUSCRITO_ID}/estrutura`);
    expect(req.request.method).toBe('GET');
    req.flush({});
  });

  it('listByProjeto uses /api/v1/imp/ prefix', () => {
    adapter.listByProjeto(PROJETO_ID).subscribe();
    const req = http.expectOne(`${IMP_BASE}/projetos/${PROJETO_ID}/manuscritos`);
    expect(req.request.method).toBe('GET');
    req.flush([]);
  });

  it('does NOT send X-Empresa-Id header — empresa context resolved from JWT claim, not header', () => {
    // Even when ACCESS_EMPRESA_ID token is provided, the header must be absent.
    // Server resolves empresa from JWT `empresa_id` claim (EmpresaContextInterceptor).
    adapter.get(MANUSCRITO_ID).subscribe();
    const req = http.expectOne(`${IMP_BASE}/manuscripts/${MANUSCRITO_ID}`);
    expect(req.request.headers.get('X-Empresa-Id')).toBeNull();
    req.flush({});
  });
});
