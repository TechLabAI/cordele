/**
 * segmento-curadoria-http.adapter.spec.ts — URL base path regression guard.
 *
 * Purpose: lock the versioned base path /api/v1/imp/manuscripts/... so that any
 * regression (accidentally reverting to /api/imp/manuscripts/...) is caught by
 * the test gate instead of only in runtime.
 *
 * imp-service uses NestJS URI versioning:
 *   app.setGlobalPrefix('api');
 *   app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
 * → every route is served under /api/v1/imp/...
 *   /api/imp/... returns 404.
 */
import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { SegmentoCuradoriaHttpAdapter } from './segmento-curadoria-http.adapter';
import { ACCESS_EMPRESA_ID, moduleBase } from '@cordele/shared/access-http-base';
import { ImpHttpClient } from '../imp-http-client';

const MANUSCRIPTS_BASE = `${moduleBase('imp')}/manuscripts`;
const MS_ID  = 'ms-guard-001';
const SEG_ID = 'seg-guard-42';

describe('SegmentoCuradoriaHttpAdapter — base path regression guard', () => {
  let adapter: SegmentoCuradoriaHttpAdapter;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [
        SegmentoCuradoriaHttpAdapter,
        ImpHttpClient,
        { provide: ACCESS_EMPRESA_ID, useValue: 'emp-aetos' },
      ],
    });

    adapter = TestBed.inject(SegmentoCuradoriaHttpAdapter);
    http    = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('ignore uses /api/v1/imp/ prefix (not /api/imp/)', () => {
    adapter.ignore(MS_ID, SEG_ID, {}).subscribe();
    const req = http.expectOne(r => r.url.startsWith(`${MANUSCRIPTS_BASE}/`));
    expect(req.request.url).toBe(`${MANUSCRIPTS_BASE}/${MS_ID}/segmentos/${SEG_ID}/ignore`);
    expect(req.request.method).toBe('POST');
    req.flush({});
  });

  it('restoreIgnore uses /api/v1/imp/ prefix', () => {
    adapter.restoreIgnore(MS_ID, SEG_ID).subscribe();
    const req = http.expectOne(`${MANUSCRIPTS_BASE}/${MS_ID}/segmentos/${SEG_ID}/ignore`);
    expect(req.request.method).toBe('DELETE');
    req.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('getIgnored uses /api/v1/imp/ prefix', () => {
    adapter.getIgnored(MS_ID).subscribe();
    const req = http.expectOne(`${MANUSCRIPTS_BASE}/${MS_ID}/segmentos/ignored`);
    expect(req.request.method).toBe('GET');
    req.flush({ manuscritoId: MS_ID, ignoredSegmentoIds: [] });
  });

  it('confirmEstrutura uses /api/v1/imp/ prefix', () => {
    adapter.confirmEstrutura(MS_ID).subscribe();
    const req = http.expectOne(`${MANUSCRIPTS_BASE}/${MS_ID}/confirm-estrutura`);
    expect(req.request.method).toBe('POST');
    req.flush(null, { status: 200, statusText: 'OK' });
  });

  it('does NOT send X-Empresa-Id header — empresa context resolved from JWT claim, not header', () => {
    // Even when ACCESS_EMPRESA_ID token is provided, the header must be absent.
    // Server resolves empresa from JWT `empresa_id` claim (EmpresaContextInterceptor).
    adapter.getIgnored(MS_ID).subscribe();
    const req = http.expectOne(`${MANUSCRIPTS_BASE}/${MS_ID}/segmentos/ignored`);
    expect(req.request.headers.get('X-Empresa-Id')).toBeNull();
    req.flush({ manuscritoId: MS_ID, ignoredSegmentoIds: [] });
  });
});
