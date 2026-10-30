/**
 * layout.facade.spec.ts — unit tests for LayoutFacade state machine.
 * FE-COMP-009: forkJoin, 409→empty, canExport, onExport stale override filtering,
 *              onStyleChange clamping (h1≥h2≥h3), onAlignmentChange local-only.
 *
 * Pattern: each describe block has its own beforeEach that calls
 * TestBed.configureTestingModule so the module is fresh for each group.
 */
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { LayoutFacade, LAYOUT_LIMITS } from './layout.facade';
import { LAYOUT_PORT } from './api/layout.port';
import type { LayoutPort } from './api/layout.port';
import type { ConfiguracaoLayoutDto, PreviewContextDto, UpsertLayoutBody } from './models/comp.models';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DEFAULT_LAYOUT: ConfiguracaoLayoutDto = {
  fonteCorpoFamilia: 'serif',
  fonteCorpoTamanho: 12,
  espacamentoLinha: 1.5,
  margemLateral: 20,
  h1Tamanho: 28,
  h2Tamanho: 22,
  h3Tamanho: 18,
  materialized: false,
};

const MOCK_PREVIEW: PreviewContextDto = {
  projetoId: 'proj-001',
  arvore: [
    { nodeId: 'node-cap-1', tipo: 'capitulo', n: 1, titulo: 'Cap 1', texto: 'Texto' },
    { nodeId: 'node-img-1', tipo: 'imagem',   n: 2, titulo: 'Figura 1', alinhamento: 'centralizado' },
  ],
  layout: DEFAULT_LAYOUT,
  overrides: [
    { nodeId: 'node-img-1', tipo: 'imagem', alinhamento: 'centralizado' },
  ],
};

function makeRouter(): { navigate: ReturnType<typeof vi.fn> } {
  return { navigate: vi.fn().mockResolvedValue(true) };
}

function makePort(overrides: Partial<LayoutPort> = {}): LayoutPort {
  return {
    getLayout:        vi.fn().mockReturnValue(of(DEFAULT_LAYOUT)),
    upsertLayout:     vi.fn().mockReturnValue(of({ ...DEFAULT_LAYOUT, materialized: true })),
    getPreviewContext: vi.fn().mockReturnValue(of(MOCK_PREVIEW)),
    ...overrides,
  };
}

function setup(port: LayoutPort, router: ReturnType<typeof makeRouter>): LayoutFacade {
  TestBed.configureTestingModule({
    providers: [
      LayoutFacade,
      { provide: LAYOUT_PORT, useValue: port },
      { provide: Router, useValue: router },
    ],
  });
  return TestBed.inject(LayoutFacade);
}

// ── Initial state ─────────────────────────────────────────────────────────────

describe('LayoutFacade — initial state', () => {
  let facade: LayoutFacade;

  beforeEach(() => {
    facade = setup(makePort(), makeRouter());
  });

  it('starts in idle status with saving=false', () => {
    expect(facade.status()).toBe('idle');
    expect(facade.saving()).toBe(false);
  });
});

// ── loadData: forkJoin success ────────────────────────────────────────────────

describe('LayoutFacade — loadData: 200/200 success', () => {
  let facade: LayoutFacade;
  let port: LayoutPort;

  beforeEach(() => {
    port = makePort();
    facade = setup(port, makeRouter());
  });

  it('issues getLayout and getPreviewContext in parallel → status=ready', () => {
    facade.loadData('proj-001');
    TestBed.flushEffects();

    expect(vi.mocked(port.getLayout)).toHaveBeenCalledWith('proj-001');
    expect(vi.mocked(port.getPreviewContext)).toHaveBeenCalledWith('proj-001');
    expect(facade.status()).toBe('ready');
  });

  it('populates paginas from preview arvore', () => {
    facade.loadData('proj-001');
    TestBed.flushEffects();
    expect(facade.paginas()).toHaveLength(2);
  });
});

// ── loadData: 409 manuscript-missing ─────────────────────────────────────────

describe('LayoutFacade — loadData: 409 manuscript-missing on preview', () => {
  let facade: LayoutFacade;

  beforeEach(() => {
    const port = makePort({
      getPreviewContext: vi.fn().mockReturnValue(
        throwError(() => ({
          status: 409,
          error: { type: 'urn:cordele:comp:manuscript-missing' },
          message: 'Conflict',
        })),
      ),
    });
    facade = setup(port, makeRouter());
  });

  it('status=empty; layout loaded (panel still accessible)', () => {
    facade.loadData('proj-001');
    TestBed.flushEffects();

    expect(facade.status()).toBe('empty');
    expect(facade.layout().fonteCorpoFamilia).toBe('serif');
    expect(facade.paginas()).toHaveLength(0);
  });
});

// ── loadData: 5xx error ───────────────────────────────────────────────────────

describe('LayoutFacade — loadData: 5xx on getLayout', () => {
  let facade: LayoutFacade;

  beforeEach(() => {
    const port = makePort({
      getLayout: vi.fn().mockReturnValue(throwError(() => ({ status: 500, error: {}, message: 'Server error' }))),
    });
    facade = setup(port, makeRouter());
  });

  it('status=error with CompUiError set', () => {
    facade.loadData('proj-001');
    TestBed.flushEffects();
    expect(facade.status()).toBe('error');
    expect(facade.error()).not.toBeNull();
  });
});

// ── onStyleChange ─────────────────────────────────────────────────────────────

describe('LayoutFacade — onStyleChange', () => {
  let facade: LayoutFacade;
  let port: LayoutPort;

  beforeEach(() => {
    port = makePort();
    facade = setup(port, makeRouter());
    facade.loadData('proj-001');
    TestBed.flushEffects();
    vi.mocked(port.upsertLayout).mockClear();
  });

  it('updates layout signal locally WITHOUT HTTP call', () => {
    facade.onStyleChange('fonteCorpoTamanho', 14);
    expect(facade.layout().fonteCorpoTamanho).toBe(14);
    expect(vi.mocked(port.upsertLayout)).not.toHaveBeenCalled();
  });

  it('clamps fonteCorpoTamanho to max limit', () => {
    facade.onStyleChange('fonteCorpoTamanho', 100);
    expect(facade.layout().fonteCorpoTamanho).toBeLessThanOrEqual(LAYOUT_LIMITS.fonteCorpoTamanho.max);
  });

  it('enforces h2 ≥ h3: raising h3 above h2 raises h2 accordingly', () => {
    facade.onStyleChange('h3Tamanho', 30);
    expect(facade.layout().h2Tamanho).toBeGreaterThanOrEqual(facade.layout().h3Tamanho);
  });

  it('enforces h1 ≥ h2: raising h2 above h1 raises h1 accordingly', () => {
    facade.onStyleChange('h2Tamanho', 35);
    expect(facade.layout().h1Tamanho).toBeGreaterThanOrEqual(facade.layout().h2Tamanho);
  });
});

// ── onAlignmentChange ─────────────────────────────────────────────────────────

describe('LayoutFacade — onAlignmentChange', () => {
  let facade: LayoutFacade;
  let port: LayoutPort;

  beforeEach(() => {
    port = makePort();
    facade = setup(port, makeRouter());
    facade.loadData('proj-001');
    TestBed.flushEffects();
    vi.mocked(port.upsertLayout).mockClear();
  });

  it('updates local overrides WITHOUT HTTP call (comp-no-optimistic)', () => {
    facade.onAlignmentChange('node-img-1', 'junto-esquerda');
    expect(vi.mocked(port.upsertLayout)).not.toHaveBeenCalled();
    const override = facade.overrides().find(o => o.nodeId === 'node-img-1');
    expect(override?.alinhamento).toBe('junto-esquerda');
  });
});

// ── canExport ─────────────────────────────────────────────────────────────────

describe('LayoutFacade — canExport', () => {
  let facade: LayoutFacade;

  beforeEach(() => {
    facade = setup(makePort(), makeRouter());
    facade.loadData('proj-001');
    TestBed.flushEffects();
  });

  it('true with the §7.2 default layout', () => {
    expect(facade.canExport()).toBe(true);
  });

  it('enforces h1≥h2 after style change (no invalid export state)', () => {
    facade.onStyleChange('h1Tamanho', 20);
    facade.onStyleChange('h2Tamanho', 25);
    // Clamping should have raised h1 to 25
    expect(facade.layout().h1Tamanho).toBeGreaterThanOrEqual(facade.layout().h2Tamanho);
    expect(facade.canExport()).toBe(true);
  });
});

// ── onExport: success ─────────────────────────────────────────────────────────

describe('LayoutFacade — onExport: 200 success', () => {
  let facade: LayoutFacade;
  let port: LayoutPort;
  let router: ReturnType<typeof makeRouter>;

  beforeEach(() => {
    port = makePort();
    router = makeRouter();
    facade = setup(port, router);
    facade.loadData('proj-001');
    TestBed.flushEffects();
  });

  it('PUT /layout and navigates to PUB on 200', () => {
    facade.onExport();
    TestBed.flushEffects();

    expect(vi.mocked(port.upsertLayout)).toHaveBeenCalledOnce();
    expect(router.navigate).toHaveBeenCalledWith([
      '/pub', 'projetos', 'proj-001', 'exportacao-e-validacao',
    ]);
    expect(facade.saving()).toBe(false);
  });

  it('PUT body never contains tipo=em-branco (D-H)', () => {
    facade.onAlignmentChange('node-img-1', 'junto-direita');
    facade.onExport();
    TestBed.flushEffects();

    const body = vi.mocked(port.upsertLayout).mock.calls[0][1] as UpsertLayoutBody;
    const hasBranco = body.overrides.some(o => o.tipo === ('em-branco' as string));
    expect(hasBranco).toBe(false);
  });

});

// ── onExport: stale override filtering ───────────────────────────────────────

describe('LayoutFacade — onExport: stale overrides excluded', () => {
  let facade: LayoutFacade;
  let portWithStale: LayoutPort;
  let router: ReturnType<typeof makeRouter>;

  beforeEach(() => {
    portWithStale = makePort({
      getPreviewContext: vi.fn().mockReturnValue(of({
        ...MOCK_PREVIEW,
        overrides: [
          { nodeId: 'node-img-1',    tipo: 'imagem' as const, alinhamento: 'centralizado' as const },
          { nodeId: 'node-STALE-99', tipo: 'imagem' as const, alinhamento: 'junto-esquerda' as const },
        ],
      })),
    });
    router = makeRouter();
    facade = setup(portWithStale, router);
    facade.loadData('proj-001');
    TestBed.flushEffects();
  });

  it('stale nodeId not in current arvore is excluded from PUT body', () => {
    facade.onExport();
    TestBed.flushEffects();

    const body = vi.mocked(portWithStale.upsertLayout).mock.calls[0][1] as UpsertLayoutBody;
    const staleInPayload = body.overrides.some(o => o.nodeId === 'node-STALE-99');
    expect(staleInPayload).toBe(false);
  });
});

// ── onExport: 422 ────────────────────────────────────────────────────────────

describe('LayoutFacade — onExport: 422 override-ref-not-found', () => {
  let facade: LayoutFacade;
  let router: ReturnType<typeof makeRouter>;

  beforeEach(() => {
    const port = makePort({
      upsertLayout: vi.fn().mockReturnValue(throwError(() => ({
        status: 422,
        error: { type: 'urn:cordele:comp:override-ref-not-found', detail: 'Override ref not found' },
        message: 'Unprocessable entity',
      }))),
    });
    router = makeRouter();
    facade = setup(port, router);
    facade.loadData('proj-001');
    TestBed.flushEffects();
  });

  it('saving=false, toast set, NO navigate, edits preserved', () => {
    facade.onStyleChange('fonteCorpoTamanho', 14);
    facade.onExport();
    TestBed.flushEffects();

    expect(facade.saving()).toBe(false);
    expect(router.navigate).not.toHaveBeenCalled();
    expect(facade.toast()).toBeTruthy();
    expect(facade.layout().fonteCorpoTamanho).toBe(14);
  });
});

// ── onExport: 5xx ────────────────────────────────────────────────────────────

describe('LayoutFacade — onExport: 5xx error', () => {
  let facade: LayoutFacade;
  let router: ReturnType<typeof makeRouter>;

  beforeEach(() => {
    const port = makePort({
      upsertLayout: vi.fn().mockReturnValue(throwError(() => ({ status: 500, error: {}, message: 'Server error' }))),
    });
    router = makeRouter();
    facade = setup(port, router);
    facade.loadData('proj-001');
    TestBed.flushEffects();
  });

  it('saving=false, toast set, NO navigate', () => {
    facade.onExport();
    TestBed.flushEffects();

    expect(facade.saving()).toBe(false);
    expect(router.navigate).not.toHaveBeenCalled();
    expect(facade.toast()).toBeTruthy();
  });
});

// ── pagination ────────────────────────────────────────────────────────────────

describe('LayoutFacade — pagination', () => {
  let facade: LayoutFacade;

  beforeEach(() => {
    facade = setup(makePort(), makeRouter());
    facade.loadData('proj-001');
    TestBed.flushEffects();
  });

  it('onNextPage / onPrevPage adjusts index without network call', () => {
    expect(facade.paginaIdx()).toBe(0);
    facade.onNextPage();
    expect(facade.paginaIdx()).toBe(1);
    facade.onPrevPage();
    expect(facade.paginaIdx()).toBe(0);
  });

  it('onPrevPage cannot go below 0', () => {
    facade.onPrevPage();
    expect(facade.paginaIdx()).toBe(0);
  });
});
