/**
 * biblioteca-de-projetos.component.spec.ts — smoke tests for BibliotecaDeProjetosComponent.
 * FE-PROJ-017 (P1): instantiation, loading state rendering, empty state rendering.
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

function makeMockFacade(statusVal: LibraryStatus, isEmptyVal = false) {
  const _status  = signal<LibraryStatus>(statusVal);
  const _isEmpty = signal(isEmptyVal);
  return {
    status:      _status.asReadonly(),
    isEmpty:     _isEmpty.asReadonly(),
    projects:    signal([]).asReadonly(),
    degraded:    signal(false).asReadonly(),
    empresaNome: signal('').asReadonly(),
    error:       signal<string | null>(null).asReadonly(),
    load:            vi.fn(),
    retry:           vi.fn(),
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
    // Template renders 4 animate-pulse skeleton divs inside a grid when loading
    const skeletons = el.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });
});

describe('BibliotecaDeProjetosComponent — empty state', () => {
  it('renderiza "Nenhum projeto ainda" quando isEmpty()=true', () => {
    // When facade.isEmpty() returns true, template renders the empty state block
    const mockFacade = makeMockFacade('ready', true);
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
