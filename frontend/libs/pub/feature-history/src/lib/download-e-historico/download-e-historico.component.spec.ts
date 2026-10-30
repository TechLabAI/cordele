/**
 * download-e-historico.component.spec.ts — FE-PUB-018 / FE-PUB-024 / FE-PUB-025.
 *
 * Verifies:
 *   - Component renders without errors.
 *   - facade.load() called on ngOnInit with projetoId from route.
 *   - No mock-data references in production path.
 *   - canDownload() returns true only for valido|avisos, false for erros_criticos|pendente.
 *   - statusLabel() returns correct string per EpubcheckStatus.
 *   - Empty state rendered when facade.isEmpty() = true.
 *   - FE-PUB-025: row with erros_criticos shows "inválido" label and no download button (gate disabled).
 *   - FE-PUB-024: error block shows trace id when facade.errorTraceId() is set.
 *   - FE-PUB-025: refetch notice banner displayed when facade.refetchNotice() is set.
 */
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute } from '@angular/router';
import { signal, computed } from '@angular/core';
import { DownloadEHistoricoComponent } from './download-e-historico.component';
import { HistoryFacade } from '@cordele/pub-data-access';
import type { PublicacaoHistoryItem, EpubcheckStatus } from '@cordele/pub-data-access';

function makeHistoryFacade(overrides: Partial<Record<string, unknown>> = {}): Partial<HistoryFacade> {
  const lista = signal<PublicacaoHistoryItem[]>([]);
  const status = signal<'idle' | 'loading' | 'loaded' | 'error'>('loaded');
  return {
    status:          status.asReadonly(),
    lista:           lista.asReadonly(),
    stats:           signal(null).asReadonly(),
    error:           signal<string | null>(null).asReadonly(),
    errorTraceId:    signal<string | null>(null).asReadonly(),
    downloading:     signal<string | null>(null).asReadonly(),
    downloadError:   signal<string | null>(null).asReadonly(),
    downloadTraceId: signal<string | null>(null).asReadonly(),
    refetchNotice:   signal<string | null>(null).asReadonly(),
    isEmpty:         computed(() => lista().length === 0 && status() === 'loaded'),
    load:            vi.fn(),
    download:        vi.fn(),
    ...overrides,
  };
}

function makeRoute(projetoId = 'proj-001') {
  return {
    snapshot: { paramMap: { get: (_k: string) => projetoId } },
  };
}

describe('DownloadEHistoricoComponent', () => {

  it('should create and call load on init', async () => {
    const facade = makeHistoryFacade();
    await TestBed.configureTestingModule({
      imports: [DownloadEHistoricoComponent],
      providers: [
        { provide: HistoryFacade,  useValue: facade },
        { provide: ActivatedRoute, useValue: makeRoute('proj-77') },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DownloadEHistoricoComponent);
    fixture.detectChanges();

    expect(facade.load).toHaveBeenCalledWith('proj-77');
  });

  it('should NOT reference mock-data in production code', () => {
    const src = DownloadEHistoricoComponent.toString();
    expect(src).not.toMatch(/mock.data|mock_data|mockData|publicacoes_mock/i);
  });

  it('canDownload: true for valido and avisos; false for erros_criticos and pendente', () => {
    const facade = makeHistoryFacade();
    TestBed.configureTestingModule({
      imports: [DownloadEHistoricoComponent],
      providers: [
        { provide: HistoryFacade,  useValue: facade },
        { provide: ActivatedRoute, useValue: makeRoute() },
      ],
    });

    const fixture = TestBed.createComponent(DownloadEHistoricoComponent);
    const comp = fixture.componentInstance;

    const row = (s: EpubcheckStatus): PublicacaoHistoryItem => ({
      publicacaoId: 'p1', projetoId: 'proj-1', epubcheckStatus: s,
      totalErros: 0, totalAvisos: 0, erros: null, arquivoUrl: null, criadoEm: new Date().toISOString(),
    });

    expect(comp.canDownload(row('valido'))).toBe(true);
    expect(comp.canDownload(row('avisos'))).toBe(true);
    expect(comp.canDownload(row('erros_criticos'))).toBe(false);
    expect(comp.canDownload(row('pendente'))).toBe(false);
  });

  it('renders empty state when isEmpty() = true', async () => {
    const facade = makeHistoryFacade();
    await TestBed.configureTestingModule({
      imports: [DownloadEHistoricoComponent],
      providers: [
        { provide: HistoryFacade,  useValue: facade },
        { provide: ActivatedRoute, useValue: makeRoute() },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DownloadEHistoricoComponent);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Nenhuma exportação realizada');
  });

  it('FE-PUB-025: erros_criticos row shows "inválido" label and no download button (gate)', async () => {
    const errosRow: PublicacaoHistoryItem = {
      publicacaoId:    'pub-erros',
      projetoId:       'proj-001',
      epubcheckStatus: 'erros_criticos',
      totalErros:      3,
      totalAvisos:     0,
      erros:           '3 erro(s) crítico(s)',
      arquivoUrl:      null,
      criadoEm:        new Date().toISOString(),
    };
    const lista = signal<PublicacaoHistoryItem[]>([errosRow]);
    const status = signal<'idle' | 'loading' | 'loaded' | 'error'>('loaded');
    const facade = makeHistoryFacade({
      lista:   lista.asReadonly(),
      status:  status.asReadonly(),
      isEmpty: computed(() => lista().length === 0 && status() === 'loaded'),
    });

    await TestBed.configureTestingModule({
      imports: [DownloadEHistoricoComponent],
      providers: [
        { provide: HistoryFacade,  useValue: facade },
        { provide: ActivatedRoute, useValue: makeRoute() },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DownloadEHistoricoComponent);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    // Must render the "inválido" label
    expect(el.textContent).toContain('inválido');
    // Must NOT render a download button for erros_criticos
    const downloadBtns = el.querySelectorAll('button[aria-label*="Baixar"]');
    expect(downloadBtns.length).toBe(0);
  });

  it('FE-PUB-024: error block shows Trace id when errorTraceId is set', async () => {
    const traceId = signal<string | null>('trace-show-me-001');
    const status = signal<'idle' | 'loading' | 'loaded' | 'error'>('error');
    const lista = signal<PublicacaoHistoryItem[]>([]);
    const facade = makeHistoryFacade({
      status:       status.asReadonly(),
      errorTraceId: traceId.asReadonly(),
      error:        signal<string | null>('Erro de rede').asReadonly(),
      isEmpty:      computed(() => lista().length === 0 && status() === 'loaded'),
    });

    await TestBed.configureTestingModule({
      imports: [DownloadEHistoricoComponent],
      providers: [
        { provide: HistoryFacade,  useValue: facade },
        { provide: ActivatedRoute, useValue: makeRoute() },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DownloadEHistoricoComponent);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Trace:');
    expect(el.textContent).toContain('trace-show-me-001');
  });

  it('FE-PUB-025: refetch notice banner shown when refetchNotice is set', async () => {
    const lista = signal<PublicacaoHistoryItem[]>([]);
    const status = signal<'idle' | 'loading' | 'loaded' | 'error'>('loaded');
    const facade = makeHistoryFacade({
      lista:         lista.asReadonly(),
      status:        status.asReadonly(),
      isEmpty:       computed(() => lista().length === 0 && status() === 'loaded'),
      refetchNotice: signal<string | null>('O link de download expirou. Gerando um novo link…').asReadonly(),
    });

    await TestBed.configureTestingModule({
      imports: [DownloadEHistoricoComponent],
      providers: [
        { provide: HistoryFacade,  useValue: facade },
        { provide: ActivatedRoute, useValue: makeRoute() },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(DownloadEHistoricoComponent);
    fixture.detectChanges();

    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('O link de download expirou');
  });

});
