/**
 * library.facade.spec.ts — unit tests for LibraryFacade state machine.
 * FE-PROJ-017 (P1): load states, computed canQuickDownload, navigation actions.
 * FE-PROJ-007 (P2): isEmpty fix, empresa-switch via ProjetoApiService.
 *
 * Pattern: TestBed with mocked ProjetoApiService and EmpresaContextService (no HTTP).
 * isEmpty() fix: status==='empty' (not 'ready' && cards.length===0 which was always false).
 */
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { LibraryFacade } from './library.facade';
import { ProjetoApiService } from './api/projeto-api.service';
import { EmpresaContextService } from '@cordele/shared/empresa-context';
import type { ProjetoCard, ProjetoCardVM } from './models/proj.models';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const CARD_VALIDO: ProjetoCard = {
  id: 'proj-001',
  nome: 'O Livro',
  autor: 'Autora',
  status: 'publicado',
  totalCapitulos: 3,
  totalImagens: 1,
  ultimoEpubcheckStatus: 'valido',
  ultimaAtividadeEm: '2024-06-01T12:00:00Z',
  criadoEm: '2024-01-01T00:00:00Z',
};

const CARD_RASCUNHO: ProjetoCard = {
  id: 'proj-002',
  nome: 'Outro Livro',
  autor: null,
  status: 'rascunho',
  totalCapitulos: 0,
  totalImagens: 0,
  ultimoEpubcheckStatus: null,
  ultimaAtividadeEm: '2024-06-02T08:00:00Z',
  criadoEm: '2024-02-01T00:00:00Z',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRouter(): { navigate: ReturnType<typeof vi.fn> } {
  return { navigate: vi.fn().mockResolvedValue(true) };
}

function makeApiService(overrides: Partial<ProjetoApiService> = {}): Partial<ProjetoApiService> {
  return {
    listProjetos:       vi.fn().mockReturnValue(of([CARD_VALIDO, CARD_RASCUNHO])),
    listPublicacoes:    vi.fn().mockReturnValue(of([])),
    resolveDownloadUrl: vi.fn().mockReturnValue(of({ publicacaoId: 'pub-1', arquivoUrl: 'https://cdn.example.com/file.epub', expiresAt: '2024-12-31T23:59:59Z' })),
    ...overrides,
  };
}

function makeEmpresaCtx(empresaId: string | null = 'emp-aetos'): Partial<EmpresaContextService> {
  return {
    current: signal<string | null>(empresaId) as EmpresaContextService['current'],
  };
}

function setup(
  apiService: Partial<ProjetoApiService>,
  router: ReturnType<typeof makeRouter>,
  empresaCtx: Partial<EmpresaContextService> = makeEmpresaCtx(),
): LibraryFacade {
  TestBed.configureTestingModule({
    providers: [
      LibraryFacade,
      { provide: ProjetoApiService,    useValue: apiService },
      { provide: EmpresaContextService, useValue: empresaCtx },
      { provide: Router,               useValue: router },
    ],
  });
  return TestBed.inject(LibraryFacade);
}

// ── load: status 'ready' ──────────────────────────────────────────────────────

describe('LibraryFacade — load: retorna 2 cards → status ready', () => {
  let facade: LibraryFacade;

  beforeEach(() => {
    facade = setup(makeApiService(), makeRouter());
  });

  it('status() é "ready" após carregar 2 cards', () => {
    facade.load();
    TestBed.flushEffects();
    expect(facade.status()).toBe('ready');
  });

  it('projects() tem 2 itens após carregar 2 cards', () => {
    facade.load();
    TestBed.flushEffects();
    expect(facade.projects().length).toBe(2);
  });
});

// ── load: status 'empty' + isEmpty() fix ─────────────────────────────────────

describe('LibraryFacade — load: retorna [] → status empty, isEmpty() true', () => {
  let facade: LibraryFacade;

  beforeEach(() => {
    const api = makeApiService({ listProjetos: vi.fn().mockReturnValue(of([])) });
    facade = setup(api, makeRouter());
  });

  it('status() é "empty" quando API retorna lista vazia', () => {
    facade.load();
    TestBed.flushEffects();
    expect(facade.status()).toBe('empty');
  });

  it('isEmpty() é true quando status="empty" (fix do bug isEmpty P2)', () => {
    facade.load();
    TestBed.flushEffects();
    // Bug fixado: anteriormente isEmpty() era 'ready' && cards===[], sempre false.
    // Agora isEmpty() === (status === 'empty').
    expect(facade.isEmpty()).toBe(true);
  });

  it('projects() é vazio quando API retorna lista vazia', () => {
    facade.load();
    TestBed.flushEffects();
    expect(facade.projects().length).toBe(0);
  });
});

// ── isEmpty() is false when status is 'ready' ─────────────────────────────────

describe('LibraryFacade — isEmpty() false quando status não é empty', () => {
  it('isEmpty() é false quando há cards (status=ready)', () => {
    const facade = setup(makeApiService(), makeRouter());
    facade.load();
    TestBed.flushEffects();
    expect(facade.status()).toBe('ready');
    expect(facade.isEmpty()).toBe(false);
  });

  it('isEmpty() é false antes de load() (status=loading)', () => {
    const facade = setup(makeApiService(), makeRouter());
    // Do NOT call load() — status stays 'loading'
    expect(facade.status()).toBe('loading');
    expect(facade.isEmpty()).toBe(false);
  });
});

// ── load: status 'error' ──────────────────────────────────────────────────────

describe('LibraryFacade — load: erro de rede → status error', () => {
  let facade: LibraryFacade;

  beforeEach(() => {
    const api = makeApiService({
      listProjetos: vi.fn().mockReturnValue(throwError(() => ({ httpStatus: 500, message: 'Erro interno' }))),
    });
    facade = setup(api, makeRouter());
  });

  it('status() é "error" quando API lança erro', () => {
    facade.load();
    TestBed.flushEffects();
    expect(facade.status()).toBe('error');
  });

  it('error() não é nulo após falha', () => {
    facade.load();
    TestBed.flushEffects();
    expect(facade.error()).not.toBeNull();
  });
});

// ── computed canQuickDownload ─────────────────────────────────────────────────

describe('LibraryFacade — computed: canQuickDownload', () => {
  it('canQuickDownload é true para card com ultimoEpubcheckStatus="valido"', () => {
    const api = makeApiService({ listProjetos: vi.fn().mockReturnValue(of([CARD_VALIDO])) });
    const facade = setup(api, makeRouter());
    facade.load();
    TestBed.flushEffects();
    expect(facade.projects()[0].canQuickDownload).toBe(true);
  });

  it('canQuickDownload é false para card sem epubcheck (null)', () => {
    const api = makeApiService({ listProjetos: vi.fn().mockReturnValue(of([CARD_RASCUNHO])) });
    const facade = setup(api, makeRouter());
    facade.load();
    TestBed.flushEffects();
    expect(facade.projects()[0].canQuickDownload).toBe(false);
  });
});

// ── onOpen routing ────────────────────────────────────────────────────────────

describe('LibraryFacade — onOpen() navega baseado em openTarget', () => {
  it('openTarget="imp" → navega para /imp/projetos/:id/importar', () => {
    const router = makeRouter();
    const facade = setup(makeApiService(), router);

    const card: ProjetoCardVM = {
      ...CARD_RASCUNHO,
      badge: { tone: 'draft', label: 'Rascunho', icon: 'edit_note' },
      canQuickDownload: false,
      openTarget: 'imp',
    };
    facade.onOpen(card);
    expect(router.navigate).toHaveBeenCalledWith(['/imp', 'projetos', CARD_RASCUNHO.id, 'importar']);
  });

  it('openTarget="history" → navega para /proj/projetos/:id/historico', () => {
    const router = makeRouter();
    const facade = setup(makeApiService(), router);

    const card: ProjetoCardVM = {
      ...CARD_VALIDO,
      badge: { tone: 'valid', label: 'Válido', icon: 'check_circle' },
      canQuickDownload: true,
      openTarget: 'history',
    };
    facade.onOpen(card);
    expect(router.navigate).toHaveBeenCalledWith(['/proj', 'projetos', CARD_VALIDO.id, 'historico']);
  });
});

// ── onNewProject ──────────────────────────────────────────────────────────────

describe('LibraryFacade — onNewProject()', () => {
  it('navega para /imp/upload', () => {
    const router = makeRouter();
    const facade = setup(makeApiService(), router);
    facade.onNewProject();
    expect(router.navigate).toHaveBeenCalledWith(['/imp', 'upload']);
  });
});

// ── empresa-switch (INT-FE-PROJ-002, P2) ─────────────────────────────────────

describe('LibraryFacade — empresa-switch: reload ao trocar empresa', () => {
  it('re-chama listProjetos() quando empresa muda após load() (switchMap cancela in-flight)', () => {
    const listProjetosSpy = vi.fn().mockReturnValue(of([CARD_VALIDO]));
    const api = makeApiService({ listProjetos: listProjetosSpy });

    // Use a writable signal for the empresa current value
    const currentSignal = signal<string | null>('emp-aetos');
    const empresaCtx: Partial<EmpresaContextService> = {
      current: currentSignal.asReadonly() as EmpresaContextService['current'],
    };

    const facade = setup(api, makeRouter(), empresaCtx);

    // Initial load
    facade.load();
    TestBed.flushEffects();
    expect(listProjetosSpy).toHaveBeenCalledTimes(1);

    // Switch empresa — constructor's toObservable + skip(1) + switchMap re-triggers
    currentSignal.set('emp-novo');
    TestBed.flushEffects();

    expect(listProjetosSpy).toHaveBeenCalledTimes(2);
  });
});
