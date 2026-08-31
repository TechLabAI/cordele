/**
 * BDD step definitions for: Observability and Health
 * Contract: test/comp/features/observability-and-health.feature
 *
 * Verifies X-Correlation-Id propagation and RFC 7807 problem+json error format.
 * P4: Runs against a real PostgreSQL 16 Testcontainer (emp_test schema).
 * Domain errors (422) fire before any DB write — no rows created in these tests.
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
  httpPutLayout,
  defaultLayoutBody,
  emBrancoOverride,
  getField,
} from '../shared.steps';

const feature = loadFeature(join(__dirname, '../features/observability-and-health.feature'));

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

  // ── Test 1: Successful response includes X-Correlation-Id ─────────────────

  test('Successful response includes X-Correlation-Id header', ({ given, when, then, and }) => {
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

    and(/^the response header "(.*)" is present$/, (headerName: string) => {
      expect(response.headers[headerName.toLowerCase()]).toBeDefined();
    });
  });

  // ── Test 2: Custom correlation id is echoed ────────────────────────────────

  test('Custom X-Correlation-Id sent in request is echoed in response', ({
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
      /^the editor requests GET metadados for project "(.*)" with correlation id "(.*)"$/,
      async (projetoId: string, correlationId: string) => {
        response = await httpGetMetadados(app, projetoId, {
          empresaId: activeEmpresa,
          correlationId,
        });
      },
    );

    then(/^the response status should be (\d+)$/, (status: string) => {
      expect(response.status).toBe(Number(status));
    });

    and(/^the response header "(.*)" equals "(.*)"$/, (headerName: string, value: string) => {
      expect(response.headers[headerName.toLowerCase()]).toBe(value);
    });
  });

  // ── Test 3: 422 returns application/problem+json with traceId ─────────────

  test('Domain error 422 returns application problem json with traceId', ({
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
      /^the editor sends PUT layout for project "(.*)" with override tipo "(.*)"$/,
      async (projetoId: string, _tipo: string) => {
        const body = defaultLayoutBody({
          overrides: [emBrancoOverride('node-001')],
        });
        response = await httpPutLayout(app, projetoId, body, { empresaId: activeEmpresa });
      },
    );

    then(/^the response status should be (\d+)$/, (status: string) => {
      expect(response.status).toBe(Number(status));
    });

    and(/^the response content type is "(.*)"$/, (contentType: string) => {
      expect(response.headers['content-type']).toContain(contentType);
    });

    and(/^the response body contains field "(.*)"$/, (field: string) => {
      expect(getField(response, field)).toBeDefined();
    });

    and(/^the response body contains field "(.*)"$/, (field: string) => {
      expect(getField(response, field)).toBeDefined();
    });

    and(/^the response body contains field "(.*)"$/, (field: string) => {
      expect(getField(response, field)).toBeDefined();
    });
  });

  // ── Test 4: Problem detail has all RFC 7807 required fields ───────────────

  test('Problem detail response has all RFC 7807 required fields', ({
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
      /^the editor sends PUT layout for project "(.*)" with override tipo "(.*)"$/,
      async (projetoId: string, _tipo: string) => {
        const body = defaultLayoutBody({
          overrides: [emBrancoOverride('node-001')],
        });
        response = await httpPutLayout(app, projetoId, body, { empresaId: activeEmpresa });
      },
    );

    then(/^the response status should be (\d+)$/, (status: string) => {
      expect(response.status).toBe(Number(status));
    });

    and(/^the response body field "(.*)" starts with "(.*)"$/, (field: string, prefix: string) => {
      const value = getField(response, field);
      expect(typeof value).toBe('string');
      expect((value as string).startsWith(prefix)).toBe(true);
    });

    and(/^the response body field "(.*)" is (\d+)$/, (field: string, value: string) => {
      expect(getField(response, field)).toBe(Number(value));
    });

    and(/^the response body contains field "(.*)"$/, (field: string) => {
      expect(getField(response, field)).toBeDefined();
    });
  });

  // ── Test 5: title field contains error code (Scenario Outline) ────────────

  test('Domain error title field contains the error code', ({ given, when, then, and }) => {
    given(/^an authenticated editor of empresa "(.*)" with scope "(.*)"$/, (empresa: string, scopes: string) => {
      activeEmpresa = empresa;
      setupAuthenticatedEditor(empresa, scopes);
    });

    given(/^a project with id "(.*)" in the active empresa$/, (_projetoId: string) => {});

    when(
      /^the editor sends PUT layout for project "(.*)" with override tipo "(.*)"$/,
      async (projetoId: string, _tipo: string) => {
        const body = defaultLayoutBody({
          overrides: [emBrancoOverride('node-001')],
        });
        response = await httpPutLayout(app, projetoId, body, { empresaId: activeEmpresa });
      },
    );

    then(/^the response status should be (\d+)$/, (status: string) => {
      expect(response.status).toBe(Number(status));
    });

    and(/^the response body field "(.*)" is "(.*)"$/, (field: string, value: string) => {
      expect(getField(response, field)).toBe(value);
    });
  });
});
