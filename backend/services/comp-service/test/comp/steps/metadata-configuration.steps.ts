/**
 * BDD step definitions for: Metadata Configuration
 * Contract: test/comp/features/metadata-configuration.feature
 *
 * P4: Runs against a real PostgreSQL 16 Testcontainer (emp_test schema).
 * Lazy-default, upsert persistence, and optional isbn are verified end-to-end.
 *
 * Issue: COMP-020
 */

import { INestApplication } from '@nestjs/common';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { join } from 'node:path';
import type { Response } from 'supertest';
import request from 'supertest';

import {
  getTestApp,
  compUrl,
  resetUser,
  truncateBddTables,
} from '../cucumber-context';
import {
  setupAuthenticatedEditor,
  httpGetMetadados,
  httpPutMetadados,
  getField,
} from '../shared.steps';

const feature = loadFeature(join(__dirname, '../features/metadata-configuration.feature'));

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

  // ── Test 1: GET lazy default ─────────────────────────────────────────────

  test('GET metadados for new project returns lazy default with materialized false', ({
    given,
    when,
    then,
    and,
  }) => {
    given(/^an authenticated editor of empresa "(.*)" with scope "(.*)"$/, (empresa: string, scopes: string) => {
      activeEmpresa = empresa;
      setupAuthenticatedEditor(empresa, scopes);
    });

    given(/^a project with id "(.*)" in the active empresa$/, (_projetoId: string) => {
      // No explicit seed needed — lazy defaults handle absent rows.
    });

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

  // ── Test 2: PUT stores and returns materialized true ────────────────────

  test('PUT metadados stores metadata and returns materialized true', ({
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

    and(/^the response body field "(.*)" is true$/, (field: string) => {
      expect(getField(response, field)).toBe(true);
    });

    and(/^the response body field "(.*)" is "(.*)"$/, (field: string, value: string) => {
      expect(getField(response, field)).toBe(value);
    });

    and(/^the response body field "(.*)" is "(.*)"$/, (field: string, value: string) => {
      expect(getField(response, field)).toBe(value);
    });
  });

  // ── Test 3: GET after PUT returns persisted data ─────────────────────────

  test('GET metadados after PUT returns persisted data', ({ given, when, then, and }) => {
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

    when(/^the editor requests GET metadados for project "(.*)"$/, async (projetoId: string) => {
      response = await httpGetMetadados(app, projetoId, { empresaId: activeEmpresa });
    });

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

  // ── Test 4: GET for unknown project returns lazy default ──────────────────

  test('GET metadados for unknown project returns lazy default not 404', ({ given, when, then, and }) => {
    given(/^an authenticated editor of empresa "(.*)" with scope "(.*)"$/, (empresa: string, scopes: string) => {
      activeEmpresa = empresa;
      setupAuthenticatedEditor(empresa, scopes);
    });

    when(/^the editor requests GET metadados for project "(.*)"$/, async (projetoId: string) => {
      response = await httpGetMetadados(app, projetoId, { empresaId: activeEmpresa });
    });

    then(/^the response status should be (\d+)$/, (status: string) => {
      expect(response.status).toBe(Number(status));
    });

    and(/^the response body field "(.*)" is false$/, (field: string) => {
      expect(getField(response, field)).toBe(false);
    });
  });

  // ── Test 5: PUT with optional isbn ───────────────────────────────────────

  test('PUT metadados stores optional isbn field', ({ given, when, then, and }) => {
    given(/^an authenticated editor of empresa "(.*)" with scope "(.*)"$/, (empresa: string, scopes: string) => {
      activeEmpresa = empresa;
      setupAuthenticatedEditor(empresa, scopes);
    });

    given(/^a project with id "(.*)" in the active empresa$/, (_projetoId: string) => {});

    when(
      /^the editor sends PUT metadados for project "(.*)" with titulo "(.*)" and autor "(.*)" and idioma "(.*)" and isbn "(.*)"$/,
      async (projetoId: string, titulo: string, autor: string, idioma: string, isbn: string) => {
        response = await httpPutMetadados(
          app,
          projetoId,
          { titulo, autor, idioma, isbn },
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
  });

  // ── Test 6: GET without auth returns 401 ────────────────────────────────

  test('GET metadados without authorization returns 401', ({ given, when, then }) => {
    // Background step: required by jest-cucumber because the feature Background
    // contributes one step definition to every scenario in the feature file.
    given(/^an authenticated editor of empresa "(.*)" with scope "(.*)"$/, (_empresa: string, _scopes: string) => {
      // Background is overridden by the next given — no setup needed here.
    });

    given('no authenticated user', () => {
      // Nothing to set up — the request step omits the token.
    });

    when(/^the editor requests GET metadados without token for project "(.*)"$/, async (projetoId: string) => {
      response = await request(app.getHttpServer()).get(compUrl(projetoId, 'metadados'));
    });

    then(/^the response status should be (\d+)$/, (status: string) => {
      expect(response.status).toBe(Number(status));
    });
  });

  // ── Test 7: PUT with invalid idioma (Scenario Outline) ──────────────────

  test('PUT metadados with invalid idioma returns 400', ({ given, when, then }) => {
    given(/^an authenticated editor of empresa "(.*)" with scope "(.*)"$/, (empresa: string, scopes: string) => {
      activeEmpresa = empresa;
      setupAuthenticatedEditor(empresa, scopes);
    });

    given(/^a project with id "(.*)" in the active empresa$/, (_projetoId: string) => {});

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
  });
});
