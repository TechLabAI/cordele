/**
 * api-mocks.ts — Playwright route-mock factories for PUB E2E tests.
 *
 * All PUB API endpoints use the versioned path /api/v1/pub/...
 * (moduleBase('pub') → '/api/v1/pub').
 * Do NOT use /api/pub/... — that path returns 404 (the bug this file is designed to prevent).
 *
 * Also includes proj-service mock for pubStatusGuard('export'):
 *   GET /api/v1/proj/projetos/{id} — must return {status:'em_composicao'} for the
 *   export route guard to pass.
 *
 * FE-PUB-027 / FE-PUB-028 (P9 E2E hardening).
 */
import { Page, Route } from '@playwright/test';

// ── Fixtures ──────────────────────────────────────────────────────────────────

export const PROJETO_ID     = 'a1b2c3d4-1234-5678-9abc-def012345678';
export const PUBLICACAO_ID  = 'b2c3d4e5-2345-6789-abcd-ef0123456789';
export const PUBLICACAO_ID2 = 'c3d4e5f6-3456-789a-bcde-f01234567890';

/** Base URL segment derived from the same constant as the adapter uses. */
const PUB_V1 = `/api/v1/pub`;
const PROJ_V1 = `/api/v1/proj`;

// ── URL builders — VERSIONED (use in page.route() globs) ──────────────────────
// All use ** prefix so the scheme+host doesn't need to be spelled out.

const triggerUrl   = (id = PROJETO_ID) => `**${PUB_V1}/projetos/${id}/publicacoes`;
const statusUrl    = (id = PROJETO_ID, pid = PUBLICACAO_ID) =>
  `**${PUB_V1}/projetos/${id}/publicacoes/${pid}/status`;
const listUrl      = (id = PROJETO_ID) => `**${PUB_V1}/projetos/${id}/publicacoes`;
const downloadUrl  = (id = PROJETO_ID, pid = PUBLICACAO_ID) =>
  `**${PUB_V1}/projetos/${id}/publicacoes/${pid}/download`;
const statsUrl     = (id = PROJETO_ID) => `**${PUB_V1}/projetos/${id}/publicacoes/stats`;
const projStatusUrl= (id = PROJETO_ID) => `**${PROJ_V1}/projetos/${id}`;

// ── Route helpers ─────────────────────────────────────────────────────────────

type HttpStatus = 200 | 201 | 202 | 400 | 401 | 403 | 404 | 409 | 422 | 500 | 502;

function json(route: Route, data: unknown, status: HttpStatus = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(data),
  });
}

function errorBody(code: string, message: string, correlationId = 'trace-pub-e2e-001') {
  return { code, message, correlationId };
}

/** Publicacao status fixture (gerando state). */
export const STATUS_GERANDO = {
  publicacaoId: PUBLICACAO_ID,
  projetoId: PROJETO_ID,
  status: 'gerando',
  epubcheckStatus: 'pendente',
  sequencia: 1,
  totalErros: 0,
  totalAvisos: 0,
  resumoErro: null,
  arquivoDisponivel: false,
  iniciadaEm: '2026-09-05T10:00:00.000Z',
  concluidaEm: null,
  tamanhoBytes: null,
  totalCapitulos: null,
  totalImagens: null,
};

/** Publicacao status fixture (publicado/valido state). */
export const STATUS_VALIDO = {
  ...STATUS_GERANDO,
  status: 'publicado',
  epubcheckStatus: 'valido',
  totalAvisos: 2,
  arquivoDisponivel: true,
  concluidaEm: '2026-09-05T10:00:05.000Z',
  tamanhoBytes: 1_456_000,
  totalCapitulos: 12,
  totalImagens: 8,
};

/** Publicacao status fixture (com_erros state). */
export const STATUS_ERROS = {
  ...STATUS_GERANDO,
  status: 'com_erros',
  epubcheckStatus: 'erros_criticos',
  totalErros: 3,
  arquivoDisponivel: false,
  concluidaEm: '2026-09-05T10:00:05.000Z',
  resumoErro: 'Estrutura EPUB inválida: 3 erros críticos detectados',
};

/** History list fixture. */
export const HISTORY_LIST = [
  {
    publicacaoId: PUBLICACAO_ID,
    projetoId: PROJETO_ID,
    epubcheckStatus: 'valido',
    totalErros: 0,
    totalAvisos: 2,
    erros: null,
    arquivoUrl: null,
    criadoEm: '2026-09-05T10:00:05.000Z',
  },
  {
    publicacaoId: PUBLICACAO_ID2,
    projetoId: PROJETO_ID,
    epubcheckStatus: 'erros_criticos',
    totalErros: 3,
    totalAvisos: 0,
    erros: 'Estrutura inválida',
    arquivoUrl: null,
    criadoEm: '2026-09-04T08:00:00.000Z',
  },
];

/** Stats fixture. */
export const STATS_FIXTURE = {
  total: 2,
  publicadas: 1,
  comAvisos: 1,
  comErros: 1,
};

// ── proj-service mock (for pubStatusGuard export mode) ────────────────────────

/**
 * Mock GET /api/v1/proj/projetos/{id} → {status: 'em_composicao'}.
 * REQUIRED for the export route to activate (pubStatusGuard('export') checks this).
 */
export async function mockProjStatus(
  page: Page,
  projetoId = PROJETO_ID,
  status = 'em_composicao',
): Promise<void> {
  await page.route(projStatusUrl(projetoId), async (route) => {
    if (route.request().method() === 'GET') {
      await json(route, { id: projetoId, status });
    } else {
      await route.continue();
    }
  });
}

// ── PUB trigger mocks ─────────────────────────────────────────────────────────

/**
 * Mock POST /api/v1/pub/projetos/{id}/publicacoes → 202 {publicacaoId, status:'gerando'}.
 * Simulates a fresh export trigger.
 */
export async function mockTriggerExport(
  page: Page,
  projetoId = PROJETO_ID,
  responseBody = STATUS_GERANDO,
): Promise<void> {
  await page.route(triggerUrl(projetoId), async (route) => {
    if (route.request().method() === 'POST') {
      await json(route, responseBody, 202);
    } else {
      await route.continue();
    }
  });
}

/**
 * Mock POST → 200 (idempotent — build already in-flight).
 */
export async function mockTriggerInFlight(
  page: Page,
  projetoId = PROJETO_ID,
): Promise<void> {
  await page.route(triggerUrl(projetoId), async (route) => {
    if (route.request().method() === 'POST') {
      await json(route, STATUS_GERANDO, 200);
    } else {
      await route.continue();
    }
  });
}

/**
 * Mock POST → error status.
 * Adds x-correlation-id response header so ExportFacade.extractTraceId() can
 * surface the correlationId via HttpErrorResponse.headers.get('x-correlation-id').
 * The body also carries correlationId (AppError normalisation pattern).
 */
export async function mockTriggerError(
  page: Page,
  httpStatus: HttpStatus,
  code: string,
  projetoId = PROJETO_ID,
): Promise<void> {
  const body = errorBody(code, `Erro: ${code}`);
  await page.route(triggerUrl(projetoId), async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: httpStatus,
        contentType: 'application/json',
        headers: { 'x-correlation-id': body.correlationId },
        body: JSON.stringify(body),
      });
    } else {
      await route.continue();
    }
  });
}

// ── PUB status poll mocks ─────────────────────────────────────────────────────

/**
 * Mock GET status — sequence of responses (one per call, last repeated).
 */
export async function mockPollStatus(
  page: Page,
  sequence: object[],
  projetoId = PROJETO_ID,
  publicacaoId = PUBLICACAO_ID,
): Promise<void> {
  let callCount = 0;
  await page.route(statusUrl(projetoId, publicacaoId), async (route) => {
    if (route.request().method() === 'GET') {
      const idx = Math.min(callCount, sequence.length - 1);
      callCount++;
      await json(route, sequence[idx], 200);
    } else {
      await route.continue();
    }
  });
}

/**
 * Mock GET status → network error (abort).
 */
export async function mockPollNetworkError(
  page: Page,
  projetoId = PROJETO_ID,
  publicacaoId = PUBLICACAO_ID,
): Promise<void> {
  await page.route(statusUrl(projetoId, publicacaoId), async (route) => {
    await route.abort('failed');
  });
}

// ── PUB history list mocks ────────────────────────────────────────────────────

/**
 * Mock GET /api/v1/pub/projetos/{id}/publicacoes → history list.
 */
export async function mockHistoryList(
  page: Page,
  items = HISTORY_LIST,
  projetoId = PROJETO_ID,
): Promise<void> {
  await page.route(listUrl(projetoId), async (route) => {
    if (route.request().method() === 'GET') {
      await json(route, items, 200);
    } else {
      await route.continue();
    }
  });
}

/**
 * Mock GET history list → error.
 */
export async function mockHistoryListError(
  page: Page,
  httpStatus: HttpStatus = 500,
  projetoId = PROJETO_ID,
): Promise<void> {
  await page.route(listUrl(projetoId), async (route) => {
    if (route.request().method() === 'GET') {
      await json(route, errorBody('urn:cordele:pub:internal', 'Erro interno'), httpStatus);
    } else {
      await route.continue();
    }
  });
}

// ── PUB stats mocks ───────────────────────────────────────────────────────────

export async function mockStats(
  page: Page,
  stats = STATS_FIXTURE,
  projetoId = PROJETO_ID,
): Promise<void> {
  await page.route(statsUrl(projetoId), async (route) => {
    if (route.request().method() === 'GET') {
      await json(route, stats);
    } else {
      await route.continue();
    }
  });
}

// ── PUB download mocks ────────────────────────────────────────────────────────

export async function mockSignedUrl(
  page: Page,
  signedUrl = 'https://storage.example.com/epub/signed-url',
  projetoId = PROJETO_ID,
  publicacaoId = PUBLICACAO_ID,
): Promise<void> {
  await page.route(downloadUrl(projetoId, publicacaoId), async (route) => {
    if (route.request().method() === 'GET') {
      await json(route, { url: signedUrl, expiresAt: '2026-09-05T11:00:00.000Z' });
    } else {
      await route.continue();
    }
  });
}

export async function mockSignedUrlExpired(
  page: Page,
  projetoId = PROJETO_ID,
  publicacaoId = PUBLICACAO_ID,
): Promise<void> {
  await page.route(downloadUrl(projetoId, publicacaoId), async (route) => {
    if (route.request().method() === 'GET') {
      await json(route, errorBody('urn:cordele:pub:signed-url-expired', 'URL expirada'), 401);
    } else {
      await route.continue();
    }
  });
}

export async function mockDownloadNotFound(
  page: Page,
  projetoId = PROJETO_ID,
  publicacaoId = PUBLICACAO_ID,
): Promise<void> {
  await page.route(downloadUrl(projetoId, publicacaoId), async (route) => {
    if (route.request().method() === 'GET') {
      await json(route, errorBody('urn:cordele:pub:artifact-not-found', 'Artefato indisponível'), 404);
    } else {
      await route.continue();
    }
  });
}

// ── Combined setup helpers ────────────────────────────────────────────────────

/**
 * Wire all mocks for the T07 export happy path.
 * Trigger → gerando → publicado (valido).
 */
export async function mockT07HappyPath(
  page: Page,
  projetoId = PROJETO_ID,
): Promise<void> {
  await mockProjStatus(page, projetoId);
  await mockTriggerExport(page, projetoId);
  await mockPollStatus(page, [STATUS_GERANDO, STATUS_VALIDO], projetoId);
}

/**
 * Wire all mocks for the T08 history happy path.
 */
export async function mockT08HappyPath(
  page: Page,
  projetoId = PROJETO_ID,
): Promise<void> {
  await mockHistoryList(page, HISTORY_LIST, projetoId);
  await mockStats(page, STATS_FIXTURE, projetoId);
}
