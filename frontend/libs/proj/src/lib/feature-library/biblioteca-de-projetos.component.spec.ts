/**
 * biblioteca-de-projetos.component.spec.ts — smoke tests for BibliotecaDeProjetosComponent.
 * FE-PROJ-017 (P1): instantiation, loading state rendering, empty state rendering.
 *
 * Contract change (api-contract §4.2, 2026-09):
 *   Mock facade updated with hasMore, loadMore, and degraded signal.
 *   New test: degraded notice renders when degraded()=true.
 *   New test: "Carregar mais" button renders when hasMore()=true.
 *
 * Pattern: component created directly in TestBed; LibraryFacade mocked via
 * { provide: LibraryFacade, useValue: mockFacade } — signal-compatible mocks.
 */
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BibliotecaDeProjetosComponent } from './biblioteca-de-projetos.component';
import { LibraryFacade } from '../library.facade';
import type { LibraryStatus } from '../library.facade';

// ── Mock factory ──────────────────────────────────────────────────────────────

function makeMockFacade(
  statusVal: LibraryStatus,
  opts: { isEmpty?: boolean; degraded?: boolean; hasMore?: boolean } = {},
) {
  const _status  = signal<LibraryStatus>(statusVal);
  const _isEmpty = signal(opts.isEmpty ?? false);
  return {
    status:      _status.asReadonly(),
    isEmpty:     _isEmpty.asReadonly(),
    projects:    signal([]).asReadonly(),
    degraded:    signal(opts.degraded ?? false).asReadonly(),
    empresaNome: signal('').asReadonly(),
    error:       signal<string | null>(null).asReadonly(),
    hasMore:     signal(opts.hasMore ?? false).asReadonly(),
    load:            vi.fn(),
    retry:           vi.fn(),
    loadMore:        vi.fn(),
    onOpen:          vi.fn(),
    onQuickDownload: vi.fn().mockResolvedValue(undefined),
    onNewProject:    vi.fn(),
  };
}

// ── Specs ─────────────────────────────────────────────────────────────────────

describe('BibliotecaDeProjetosComponent — smoke', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      imports:   [BibliotecaDeProjetosComponent],
      providers: [provideRouter([])],
    });
  });

  it('instancia sem erros com status=loading; load() é chamado no ngOnInit', () => {
    const mockFacade = makeMockFacade('loading');
    TestBed.overrideProvider(LibraryFacade, { useValue: mockFacade });
    const fixture = TestBed.createComponent(BibliotecaDeProjetosComponent);
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(mockFacade.load).toHaveBeenCalledOnce();
  });
});

describe('BibliotecaDeProjetosComponent — loading state', () => {
  it('renderiza skeletons de loading quando status="loading"', () => {
    const mockFacade = makeMockFacade('loading');
    TestBed.configureTestingModule({
      imports:   [BibliotecaDeProjetosComponent],
      providers: [
        provideRouter([]),
        { provide: LibraryFacade, useValue: mockFacade },
      ],
    });
    const fixture = TestBed.createComponent(BibliotecaDeProjetosComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    const skeletons = el.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe('BibliotecaDeProjetosComponent — empty state', () => {
  it('renderiza "Nenhum projeto ainda" quando isEmpty()=true', () => {
    const mockFacade = makeMockFacade('ready', { isEmpty: true });
    TestBed.configureTestingModule({
      imports:   [BibliotecaDeProjetosComponent],
      providers: [
        provideRouter([]),
        { provide: LibraryFacade, useValue: mockFacade },
      ],
    });
    const fixture = TestBed.createComponent(BibliotecaDeProjetosComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Nenhum projeto ainda');
  });
});

describe('BibliotecaDeProjetosComponent — degraded notice', () => {
  it('renderiza aviso de dados parciais quando degraded()=true', () => {
    const mockFacade = makeMockFacade('ready', { degraded: true });
    TestBed.configureTestingModule({
      imports:   [BibliotecaDeProjetosComponent],
      providers: [
        provideRouter([]),
        { provide: LibraryFacade, useValue: mockFacade },
      ],
    });
    const fixture = TestBed.createComponent(BibliotecaDeProjetosComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('dados de agregação');
  });

  it('não renderiza aviso de dados parciais quando degraded()=false', () => {
    const mockFacade = makeMockFacade('ready', { degraded: false });
    TestBed.configureTestingModule({
      imports:   [BibliotecaDeProjetosComponent],
      providers: [
        provideRouter([]),
        { provide: LibraryFacade, useValue: mockFacade },
      ],
    });
    const fixture = TestBed.createComponent(BibliotecaDeProjetosComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('dados de agregação');
  });
});

describe('BibliotecaDeProjetosComponent — load more button', () => {
  it('renderiza botão "Carregar mais" quando hasMore()=true e status=ready', () => {
    const mockFacade = makeMockFacade('ready', { hasMore: true });
    TestBed.configureTestingModule({
      imports:   [BibliotecaDeProjetosComponent],
      providers: [
        provideRouter([]),
        { provide: LibraryFacade, useValue: mockFacade },
      ],
    });
    const fixture = TestBed.createComponent(BibliotecaDeProjetosComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Carregar mais');
  });

  it('chama loadMore() ao clicar no botão "Carregar mais"', () => {
    const mockFacade = makeMockFacade('ready', { hasMore: true });
    TestBed.configureTestingModule({
      imports:   [BibliotecaDeProjetosComponent],
      providers: [
        provideRouter([]),
        { provide: LibraryFacade, useValue: mockFacade },
      ],
    });
    const fixture = TestBed.createComponent(BibliotecaDeProjetosComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    // Find the "Carregar mais" button specifically
    const allBtns = Array.from(el.querySelectorAll('button'));
    const loadMoreBtn = allBtns.find(b => b.textContent?.includes('Carregar mais'));
    loadMoreBtn?.click();
    expect(mockFacade.loadMore).toHaveBeenCalledOnce();
  });

  it('não renderiza botão "Carregar mais" quando hasMore()=false', () => {
    const mockFacade = makeMockFacade('ready', { hasMore: false });
    TestBed.configureTestingModule({
      imports:   [BibliotecaDeProjetosComponent],
      providers: [
        provideRouter([]),
        { provide: LibraryFacade, useValue: mockFacade },
      ],
    });
    const fixture = TestBed.createComponent(BibliotecaDeProjetosComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).not.toContain('Carregar mais');
  });
});
