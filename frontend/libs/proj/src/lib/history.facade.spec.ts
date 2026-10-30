/**
 * history.facade.spec.ts — unit tests for HistoryFacade state machine.
 * FE-PROJ-017 (P1): load states, degraded, pessimistic reopen, 409, onBack.
 * FE-PROJ-007 (P2): updated to mock ProjetoApiService (replaces PROJETO_PORT / PUBLICACAO_PORT).
 *
 * Pattern: TestBed with mocked ProjetoApiService (no HTTP).
 * Covers api-contract §4.3 (degraded) and SPEC-03 §2 (reopen pessimistic).
 * Errors from ProjetoApiService carry httpStatus (AppError shape from mapProblemDetailToAppError).
 */
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { HistoryFacade } from './history.facade';
import { ProjetoApiService } from './api/projeto-api.service';
import type { ProjetoDetail, PublicacaoHistoryItem } from './models/proj.models';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const PROJETO_ID = '123e4567-e89b-12d3-a456-426614174000';

const DETAIL_OK: ProjetoDetail = {
  id: PROJETO_ID,
  editoraId: 'emp-aetos',
  nome: 'O Livro',
  descricao: null,
  status: 'publicado',
  criadoEm: '2024-01-01T00:00:00Z',
  atualizadoEm: '2024-06-01T00:00:00Z',
  manuscriptSummary: null,
  metadata: { autor: 'Autora' },
  publicationHistory: [],
  degraded: false,
};

const PUB_ITEM: PublicacaoHistoryItem = {
  publicacaoId: 'pub-001',
  projetoId: PROJETO_ID,
  epubcheckStatus: 'valido',
  totalErros: 0,
  totalAvisos: 0,
  erros: null,
  arquivoUrl: 'https://cdn.example.com/book.epub',
  criadoEm: '2024-06-01T10:00:00Z',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRouter(): { navigate: ReturnType<typeof vi.fn> } {
  return { navigate: vi.fn().mockResolvedValue(true) };
}

function makeApiService(overrides: Partial<ProjetoApiService> = {}): Partial<ProjetoApiService> {
  return {
    getProjeto:         vi.fn().mockReturnValue(of(DETAIL_OK)),
    listPublicacoes:    vi.fn().mockReturnValue(of([PUB_ITEM])),
    reopenProjeto:      vi.fn().mockReturnValue(of({ ...DETAIL_OK, status: 'em_composicao' as const })),
    resolveDownloadUrl: vi.fn().mockReturnValue(of({ publicacaoId: 'pub-001', arquivoUrl: 'https://cdn.example.com/signed.epub', expiresAt: '2024-12-31T23:59:59Z' })),
    ...overrides,
  };
}

function setup(
  apiService: Partial<ProjetoApiService>,
  router: ReturnType<typeof makeRouter>,
): HistoryFacade {
  TestBed.configureTestingModule({
    providers: [
      HistoryFacade,
      { provide: ProjetoApiService, useValue: apiService },
      { provide: Router,            useValue: router },
    ],
  });
  return TestBed.inject(HistoryFacade);
}

// ── load: status 'ready' ──────────────────────────────────────────────────────

describe('HistoryFacade — load: detail + publicações OK → status ready', () => {
  let facade: HistoryFacade;

  beforeEach(() => {
    facade = setup(makeApiService(), makeRouter());
  });

  it('status() é "ready" após detail e publicações carregarem', () => {
    facade.load(PROJETO_ID);
    TestBed.flushEffects();
    expect(facade.status()).toBe('ready');
  });

  it('header() não é nulo após load bem-sucedido', () => {
    facade.load(PROJETO_ID);
    TestBed.flushEffects();
    expect(facade.header()).not.toBeNull();
    expect(facade.header()?.nome).toBe('O Livro');
  });

  it('publications() tem 1 item após publicações carregarem', () => {
    facade.load(PROJETO_ID);
    TestBed.flushEffects();
    expect(facade.publications().length).toBe(1);
  });
});

// ── load: 404 → status 'not-found' ───────────────────────────────────────────

describe('HistoryFacade — load: 404 → status not-found', () => {
  let facade: HistoryFacade;

  beforeEach(() => {
    // AppError from mapProblemDetailToAppError carries httpStatus (not status)
    const api = makeApiService({
      getProjeto: vi.fn().mockReturnValue(throwError(() => ({ httpStatus: 404, message: 'Not Found' }))),
    });
    facade = setup(api, makeRouter());
  });

  it('status() é "not-found" quando getProjeto lança erro com httpStatus 404', () => {
    facade.load(PROJETO_ID);
    TestBed.flushEffects();
    expect(facade.status()).toBe('not-found');
  });
});

// ── load: publicações falham → degraded ──────────────────────────────────────

describe('HistoryFacade — load: publicações falham → degraded (api-contract §4.3)', () => {
  let facade: HistoryFacade;

  beforeEach(() => {
    const api = makeApiService({
      listPublicacoes: vi.fn().mockReturnValue(throwError(() => ({ httpStatus: 503, message: 'Service unavailable' }))),
    });
    facade = setup(api, makeRouter());
  });

  it('degraded() é true quando listPublicacoes falha', () => {
    facade.load(PROJETO_ID);
    TestBed.flushEffects();
    expect(facade.degraded()).toBe(true);
  });

  it('status() permanece "ready" quando publicacoes falham (degraded — api-contract §4.3)', () => {
    facade.load(PROJETO_ID);
    TestBed.flushEffects();
    expect(facade.status()).toBe('ready');
  });
});

// ── onReopen: pesimista 200 ───────────────────────────────────────────────────

describe('HistoryFacade — onReopen: 200 → navega para /comp', () => {
  let facade: HistoryFacade;
  let router: ReturnType<typeof makeRouter>;

  beforeEach(() => {
    router = makeRouter();
    facade = setup(makeApiService(), router);
    facade.load(PROJETO_ID);
    TestBed.flushEffects();
  });

  it('navega para /comp após reopen bem-sucedido', async () => {
    await facade.onReopen('metadata');
    TestBed.flushEffects();
    expect(router.navigate).toHaveBeenCalledWith(['/comp']);
  });

  it('reopenPending() é false após reopen bem-sucedido', async () => {
    await facade.onReopen('metadata');
    TestBed.flushEffects();
    expect(facade.reopenPending()).toBe(false);
  });
});

// ── onReopen: 409 → reopenError ──────────────────────────────────────────────

describe('HistoryFacade — onReopen: 409 → reopenError (projeto em rascunho)', () => {
  let facade: HistoryFacade;
  let router: ReturnType<typeof makeRouter>;

  beforeEach(() => {
    router = makeRouter();
    const api = makeApiService({
      // AppError with httpStatus=409 from mapProblemDetailToAppError
      reopenProjeto: vi.fn().mockReturnValue(throwError(() => ({ httpStatus: 409, message: 'Conflict' }))),
    });
    facade = setup(api, router);
    facade.load(PROJETO_ID);
    TestBed.flushEffects();
  });

  it('reopenError() não é nulo após 409', async () => {
    await facade.onReopen('metadata');
    TestBed.flushEffects();
    expect(facade.reopenError()).not.toBeNull();
  });

  it('reopenPending() volta a false após 409', async () => {
    await facade.onReopen('metadata');
    TestBed.flushEffects();
    expect(facade.reopenPending()).toBe(false);
  });

  it('router.navigate NÃO é chamado após 409', async () => {
    await facade.onReopen('metadata');
    TestBed.flushEffects();
    expect(router.navigate).not.toHaveBeenCalled();
  });
});

// ── onBack ────────────────────────────────────────────────────────────────────

describe('HistoryFacade — onBack()', () => {
  it('navega para /proj/biblioteca-de-projetos', () => {
    const router = makeRouter();
    const facade = setup(makeApiService(), router);
    facade.onBack();
    expect(router.navigate).toHaveBeenCalledWith(['/proj', 'biblioteca-de-projetos']);
  });
});
