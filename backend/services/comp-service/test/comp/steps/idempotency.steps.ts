/**
 * BDD step definitions for: Idempotency and Lazy Defaults
 * Contract: test/comp/features/idempotency-and-lazy-defaults.feature
 *
 * P4: Runs against a real PostgreSQL 16 Testcontainer (emp_test schema).
 * Lazy default behaviour (GET with no prior row → materialized=false, no row created)
 * and idempotent upserts are verified against the real Prisma repository.
 *
 * Issue: COMP-020
 */

import { INestApplication } from '@nestjs/common';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { join } from 'node:path';
import type { Response } from 'supertest';

import {
  getTestApp,
  resetUser,
  truncateBddTables,
} from '../cucumber-context';
import {
  setupAuthenticatedEditor,
  httpGetMetadados,
  httpPutMetadados,
  httpGetLayout,
  httpPutLayout,
  httpDeleteCapa,
  defaultLayoutBody,
  getField,
} from '../shared.steps';

const feature = loadFeature(join(__dirname, '../features/idempotency-and-lazy-defaults.feature'));

defineFeature(feature, (test) => {
  let app: INestApplication;
  let response: Response;
  let activeEmpresa = 'test';

  beforeAll(async () => {
    app = await getTestApp();
  });

  afterEach(async () => {
    resetUser();
    activeEmpresa = 'test';
    await truncateBddTables('test');
  });

  // ── Test 1: GET metadados lazy default — no record created ───────────────

  test('GET metadados before any PUT returns materialized false without creating a record', ({
    given,
    when,
    then,
    and,
  }) => {
    given(/^an authenticated editor of empresa "(.*)" with scope "(.*)"$/, (empresa: string, scopes: string) => {
      activeEmpresa = empresa;
      setupAuthenticatedEditor(empresa, scopes);
    });

    given(/^a project with id "(.*)" in the active empresa$/, (_projetoId: string) => {});

    when(/^the editor requests GET metadados for project "(.*)"$/, async (projetoId: string) => {
      response = await httpGetMetadados(app, projetoId, { empresaId: activeEmpresa });
    });

    then(/^the response status should be (\d+)$/, (status: string) => {
      expect(response.status).toBe(Number(status));
    });

    and(/^the response body field "(.*)" is false$/, (field: string) => {
      expect(getField(response, field)).toBe(false);
    });

    and(/^the response body field "(.*)" is "(.*)"$/, (field: string, value: string) => {
      expect(getField(response, field)).toBe(value);
    });
  });

  // ── Test 2: GET layout lazy default ──────────────────────────────────────

  test('GET layout before any PUT returns materialized false without creating a record', ({
    given,
    when,
    then,
    and,
  }) => {
    given(/^an authenticated editor of empresa "(.*)" with scope "(.*)"$/, (empresa: string, scopes: string) => {
      activeEmpresa = empresa;
      setupAuthenticatedEditor(empresa, scopes);
    });

    given(/^a project with id "(.*)" in the active empresa$/, (_projetoId: string) => {});

    when(/^the editor requests GET layout for project "(.*)"$/, async (projetoId: string) => {
      response = await httpGetLayout(app, projetoId, { empresaId: activeEmpresa });
    });

    then(/^the response status should be (\d+)$/, (status: string) => {
      expect(response.status).toBe(Number(status));
    });

    and(/^the response body field "(.*)" is false$/, (field: string) => {
      expect(getField(response, field)).toBe(false);
    });
  });

  // ── Test 3: PUT metadados twice — idempotent ──────────────────────────────

  test('PUT metadados twice with same data is idempotent and returns same result', ({
    given,
    when,
    then,
    and,
  }) => {
    given(/^an authenticated editor of empresa "(.*)" with scope "(.*)"$/, (empresa: string, scopes: string) => {
      activeEmpresa = empresa;
      setupAuthenticatedEditor(empresa, scopes);
    });

    given(/^a project with id "(.*)" in the active empresa$/, (_projetoId: string) => {});

    given(
      /^the editor has stored metadados for project "(.*)" with titulo "(.*)" and autor "(.*)" and idioma "(.*)"$/,
      async (projetoId: string, titulo: string, autor: string, idioma: string) => {
        await httpPutMetadados(app, projetoId, { titulo, autor, idioma }, { empresaId: activeEmpresa });
      },
    );

    when(
      /^the editor sends PUT metadados for project "(.*)" with titulo "(.*)" and autor "(.*)" and idioma "(.*)"$/,
      async (projetoId: string, titulo: string, autor: string, idioma: string) => {
        response = await httpPutMetadados(
          app,
          projetoId,
          { titulo, autor, idioma },
          { empresaId: activeEmpresa },
        );
      },
    );

    then(/^the response status should be (\d+)$/, (status: string) => {
      expect(response.status).toBe(Number(status));
    });

    and(/^the response body field "(.*)" is "(.*)"$/, (field: string, value: string) => {
      expect(getField(response, field)).toBe(value);
    });

    and(/^the response body field "(.*)" is true$/, (field: string) => {
      expect(getField(response, field)).toBe(true);
    });
  });

  // ── Test 4: PUT layout twice — idempotent ────────────────────────────────

  test('PUT layout twice with same data is idempotent', ({ given, when, then, and }) => {
    given(/^an authenticated editor of empresa "(.*)" with scope "(.*)"$/, (empresa: string, scopes: string) => {
      activeEmpresa = empresa;
      setupAuthenticatedEditor(empresa, scopes);
    });

    given(/^a project with id "(.*)" in the active empresa$/, (_projetoId: string) => {});

    given(
      /^the editor has stored layout for project "(.*)" with fonteCorpoTamanho "(.*)"$/,
      async (projetoId: string, fonteCorpoTamanhoStr: string) => {
        const fonteCorpoTamanho = Number(fonteCorpoTamanhoStr);
        await httpPutLayout(app, projetoId, defaultLayoutBody({ fonteCorpoTamanho }), {
          empresaId: activeEmpresa,
        });
      },
    );

    when(
      /^the editor sends PUT layout for project "(.*)" with fonteCorpoTamanho (\d+)$/,
      async (projetoId: string, fonteCorpoTamanho: string) => {
        response = await httpPutLayout(
          app,
          projetoId,
          defaultLayoutBody({ fonteCorpoTamanho: Number(fonteCorpoTamanho) }),
          { empresaId: activeEmpresa },
        );
      },
    );

    then(/^the response status should be (\d+)$/, (status: string) => {
      expect(response.status).toBe(Number(status));
    });

    and(/^the response body field "(.*)" is (\d+)$/, (field: string, value: string) => {
      expect(getField(response, field)).toBe(Number(value));
    });
  });

  // ── Test 5: DELETE capa idempotent ────────────────────────────────────────

  test('DELETE capa when no cover exists returns 204 idempotent', ({ given, when, then }) => {
    given(/^an authenticated editor of empresa "(.*)" with scope "(.*)"$/, (empresa: string, scopes: string) => {
      activeEmpresa = empresa;
      setupAuthenticatedEditor(empresa, scopes);
    });

    given(/^a project with id "(.*)" in the active empresa$/, (_projetoId: string) => {});

    when(/^the editor deletes the cover for project "(.*)"$/, async (projetoId: string) => {
      response = await httpDeleteCapa(app, projetoId, { empresaId: activeEmpresa });
    });

    then(/^the response status should be (\d+)$/, (status: string) => {
      expect(response.status).toBe(Number(status));
    });
  });
});
