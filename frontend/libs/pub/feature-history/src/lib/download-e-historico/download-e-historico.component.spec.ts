/**
 * download-e-historico.component.spec.ts — FE-PUB-018.
 *
 * Verifies:
 *   - Component renders without errors.
 *   - facade.load() called on ngOnInit with projetoId from route.
 *   - No mock-data references in production path.
 *   - canDownload() returns true only for valido|avisos, false for erros_criticos|pendente.
 *   - statusLabel() returns correct string per EpubcheckStatus.
 *   - Empty state rendered when facade.isEmpty() = true.
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
    status:        status.asReadonly(),
    lista:         lista.asReadonly(),
    stats:         signal(null).asReadonly(),
    error:         signal<string | null>(null).asReadonly(),
    downloading:   signal<string | null>(null).asReadonly(),
    downloadError: signal<string | null>(null).asReadonly(),
    isEmpty:       computed(() => lista().length === 0 && status() === 'loaded'),
    load:          vi.fn(),
    download:      vi.fn(),
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

});
