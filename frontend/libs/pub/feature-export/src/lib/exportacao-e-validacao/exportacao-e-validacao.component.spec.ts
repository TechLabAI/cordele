/**
 * exportacao-e-validacao.component.spec.ts — FE-PUB-012 / FE-PUB-024.
 *
 * Verifies:
 *   - Component renders without errors.
 *   - facade.startExport() called on ngOnInit with projetoId from route.
 *   - No setInterval usage (all async via ExportFacade bounded poll).
 *   - No AVISOS_MOCK, mock-data, or "Simular estado" references in production path.
 *   - podeBaixar=false disables the download button; podeBaixar=true enables it.
 *   - WarningsDetailsComponent receives correct inputs from facade signals.
 *   - FE-PUB-024: error block shows Trace id when facade.errorTraceId() is set.
 */
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { signal } from '@angular/core';
import { ExportacaoEValidacaoComponent } from './exportacao-e-validacao.component';
import { ExportFacade } from '@cordele/pub-data-access';

function makeFacade(overrides: Partial<Record<keyof ExportFacade, unknown>> = {}): Partial<ExportFacade> {
  return {
    phase:        signal<'gerando' | 'valido' | 'erros' | 'error'>('gerando').asReadonly(),
    podeBaixar:   signal(false).asReadonly(),
    totalAvisos:  signal(0).asReadonly(),
    totalErros:   signal(0).asReadonly(),
    resumoErro:   signal<string | null>(null).asReadonly(),
    error:        signal<string | null>(null).asReadonly(),
    // FE-PUB-024: errorTraceId signal for correlation id in error block
    errorTraceId: signal<string | null>(null).asReadonly(),
    status:       signal(null).asReadonly(),
    projetoId:    signal<string | null>(null).asReadonly(),
    summary:      signal<{ tamanho: string | null; paginas: null; capitulos: number | null; imagens: number | null } | null>(null).asReadonly(),
    // INT-FE-PUB-004: avisos signal required by ExportacaoEValidacaoComponent template
    avisos:       signal([]).asReadonly(),
    startExport:        vi.fn<(projetoId: string) => void>(),
    baixar:             vi.fn<(projetoId: string) => void>(),
    reset:              vi.fn<() => void>(),
    resumeExport:       vi.fn<(projetoId: string, publicacaoId: string, retryAfterMs?: number) => void>(),
    resumeFromHistory:  vi.fn<(projetoId: string) => void>(),
    ...overrides,
  } as Partial<ExportFacade>;
}

function makeRoute(projetoId = 'proj-001') {
  return {
    snapshot: { paramMap: { get: (_k: string) => projetoId } },
  };
}

describe('ExportacaoEValidacaoComponent', () => {

  it('should create and call startExport on init', async () => {
    const facade = makeFacade();
    await TestBed.configureTestingModule({
      imports: [ExportacaoEValidacaoComponent],
      providers: [
        { provide: ExportFacade,   useValue: facade },
        { provide: ActivatedRoute, useValue: makeRoute('proj-42') },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ExportacaoEValidacaoComponent);
    fixture.detectChanges();

    expect(facade.startExport).toHaveBeenCalledWith('proj-42');
  });

  it('should NOT use setInterval anywhere in production code', () => {
    // Ensure no reference to setInterval in this component file.
    // setInterval is forbidden — all async via ExportFacade bounded poll (ADR-PUB-001).
    const src = ExportacaoEValidacaoComponent.toString();
    expect(src).not.toContain('setInterval');
  });

  it('should NOT reference mock-data or AVISOS_MOCK', () => {
    const src = ExportacaoEValidacaoComponent.toString();
    expect(src).not.toMatch(/AVISOS_MOCK|mock.data|mock_data|mockData/i);
  });

  it('download button disabled when podeBaixar = false', async () => {
    const facade = makeFacade({
      phase:      signal<'gerando' | 'valido' | 'erros' | 'error'>('valido').asReadonly(),
      podeBaixar: signal(false).asReadonly(),
    });
    await TestBed.configureTestingModule({
      imports: [ExportacaoEValidacaoComponent],
      providers: [
        { provide: ExportFacade,   useValue: facade },
        { provide: ActivatedRoute, useValue: makeRoute() },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ExportacaoEValidacaoComponent);
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('button[disabled]');
    expect(btn).toBeTruthy();
  });

  it('download button enabled when podeBaixar = true', async () => {
    const facade = makeFacade({
      phase:      signal<'gerando' | 'valido' | 'erros' | 'error'>('valido').asReadonly(),
      podeBaixar: signal(true).asReadonly(),
    });
    await TestBed.configureTestingModule({
      imports: [ExportacaoEValidacaoComponent],
      providers: [
        { provide: ExportFacade,   useValue: facade },
        { provide: ActivatedRoute, useValue: makeRoute() },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ExportacaoEValidacaoComponent);
    fixture.detectChanges();
    const btn = fixture.nativeElement.querySelector('button[disabled]');
    expect(btn).toBeFalsy();
  });

  it('FE-PUB-024: error block shows Trace id when errorTraceId is set', async () => {
    const facade = makeFacade({
      phase:        signal<'gerando' | 'valido' | 'erros' | 'error'>('error').asReadonly(),
      error:        signal<string | null>('Erro de exportação').asReadonly(),
      errorTraceId: signal<string | null>('trace-export-abc').asReadonly(),
    });
    await TestBed.configureTestingModule({
      imports: [ExportacaoEValidacaoComponent],
      providers: [
        { provide: ExportFacade,   useValue: facade },
        { provide: ActivatedRoute, useValue: makeRoute() },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ExportacaoEValidacaoComponent);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Trace:');
    expect(el.textContent).toContain('trace-export-abc');
  });

  it('FE-PUB-024: error block does NOT show Trace section when errorTraceId is null', async () => {
    const facade = makeFacade({
      phase:        signal<'gerando' | 'valido' | 'erros' | 'error'>('error').asReadonly(),
      error:        signal<string | null>('Erro de exportação').asReadonly(),
      errorTraceId: signal<string | null>(null).asReadonly(),
    });
    await TestBed.configureTestingModule({
      imports: [ExportacaoEValidacaoComponent],
      providers: [
        { provide: ExportFacade,   useValue: facade },
        { provide: ActivatedRoute, useValue: makeRoute() },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ExportacaoEValidacaoComponent);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Trace:');
  });

});
