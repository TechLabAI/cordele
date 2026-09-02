/**
 * download-e-historico.component.spec.ts — smoke tests for DownloadEHistoricoComponent.
 * FE-PROJ-017 (P1): instantiation with mocked HistoryFacade and ActivatedRoute.
 */
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { provideRouter } from '@angular/router';
import { vi, describe, it, expect } from 'vitest';
import { DownloadEHistoricoComponent } from './download-e-historico.component';
import { HistoryFacade } from '../history.facade';
import type { HistoryStatus } from '../history.facade';

// ── Mock factory ──────────────────────────────────────────────────────────────

function makeMockFacade(statusVal: HistoryStatus = 'loading') {
  const _status = signal<HistoryStatus>(statusVal);
  return {
    status:        _status.asReadonly(),
    header:        signal(null).asReadonly(),
    publications:  signal([]).asReadonly(),
    reopenPending: signal(false).asReadonly(),
    reopenError:   signal<string | null>(null).asReadonly(),
    degraded:      signal(false).asReadonly(),
    load:          vi.fn(),
    onReopen:      vi.fn().mockResolvedValue(undefined),
    onDownload:    vi.fn().mockResolvedValue(undefined),
    onNewExport:   vi.fn(),
    onBack:        vi.fn(),
  };
}

function makeActivatedRoute(projetoId: string | null = 'proj-001') {
  return {
    snapshot: {
      paramMap: {
        get: (key: string) => (key === 'projetoId' ? projetoId : null),
      },
    },
  };
}

// ── Specs ─────────────────────────────────────────────────────────────────────

describe('DownloadEHistoricoComponent — smoke', () => {
  it('instancia sem erros; load() é chamado com projetoId do paramMap', () => {
    const mockFacade = makeMockFacade('loading');
    const mockRoute  = makeActivatedRoute('abc-123');

    TestBed.configureTestingModule({
      imports:   [DownloadEHistoricoComponent],
      providers: [
        provideRouter([]),
        { provide: HistoryFacade,   useValue: mockFacade },
        { provide: ActivatedRoute, useValue: mockRoute },
      ],
    });

    const fixture = TestBed.createComponent(DownloadEHistoricoComponent);
    expect(() => fixture.detectChanges()).not.toThrow();
    expect(mockFacade.load).toHaveBeenCalledWith('abc-123');
  });

  it('renderiza estado de carregamento quando status="loading"', () => {
    const mockFacade = makeMockFacade('loading');
    const mockRoute  = makeActivatedRoute('proj-001');

    TestBed.configureTestingModule({
      imports:   [DownloadEHistoricoComponent],
      providers: [
        provideRouter([]),
        { provide: HistoryFacade,   useValue: mockFacade },
        { provide: ActivatedRoute, useValue: mockRoute },
      ],
    });

    const fixture = TestBed.createComponent(DownloadEHistoricoComponent);
    fixture.detectChanges();
    const el: HTMLElement = fixture.nativeElement;
    // Loading state renders animate-pulse skeleton
    expect(el.querySelector('.animate-pulse')).not.toBeNull();
  });
});
