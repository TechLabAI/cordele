/**
 * revisao-de-estrutura.component.spec.ts — Unit tests (FE-IMP-016 / P4).
 *
 * Strategy: spy on ReviewFacade via TestBed.overrideProvider — no HTTP involved.
 *
 * Criterios de aceite (plan §3 P4):
 *   - loadStructure chamado no init (deep-link path)
 *   - ignore → ReviewFacade.ignorarSegmento()
 *   - confirm → ReviewFacade.confirmarEstrutura()
 *   - skeleton visível quando phase === 'loading'
 */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { signal, computed } from '@angular/core';
import { RevisaoDeEstruturaComponent } from './revisao-de-estrutura.component';
import { ReviewFacade, ManuscritoDetail } from '@cordele/imp/data-access';

// ── Minimal manuscrito fixture ────────────────────────────────────────────────

const MOCK_MANUSCRITO: ManuscritoDetail = {
  id: 'ms-spec-001',
  projetoId: 'proj-spec-001',
  nomeArquivo: 'livro.docx',
  formato: 'docx',
  status: 'imported',
  totalCapitulos: 2,
  totalImagens: 0,
  trechosNaoParseados: 1,
  tamanhoBytes: 2048,
  estrutura: {
    schemaVersion: '1.0',
    formato: 'docx',
    chapters: [
      {
        id: 'ch-1',
        order: 1,
        title: 'Capítulo 1',
        blocks: [
          {
            type: 'unparsed',
            id: 'frag-001',
            order: 1,
            rawContent: 'raw text',
            reason: 'complex_table',
            sourceLocation: { kind: 'docx', paragraphIndex: 5, styleName: 'Normal' },
          },
        ],
        sections: [],
      },
      {
        id: 'ch-2',
        order: 2,
        title: 'Capítulo 2',
        blocks: [],
        sections: [],
      },
    ],
  },
  criadoEm: '2026-08-31T10:00:00Z',
};

// ── Facade stub factory ────────────────────────────────────────────────────────

type ReviewPhase = 'idle' | 'loading' | 'confirming' | 'error';

function buildFacadeStub(overrides: {
  phase?: ReviewPhase;
  manuscrito?: ManuscritoDetail | null;
  errorMessage?: string | null;
} = {}) {
  const _phase        = signal<ReviewPhase>(overrides.phase ?? 'idle');
  const _manuscrito   = signal<ManuscritoDetail | null>(overrides.manuscrito ?? null);
  const _ignoredIds   = signal<Set<string>>(new Set());
  const _errorMessage = signal<string | null>(overrides.errorMessage ?? null);

  return {
    phase:            _phase.asReadonly(),
    manuscrito:       _manuscrito.asReadonly(),
    ignoredIds:       _ignoredIds.asReadonly(),
    errorMessage:     _errorMessage.asReadonly(),
    estrutura:        computed(() => _manuscrito()?.estrutura ?? null),
    loadStructure:    vi.fn(),
    hydrateFromResponse: vi.fn((ms: ManuscritoDetail) => _manuscrito.set(ms)),
    ignorarSegmento:  vi.fn(),
    restaurarSegmento: vi.fn(),
    confirmarEstrutura: vi.fn(),
    // Internal setters for test control
    _phase,
    _manuscrito,
    _ignoredIds,
    _errorMessage,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function setup(options: {
  phase?: ReviewPhase;
  manuscrito?: ManuscritoDetail | null;
  routeParams?: Record<string, string>;
  historyState?: Record<string, unknown>;
} = {}) {
  const facadeStub = buildFacadeStub({
    phase:     options.phase,
    manuscrito: options.manuscrito ?? null,
  });

  // Override history.state for the component's ngOnInit
  if (options.historyState !== undefined) {
    Object.defineProperty(history, 'state', {
      value: options.historyState,
      writable: true,
      configurable: true,
    });
  } else {
    Object.defineProperty(history, 'state', {
      value: {},
      writable: true,
      configurable: true,
    });
  }

  TestBed.configureTestingModule({
    imports: [RevisaoDeEstruturaComponent],
    providers: [
      { provide: ReviewFacade, useValue: facadeStub },
      {
        provide: ActivatedRoute,
        useValue: {
          snapshot: {
            paramMap: {
              get: (key: string) => (options.routeParams ?? {})[key] ?? null,
            },
          },
        },
      },
    ],
  });

  const fixture: ComponentFixture<RevisaoDeEstruturaComponent> =
    TestBed.createComponent(RevisaoDeEstruturaComponent);
  const component = fixture.componentInstance;
  fixture.detectChanges();

  return { fixture, component, facadeStub };
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('RevisaoDeEstruturaComponent', () => {

  describe('ngOnInit — deep-link path', () => {
    it('should call ReviewFacade.loadStructure() with manuscritoId from route', () => {
      const { facadeStub } = setup({ routeParams: { manuscritoId: 'ms-spec-001' } });
      expect(facadeStub.loadStructure).toHaveBeenCalledWith('ms-spec-001');
    });

    it('should NOT call loadStructure when router state has manuscrito (happy path)', () => {
      const { facadeStub } = setup({
        historyState: { manuscrito: MOCK_MANUSCRITO },
        routeParams:  { manuscritoId: 'ms-spec-001' },
      });
      expect(facadeStub.loadStructure).not.toHaveBeenCalled();
      expect(facadeStub.hydrateFromResponse).toHaveBeenCalledWith(MOCK_MANUSCRITO);
    });
  });

  describe('ignore flow', () => {
    it('should call ReviewFacade.ignorarSegmento() when ignorar() is invoked', () => {
      const { component, facadeStub } = setup({ manuscrito: MOCK_MANUSCRITO });
      component.ignorar('frag-001');
      expect(facadeStub.ignorarSegmento).toHaveBeenCalledWith('frag-001');
    });
  });

  describe('restore flow', () => {
    it('should call ReviewFacade.restaurarSegmento() when restaurar() is invoked', () => {
      const { component, facadeStub } = setup({ manuscrito: MOCK_MANUSCRITO });
      component.restaurar('frag-001');
      expect(facadeStub.restaurarSegmento).toHaveBeenCalledWith('frag-001');
    });
  });

  describe('confirm flow', () => {
    it('should call ReviewFacade.confirmarEstrutura() when confirmar() is invoked', () => {
      const { component, facadeStub } = setup({ manuscrito: MOCK_MANUSCRITO });
      component.confirmar();
      expect(facadeStub.confirmarEstrutura).toHaveBeenCalled();
    });
  });

  describe('pendenciasAtivas()', () => {
    it('should count unparsed blocks that are not in ignoredIds', () => {
      const { component, facadeStub } = setup({ manuscrito: MOCK_MANUSCRITO });
      expect(component.pendenciasAtivas()).toBe(1);

      // Mark frag-001 as ignored
      facadeStub._ignoredIds.set(new Set(['frag-001']));
      // Force computed re-evaluation
      TestBed.flushEffects();
      expect(component.pendenciasAtivas()).toBe(0);
    });
  });

  describe('skeleton visibility (phase=loading)', () => {
    it('should render ContentTreeSkeletonComponent when phase is loading', () => {
      const { fixture } = setup({ phase: 'loading' });
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('imp-content-tree-skeleton')).toBeTruthy();
    });

    it('should NOT render ContentTreeSkeletonComponent when phase is idle', () => {
      const { fixture } = setup({ phase: 'idle', manuscrito: MOCK_MANUSCRITO });
      const el: HTMLElement = fixture.nativeElement;
      expect(el.querySelector('imp-content-tree-skeleton')).toBeNull();
    });
  });
});
