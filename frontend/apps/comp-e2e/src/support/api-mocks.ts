/**
 * api-mocks.ts — Playwright route-mock factories for COMP E2E tests.
 *
 * All COMP API endpoints (and proj-service guard endpoint) mocked via
 * `page.route().fulfill()` as prescribed in the plan (P10, FE-COMP-026/027).
 *
 * Endpoints covered:
 *   GET  /api/comp/projetos/:id/metadados
 *   PUT  /api/comp/projetos/:id/metadados
 *   POST /api/comp/projetos/:id/capa
 *   DELETE /api/comp/projetos/:id/capa
 *   GET  /api/comp/projetos/:id/layout
 *   GET  /api/comp/projetos/:id/preview-context
 *   PUT  /api/comp/projetos/:id/layout
 *   GET  /api/proj/projetos/:id          (compStatusGuard)
 */
import { Page, Route } from '@playwright/test';

// ── Fixtures ─────────────────────────────────────────────────────────────────

export const PROJETO_ID = 'a1b2c3d4-1234-5678-9abc-def012345678';
export const BASE_COMP  = `/comp/projetos/${PROJETO_ID}`;

export const METADADOS_MATERIALIZED = {
  projetoId:  PROJETO_ID,
  materialized: true,
  titulo:     'Meu Livro de Testes',
  autor:      'João Silva',
  idioma:     'pt',
  isbn:       null,
  categoria:  null,
  capaUrl:    null,
};

export const METADADOS_NOT_MATERIALIZED = {
  projetoId:    PROJETO_ID,
  materialized: false,
  titulo:       '',
  autor:        '',
  idioma:       'pt',
  isbn:         null,
  categoria:    null,
  capaUrl:      null,
};

export const LAYOUT_MATERIALIZED = {
  projetoId:          PROJETO_ID,
  materialized:       true,
  fonteCorpoFamilia:  'Georgia',
  fonteCorpoTamanho:  14,
  espacamentoLinha:   1.5,
  margemLateral:      20,
  h1Tamanho:          32,
  h2Tamanho:          24,
  h3Tamanho:          18,
  overrides:          [],
};

export const LAYOUT_NOT_MATERIALIZED = {
  projetoId:          PROJETO_ID,
  materialized:       false,
  fonteCorpoFamilia:  'Georgia',
  fonteCorpoTamanho:  14,
  espacamentoLinha:   1.5,
  margemLateral:      20,
  h1Tamanho:          32,
  h2Tamanho:          24,
  h3Tamanho:          18,
  overrides:          [],
};

export const LAYOUT_WITH_STALE_OVERRIDE = {
  ...LAYOUT_MATERIALIZED,
  overrides: [
    { nodeRef: 'node-001', tipo: 'imagem', alinhamento: 'left', stale: true  },
    { nodeRef: 'node-002', tipo: 'imagem', alinhamento: 'right', stale: false },
  ],
};

export const PREVIEW_CONTEXT_ONE_PAGE = {
  projetoId: PROJETO_ID,
  paginas: [
    {
      tipo:   'conteudo',
      titulo: 'Capítulo 1',
      nodes:  [
        { nodeRef: 'node-001', tipo: 'paragrafo', texto: 'Lorem ipsum dolor sit amet.', stale: false },
      ],
    },
  ],
};

export const PREVIEW_CONTEXT_MULTI_PAGE = {
  projetoId: PROJETO_ID,
  paginas: [
    { tipo: 'conteudo', titulo: 'Capítulo 1', nodes: [{ nodeRef: 'n1', tipo: 'paragrafo', texto: 'Página 1', stale: false }] },
    { tipo: 'conteudo', titulo: 'Capítulo 2', nodes: [{ nodeRef: 'n2', tipo: 'paragrafo', texto: 'Página 2', stale: false }] },
  ],
};

export const PROJETO_EM_COMPOSICAO = { id: PROJETO_ID, status: 'em_composicao' };
export const PROJETO_RASCUNHO      = { id: PROJETO_ID, status: 'rascunho'       };
export const CAPA_UPLOAD_RESPONSE  = { capaUrl: '/api/static/capa/test.jpg'      };

// ── URL builders ─────────────────────────────────────────────────────────────

const metadadosUrl = (id = PROJETO_ID) => `**/api/comp/projetos/${id}/metadados`;
const capaUrl      = (id = PROJETO_ID) => `**/api/comp/projetos/${id}/capa`;
const layoutUrl    = (id = PROJETO_ID) => `**/api/comp/projetos/${id}/layout`;
const previewUrl   = (id = PROJETO_ID) => `**/api/comp/projetos/${id}/preview-context`;
const projStatusUrl = (id = PROJETO_ID) => `**/api/proj/projetos/${id}`;

// ── Route helpers ─────────────────────────────────────────────────────────────

type HttpStatus = 200 | 201 | 400 | 401 | 403 | 404 | 409 | 413 | 415 | 422 | 500;

function json(route: Route, data: unknown, status: HttpStatus = 200): Promise<void> {
  return route.fulfill({
    status,
    contentType: 'application/json',
    body:        JSON.stringify(data),
  });
}

function errorBody(code: string, message: string, correlationId = 'corr-test-001') {
  return { code, message, correlationId };
}

// ── Metadados mocks ───────────────────────────────────────────────────────────

export async function mockMetadadosGet(
  page: Page,
  response: unknown = METADADOS_MATERIALIZED,
  status: HttpStatus = 200,
  projetoId = PROJETO_ID,
): Promise<void> {
  await page.route(metadadosUrl(projetoId), async (route) => {
    if (route.request().method() === 'GET') {
      await json(route, response, status);
    } else {
      await route.continue();
    }
  });
}

export async function mockMetadadosPut(
  page: Page,
  response: unknown = METADADOS_MATERIALIZED,
  status: HttpStatus = 200,
  projetoId = PROJETO_ID,
): Promise<void> {
  await page.route(metadadosUrl(projetoId), async (route) => {
    if (route.request().method() === 'PUT') {
      await json(route, response, status);
    } else {
      await route.continue();
    }
  });
}

/** Mocks both GET and PUT for metadados in one call. */
export async function mockMetadados(
  page: Page,
  opts: {
    getStatus?: HttpStatus;
    putStatus?: HttpStatus;
    getBody?:   unknown;
    putBody?:   unknown;
    projetoId?: string;
  } = {},
): Promise<void> {
  const {
    getStatus = 200,
    putStatus = 200,
    getBody   = METADADOS_MATERIALIZED,
    putBody   = METADADOS_MATERIALIZED,
    projetoId = PROJETO_ID,
  } = opts;

  await page.route(metadadosUrl(projetoId), async (route) => {
    if (route.request().method() === 'GET') {
      await json(route, getBody, getStatus);
    } else if (route.request().method() === 'PUT') {
      await json(route, putBody, putStatus);
    } else {
      await route.continue();
    }
  });
}

export async function mockMetadadosForbidden(page: Page, projetoId = PROJETO_ID): Promise<void> {
  await page.route(metadadosUrl(projetoId), async (route) => {
    await json(route, errorBody('urn:cordele:comp:forbidden', 'Acesso negado.'), 403);
  });
}

export async function mockMetadadosNotFound(page: Page, projetoId = PROJETO_ID): Promise<void> {
  await page.route(metadadosUrl(projetoId), async (route) => {
    await json(route, errorBody('urn:cordele:comp:projeto-not-found', 'Projeto não encontrado.'), 404);
  });
}

export async function mockMetadadosServerError(page: Page, projetoId = PROJETO_ID): Promise<void> {
  await page.route(metadadosUrl(projetoId), async (route) => {
    await json(route, errorBody('urn:cordele:comp:internal', 'Erro interno.'), 500);
  });
}

// ── Capa mocks ────────────────────────────────────────────────────────────────

export async function mockCapaUpload(
  page: Page,
  status: HttpStatus = 200,
  projetoId = PROJETO_ID,
): Promise<void> {
  await page.route(capaUrl(projetoId), async (route) => {
    if (route.request().method() === 'POST') {
      if (status === 200) {
        await json(route, CAPA_UPLOAD_RESPONSE, 200);
      } else {
        await json(route, errorBody(`urn:cordele:comp:capa-${status}`, `Upload error ${status}.`), status);
      }
    } else {
      await route.continue();
    }
  });
}

export async function mockCapaRemove(
  page: Page,
  status: HttpStatus = 200,
  projetoId = PROJETO_ID,
): Promise<void> {
  await page.route(capaUrl(projetoId), async (route) => {
    if (route.request().method() === 'DELETE') {
      await route.fulfill({ status, body: '' });
    } else {
      await route.continue();
    }
  });
}

// ── Layout mocks ──────────────────────────────────────────────────────────────

export async function mockLayout(
  page: Page,
  opts: {
    getBody?:   unknown;
    getStatus?: HttpStatus;
    putStatus?: HttpStatus;
    putBody?:   unknown;
    projetoId?: string;
  } = {},
): Promise<void> {
  const {
    getBody   = LAYOUT_MATERIALIZED,
    getStatus = 200,
    putStatus = 200,
    putBody   = LAYOUT_MATERIALIZED,
    projetoId = PROJETO_ID,
  } = opts;

  await page.route(layoutUrl(projetoId), async (route) => {
    if (route.request().method() === 'GET') {
      await json(route, getBody, getStatus);
    } else if (route.request().method() === 'PUT') {
      await json(route, putBody, putStatus);
    } else {
      await route.continue();
    }
  });
}

// ── Preview context mocks ─────────────────────────────────────────────────────

export async function mockPreviewContext(
  page: Page,
  body: unknown = PREVIEW_CONTEXT_ONE_PAGE,
  status: HttpStatus = 200,
  projetoId = PROJETO_ID,
): Promise<void> {
  await page.route(previewUrl(projetoId), async (route) => {
    await json(route, body, status);
  });
}

/** Simulates 409 manuscript-missing (T06 empty state scenario). */
export async function mockPreviewContextManuscriptMissing(page: Page, projetoId = PROJETO_ID): Promise<void> {
  await page.route(previewUrl(projetoId), async (route) => {
    await json(
      route,
      errorBody('urn:cordele:comp:manuscript-missing', 'Manuscrito não encontrado.'),
      409,
    );
  });
}

/** Simulates 422 override-ref-not-found defensive toast. */
export async function mockPreviewContext422Override(page: Page, projetoId = PROJETO_ID): Promise<void> {
  await page.route(previewUrl(projetoId), async (route) => {
    await json(
      route,
      errorBody('urn:cordele:comp:override-ref-not-found', 'Override obsoleto detectado.'),
      422,
    );
  });
}

/** Simulates 422 structural-edit-deferred defensive toast. */
export async function mockPreviewContext422Structural(page: Page, projetoId = PROJETO_ID): Promise<void> {
  await page.route(previewUrl(projetoId), async (route) => {
    await json(
      route,
      errorBody('urn:cordele:comp:structural-edit-deferred', 'Edição estrutural adiada.'),
      422,
    );
  });
}

// ── Project status mock (compStatusGuard) ─────────────────────────────────────

export async function mockProjStatus(
  page: Page,
  body: unknown = PROJETO_EM_COMPOSICAO,
  status: HttpStatus = 200,
  projetoId = PROJETO_ID,
): Promise<void> {
  await page.route(projStatusUrl(projetoId), async (route) => {
    await json(route, body, status);
  });
}

// ── Combined "happy path" setup helpers ───────────────────────────────────────

/** Wire all mocks needed for a successful T05 navigation. */
export async function mockT05HappyPath(page: Page, projetoId = PROJETO_ID): Promise<void> {
  await mockProjStatus(page, PROJETO_EM_COMPOSICAO, 200, projetoId);
  await mockMetadados(page, { projetoId });
  await mockCapaUpload(page, 200, projetoId);
  await mockCapaRemove(page, 200, projetoId);
}

/** Wire all mocks needed for a successful T06 navigation. */
export async function mockT06HappyPath(page: Page, projetoId = PROJETO_ID): Promise<void> {
  await mockProjStatus(page, PROJETO_EM_COMPOSICAO, 200, projetoId);
  await mockLayout(page, { projetoId });
  await mockPreviewContext(page, PREVIEW_CONTEXT_ONE_PAGE, 200, projetoId);
}
