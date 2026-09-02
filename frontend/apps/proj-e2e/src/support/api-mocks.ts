/**
 * api-mocks.ts — Playwright route-mock factories for PROJ E2E tests.
 *
 * All PROJ API endpoints mocked via `page.route().fulfill()`.
 * Pattern adapted from apps/comp-e2e/src/support/api-mocks.ts.
 *
 * Endpoints covered:
 *   GET  /api/proj/projetos                              (listProjetos — T02)
 *   GET  /api/proj/projetos/:id                          (getProjeto — T08 header)
 *   GET  /api/proj/projetos/:id/publicacoes              (listPublicacoes — T08 rows)
 *   GET  /api/proj/projetos/:id/publicacoes/:pid/download (resolveDownloadUrl)
 *   POST /api/proj/projetos/:id/reopen                   (reopenProjeto)
 *
 * FE-PROJ-024 / FE-PROJ-025 (P3 E2E gate).
 */
import { Page, Route } from '@playwright/test';

// ── Fixtures ─────────────────────────────────────────────────────────────────

export const PROJETO_ID   = 'a1b2c3d4-1234-5678-9abc-def012345678';
export const PUBLICACAO_ID = 'b2c3d4e5-2345-6789-abcd-ef0123456789';
export const BASE_PROJ     = `/proj/projetos/${PROJETO_ID}`;

/** ProjetoCard fixture (api-contract §6.2) */
export const PROJETO_CARD_FIXTURE = {
  id:                    PROJETO_ID,
  nome:                  'Livro de Testes E2E',
  autor:                 'Autor Teste',
  status:                'publicado',
  totalCapitulos:        5,
  totalImagens:          2,
  ultimoEpubcheckStatus: 'valido',
  ultimaAtividadeEm:     '2026-01-15T10:00:00.000Z',
  criadoEm:              '2026-01-01T08:00:00.000Z',
};

/** ProjetoDetail fixture (api-contract §6.1) */
export const PROJETO_DETAIL_FIXTURE = {
  id:          PROJETO_ID,
  editoraId:   'emp_aetos',
  nome:        'Livro de Testes E2E',
  descricao:   null,
  status:      'publicado',
  criadoEm:    '2026-01-01T08:00:00.000Z',
  atualizadoEm:'2026-01-15T10:00:00.000Z',
  manuscriptSummary: {
    manuscritoId:       'mss-001',
    nomeArquivo:        'manuscrito.docx',
    formato:            'docx',
    totalCapitulos:     5,
    totalImagens:       2,
    trechosNaoParseados: 0,
    criadoEm:           '2026-01-01T08:00:00.000Z',
  },
  metadata:           { autor: 'Autor Teste' },
  publicationHistory: [],
  degraded:           false,
};

/** PublicacaoHistoryItem[] fixture (api-contract §6.3) */
export const PUBLICACOES_FIXTURE = [
  {
    publicacaoId:    PUBLICACAO_ID,
    projetoId:       PROJETO_ID,
    epubcheckStatus: 'valido',
    totalErros:      0,
    totalAvisos:     0,
    erros:           null,
    arquivoUrl:      `/api/proj/projetos/${PROJETO_ID}/publicacoes/${PUBLICACAO_ID}/epub`,
    criadoEm:        '2026-01-15T10:00:00.000Z',
  },
];

// ── URL builders ─────────────────────────────────────────────────────────────

const listProjetosUrl    = ()          => '**/api/proj/projetos';
const getProjetoUrl      = (id = PROJETO_ID) => `**/api/proj/projetos/${id}`;
const listPublicacoesUrl = (id = PROJETO_ID) => `**/api/proj/projetos/${id}/publicacoes`;
const reopenUrl          = (id = PROJETO_ID) => `**/api/proj/projetos/${id}/reopen`;

// ── Route helpers ─────────────────────────────────────────────────────────────

type HttpStatus = 200 | 201 | 400 | 401 | 403 | 404 | 409 | 500;

function json(route: Route, data: unknown, status: HttpStatus = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body:        JSON.stringify(data),
  });
}

function errorBody(code: string, message: string, correlationId = 'corr-proj-test-001') {
  return { code, message, correlationId };
}

// ── List projetos mocks (T02) ─────────────────────────────────────────────────

/**
 * Mock GET /api/proj/projetos.
 * @param cards - Array of ProjetoCard objects to return (default: one card fixture)
 */
export async function mockListProjetos(
  page: Page,
  cards: unknown[] = [PROJETO_CARD_FIXTURE],
  status: HttpStatus = 200,
): Promise<void> {
  await page.route(listProjetosUrl(), async (route) => {
    if (route.request().method() === 'GET') {
      await json(route, cards, status);
    } else {
      await route.continue();
    }
  });
}

export async function mockListProjetosEmpty(page: Page): Promise<void> {
  await mockListProjetos(page, [], 200);
}

export async function mockListProjetosError(page: Page, status: HttpStatus = 500): Promise<void> {
  await page.route(listProjetosUrl(), async (route) => {
    await json(route, errorBody('urn:cordele:proj:internal', 'Erro interno ao listar projetos.'), status);
  });
}

// ── Get projeto mocks (T08) ───────────────────────────────────────────────────

/**
 * Mock GET /api/proj/projetos/:id.
 */
export async function mockGetProjeto(
  page: Page,
  detail: unknown = PROJETO_DETAIL_FIXTURE,
  status: HttpStatus = 200,
  projetoId = PROJETO_ID,
): Promise<void> {
  await page.route(getProjetoUrl(projetoId), async (route) => {
    if (route.request().method() === 'GET') {
      await json(route, detail, status);
    } else {
      await route.continue();
    }
  });
}

export async function mockGetProjetoNotFound(page: Page, projetoId = PROJETO_ID): Promise<void> {
  await page.route(getProjetoUrl(projetoId), async (route) => {
    await json(route, errorBody('urn:cordele:proj:not-found', 'Projeto não encontrado.'), 404);
  });
}

// ── List publicacoes mocks (T08) ──────────────────────────────────────────────

/**
 * Mock GET /api/proj/projetos/:id/publicacoes.
 */
export async function mockListPublicacoes(
  page: Page,
  pubs: unknown[] = PUBLICACOES_FIXTURE,
  status: HttpStatus = 200,
  projetoId = PROJETO_ID,
): Promise<void> {
  await page.route(listPublicacoesUrl(projetoId), async (route) => {
    if (route.request().method() === 'GET') {
      await json(route, pubs, status);
    } else {
      await route.continue();
    }
  });
}

// ── Reopen mock ───────────────────────────────────────────────────────────────

export async function mockReopen(
  page: Page,
  status: HttpStatus = 200,
  projetoId = PROJETO_ID,
): Promise<void> {
  await page.route(reopenUrl(projetoId), async (route) => {
    if (route.request().method() === 'POST') {
      if (status === 200) {
        await json(route, { ...PROJETO_DETAIL_FIXTURE, status: 'em_composicao' }, 200);
      } else if (status === 409) {
        await json(route, errorBody('urn:cordele:proj:illegal-reopen', 'Projeto em rascunho.'), 409);
      } else {
        await json(route, errorBody('urn:cordele:proj:internal', 'Erro interno.'), status);
      }
    } else {
      await route.continue();
    }
  });
}

// ── Combined "happy path" setup helpers ───────────────────────────────────────

/**
 * Wire all mocks needed for a successful T02 (Biblioteca de Projetos) navigation.
 * Returns 1 card with status=publicado, epubcheckStatus=valido.
 */
export async function mockT02HappyPath(page: Page): Promise<void> {
  await mockListProjetos(page, [PROJETO_CARD_FIXTURE]);
}

/**
 * Wire all mocks needed for a successful T08 (Download e Histórico) navigation.
 * Returns project detail + 1 publicacao row.
 */
export async function mockT08HappyPath(page: Page, projetoId = PROJETO_ID): Promise<void> {
  await mockGetProjeto(page, PROJETO_DETAIL_FIXTURE, 200, projetoId);
  await mockListPublicacoes(page, PUBLICACOES_FIXTURE, 200, projetoId);
}
