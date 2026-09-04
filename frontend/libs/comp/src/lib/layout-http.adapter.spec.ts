/**
 * layout-http.adapter.spec.ts — HttpTestingController tests for LayoutHttpAdapter.
 * FE-COMP-007: GET layout, PUT layout (upsertLayout body), GET preview-context.
 * Key constraint: PUT /layout payload NEVER includes tipo='em-branco' (D-H / ADR-COMP-001).
 * INT-FE-COMP-001 (P4): verifies X-Empresa-Id header is propagated via AccessHttpClient.
 */
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LayoutHttpAdapter } from './api/layout-http.adapter';
import { ACCESS_EMPRESA_ID, AccessHttpClient, moduleBase } from '@cordele/shared/access-http-base';
import type { UpsertLayoutBody, ConfiguracaoLayoutDto } from './models/comp.models';

describe('LayoutHttpAdapter', () => {
  let adapter: LayoutHttpAdapter;
  let httpMock: HttpTestingController;

  const PROJECT_ID = 'proj-xyz-002';
  /** Derives from moduleBase so spec tracks the same source as production code. */
  const BASE = `${moduleBase('comp')}/projetos/${PROJECT_ID}`;

  const MOCK_LAYOUT: ConfiguracaoLayoutDto = {
    fonteCorpoFamilia: 'serif',
    fonteCorpoTamanho: 12,
    espacamentoLinha: 1.5,
    margemLateral: 20,
    h1Tamanho: 28,
    h2Tamanho: 22,
    h3Tamanho: 18,
    materialized: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        LayoutHttpAdapter,
        AccessHttpClient,
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ACCESS_EMPRESA_ID, useValue: 'emp_aetos' },
      ],
    });
    adapter = TestBed.inject(LayoutHttpAdapter);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('GET /layout — uses correct URL and method', () => {
    adapter.getLayout(PROJECT_ID).subscribe(dto => {
      expect(dto.fonteCorpoFamilia).toBe('serif');
    });

    const req = httpMock.expectOne(`${BASE}/layout`);
    expect(req.request.method).toBe('GET');
    req.flush(MOCK_LAYOUT);
  });

  it('GET /layout — sends X-Empresa-Id header (INT-FE-COMP-001)', () => {
    adapter.getLayout(PROJECT_ID).subscribe();

    const req = httpMock.expectOne(`${BASE}/layout`);
    expect(req.request.headers.get('X-Empresa-Id')).toBe('emp_aetos');
    req.flush(MOCK_LAYOUT);
  });

  it('PUT /layout — upsertLayout sends typography params + overrides (tipo=imagem only)', () => {
    const body: UpsertLayoutBody = {
      fonteCorpoFamilia: 'serif',
      fonteCorpoTamanho: 12,
      espacamentoLinha: 1.5,
      margemLateral: 20,
      h1Tamanho: 28,
      h2Tamanho: 22,
      h3Tamanho: 18,
      overrides: [
        { nodeId: 'node-img-001', tipo: 'imagem', alinhamento: 'centralizado' },
      ],
    };

    adapter.upsertLayout(PROJECT_ID, body).subscribe(dto => {
      expect(dto.materialized).toBe(true);
    });

    const req = httpMock.expectOne(`${BASE}/layout`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(body);

    // Critical: body must NOT contain tipo='em-branco' (D-H)
    const payload = req.request.body as UpsertLayoutBody;
    const hasBranco = payload.overrides.some(o => o.tipo === ('em-branco' as string));
    expect(hasBranco).toBe(false);

    req.flush({ ...MOCK_LAYOUT, materialized: true });
  });

  it('PUT /layout — sends X-Empresa-Id header (INT-FE-COMP-001)', () => {
    const body: UpsertLayoutBody = {
      fonteCorpoFamilia: 'serif',
      fonteCorpoTamanho: 12,
      espacamentoLinha: 1.5,
      margemLateral: 20,
      h1Tamanho: 28,
      h2Tamanho: 22,
      h3Tamanho: 18,
      overrides: [],
    };

    adapter.upsertLayout(PROJECT_ID, body).subscribe();

    const req = httpMock.expectOne(`${BASE}/layout`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.headers.get('X-Empresa-Id')).toBe('emp_aetos');
    req.flush(MOCK_LAYOUT);
  });

  it('PUT /layout — overrides array may be empty (export with no image overrides)', () => {
    const body: UpsertLayoutBody = {
      fonteCorpoFamilia: 'sans-serif',
      fonteCorpoTamanho: 14,
      espacamentoLinha: 1.6,
      margemLateral: 24,
      h1Tamanho: 28,
      h2Tamanho: 22,
      h3Tamanho: 18,
      overrides: [],
    };

    adapter.upsertLayout(PROJECT_ID, body).subscribe();

    const req = httpMock.expectOne(`${BASE}/layout`);
    expect(req.request.method).toBe('PUT');
    expect((req.request.body as UpsertLayoutBody).overrides).toEqual([]);
    req.flush({ ...MOCK_LAYOUT, fonteCorpoFamilia: 'sans-serif', materialized: true });
  });

  it('GET /preview-context — uses correct URL and method', () => {
    adapter.getPreviewContext(PROJECT_ID).subscribe(ctx => {
      expect(ctx.projetoId).toBe(PROJECT_ID);
    });

    const req = httpMock.expectOne(`${BASE}/preview-context`);
    expect(req.request.method).toBe('GET');
    req.flush({
      projetoId: PROJECT_ID,
      arvore: [],
      layout: MOCK_LAYOUT,
      overrides: [],
    });
  });
});
