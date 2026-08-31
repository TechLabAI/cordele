/**
 * BDD step definitions for: Preview Context Assembly
 * Contract: test/comp/features/preview-context-assembly.feature
 *
 * P4: Runs against a real PostgreSQL 16 Testcontainer (emp_test schema).
 * ManuscriptContentPort is still served by BddManuscriptStub (no real IMP integration).
 * Stale-override detection and null-manuscript fallback verified end-to-end.
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
  fakeManuscript,
  resetUser,
  truncateBddTables,
} from '../cucumber-context';
import {
  setupAuthenticatedEditor,
  httpGetPreviewContext,
  httpPutLayout,
  defaultLayoutBody,
  imagemOverride,
  getField,
} from '../shared.steps';

const feature = loadFeature(join(__dirname, '../features/preview-context-assembly.feature'));

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
    fakeManuscript?.clearOverrides();
    await truncateBddTables('test');
  });

  // ── Test 1: GET returns all required fields ────────────────────────────────

  test('GET preview-context returns projetoId manuscrito layout and staleOverrides fields', ({
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

    when(/^the editor requests GET preview-context for project "(.*)"$/, async (projetoId: string) => {
      response = await httpGetPreviewContext(app, projetoId, { empresaId: activeEmpresa });
    });

    then(/^the response status should be (\d+)$/, (status: string) => {
      expect(response.status).toBe(Number(status));
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

    and(/^the response body contains field "(.*)"$/, (field: string) => {
      expect(getField(response, field)).toBeDefined();
    });
  });

  // ── Test 2: GET with no stored records returns lazy defaults ──────────────

  test('GET preview-context with no stored records returns lazy defaults', ({
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

    when(/^the editor requests GET preview-context for project "(.*)"$/, async (projetoId: string) => {
      response = await httpGetPreviewContext(app, projetoId, { empresaId: activeEmpresa });
    });

    then(/^the response status should be (\d+)$/, (status: string) => {
      expect(response.status).toBe(Number(status));
    });

    and(/^the response body field "(.*)" is false$/, (field: string) => {
      expect(getField(response, field)).toBe(false);
    });
  });

  // ── Test 3: GET with stale override lists it in staleOverrides ────────────

  test('GET preview-context with stale override lists it in staleOverrides', ({
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
      /^the editor has stored layout for project "(.*)" with override referencing node "(.*)"$/,
      async (projetoId: string, nodeId: string) => {
        // Store layout with an override referencing a non-existent node.
        // Uses imagemOverride which includes alinhamento (required by domain).
        const body = defaultLayoutBody({
          overrides: [imagemOverride(nodeId)],
        });
        await httpPutLayout(app, projetoId, body, { empresaId: activeEmpresa });
      },
    );

    when(/^the editor requests GET preview-context for project "(.*)"$/, async (projetoId: string) => {
      response = await httpGetPreviewContext(app, projetoId, { empresaId: activeEmpresa });
    });

    then(/^the response status should be (\d+)$/, (status: string) => {
      expect(response.status).toBe(Number(status));
    });

    and(/^the response body field "(.*)" is not empty$/, (field: string) => {
      const value = getField(response, field);
      expect(Array.isArray(value)).toBe(true);
      expect((value as unknown[]).length).toBeGreaterThan(0);
    });
  });

  // ── Test 4: GET when no manuscript → 409 manuscript-missing ─────────────

  test('GET preview-context when no manuscript configured returns 409', ({
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

    given(/^the manuscript stub returns null for project "(.*)"$/, (projetoId: string) => {
      fakeManuscript.setNullForProject(projetoId);
    });

    when(/^the editor requests GET preview-context for project "(.*)"$/, async (projetoId: string) => {
      response = await httpGetPreviewContext(app, projetoId, { empresaId: activeEmpresa });
    });

    then(/^the response status should be (\d+)$/, (status: string) => {
      expect(response.status).toBe(Number(status));
    });

    and(/^the response body contains field "(.*)"$/, (field: string) => {
      expect(getField(response, field)).toBeDefined();
    });
  });

  // ── Test 5: GET without auth returns 401 ──────────────────────────────────

  test('GET preview-context without authorization returns 401', ({ given, when, then }) => {
    given(/^an authenticated editor of empresa "(.*)" with scope "(.*)"$/, (empresa: string, scopes: string) => {
      activeEmpresa = empresa;
      setupAuthenticatedEditor(empresa, scopes);
    });

    given('no authenticated user', () => {
      // Request step omits token.
    });

    when(
      /^the editor requests GET preview-context without token for project "(.*)"$/,
      async (projetoId: string) => {
        response = await request(app.getHttpServer()).get(compUrl(projetoId, 'preview-context'));
      },
    );

    then(/^the response status should be (\d+)$/, (status: string) => {
      expect(response.status).toBe(Number(status));
    });
  });
});
