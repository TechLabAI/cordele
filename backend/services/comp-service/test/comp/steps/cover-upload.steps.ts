/**
 * BDD step definitions for: Cover Upload and Management
 * Contract: test/comp/features/cover-upload-and-management.feature
 *
 * P4: Runs against a real PostgreSQL 16 Testcontainer (emp_test schema).
 * File upload (POST capa) writes via DiskFileStorageAdapter to the test temp dir.
 * DELETE capa is idempotent — no row needed, 204 always.
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
  httpPostCapa,
  httpDeleteCapa,
  getField,
} from '../shared.steps';

const feature = loadFeature(join(__dirname, '../features/cover-upload-and-management.feature'));

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

  // ── Test 1: POST capa uploads cover ─────────────────────────────────────────

  test('POST capa uploads cover and returns capaUrl and atualizadoEm', ({
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

    when(/^the editor uploads a cover image for project "(.*)"$/, async (projetoId: string) => {
      response = await httpPostCapa(app, projetoId, { empresaId: activeEmpresa });
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
  });

  // ── Test 2: POST replaces existing cover ────────────────────────────────────

  test('POST capa second upload replaces first cover', ({ given, when, then, and }) => {
    given(/^an authenticated editor of empresa "(.*)" with scope "(.*)"$/, (empresa: string, scopes: string) => {
      activeEmpresa = empresa;
      setupAuthenticatedEditor(empresa, scopes);
    });

    given(/^a project with id "(.*)" in the active empresa$/, (_projetoId: string) => {});

    given(/^the editor has uploaded a cover for project "(.*)"$/, async (projetoId: string) => {
      await httpPostCapa(app, projetoId, { empresaId: activeEmpresa });
    });

    when(/^the editor uploads a cover image for project "(.*)"$/, async (projetoId: string) => {
      response = await httpPostCapa(app, projetoId, { empresaId: activeEmpresa });
    });

    then(/^the response status should be (\d+)$/, (status: string) => {
      expect(response.status).toBe(Number(status));
    });

    and(/^the response body contains field "(.*)"$/, (field: string) => {
      expect(getField(response, field)).toBeDefined();
    });
  });

  // ── Test 3: DELETE clears cover ─────────────────────────────────────────────

  test('DELETE capa clears cover and returns 204', ({ given, when, then }) => {
    given(/^an authenticated editor of empresa "(.*)" with scope "(.*)"$/, (empresa: string, scopes: string) => {
      activeEmpresa = empresa;
      setupAuthenticatedEditor(empresa, scopes);
    });

    given(/^a project with id "(.*)" in the active empresa$/, (_projetoId: string) => {});

    given(/^the editor has uploaded a cover for project "(.*)"$/, async (projetoId: string) => {
      await httpPostCapa(app, projetoId, { empresaId: activeEmpresa });
    });

    when(/^the editor deletes the cover for project "(.*)"$/, async (projetoId: string) => {
      response = await httpDeleteCapa(app, projetoId, { empresaId: activeEmpresa });
    });

    then(/^the response status should be (\d+)$/, (status: string) => {
      expect(response.status).toBe(Number(status));
    });
  });

  // ── Test 4: DELETE idempotent when no cover exists ───────────────────���──────

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

  // ── Test 5: GET after POST shows capaUrl ────────────────────────────────────

  test('GET metadados after POST capa shows capaUrl is set', ({ given, when, then, and }) => {
    given(/^an authenticated editor of empresa "(.*)" with scope "(.*)"$/, (empresa: string, scopes: string) => {
      activeEmpresa = empresa;
      setupAuthenticatedEditor(empresa, scopes);
    });

    given(/^a project with id "(.*)" in the active empresa$/, (_projetoId: string) => {});

    given(/^the editor has uploaded a cover for project "(.*)"$/, async (projetoId: string) => {
      await httpPostCapa(app, projetoId, { empresaId: activeEmpresa });
    });

    when(/^the editor requests GET metadados for project "(.*)"$/, async (projetoId: string) => {
      response = await httpGetMetadados(app, projetoId, { empresaId: activeEmpresa });
    });

    then(/^the response status should be (\d+)$/, (status: string) => {
      expect(response.status).toBe(Number(status));
    });

    and(/^the response body contains field "(.*)"$/, (field: string) => {
      const value = getField(response, field);
      // capaUrl should be a non-null string after upload.
      expect(typeof value).toBe('string');
      expect(value).toBeTruthy();
    });
  });

  // ── Test 6: POST without auth returns 401 ───────────────────────────────────

  test('POST capa without authorization returns 401', ({ given, when, then }) => {
    given(/^an authenticated editor of empresa "(.*)" with scope "(.*)"$/, (empresa: string, scopes: string) => {
      activeEmpresa = empresa;
      setupAuthenticatedEditor(empresa, scopes);
    });

    given('no authenticated user', () => {
      // Nothing to set — request step omits token.
    });

    when(/^the editor uploads a cover without token for project "(.*)"$/, async (projetoId: string) => {
      response = await request(app.getHttpServer())
        .post(compUrl(projetoId, 'capa'))
        .attach('file', Buffer.from('fake-image-content'), {
          filename: 'capa.jpg',
          contentType: 'image/jpeg',
        });
    });

    then(/^the response status should be (\d+)$/, (status: string) => {
      expect(response.status).toBe(Number(status));
    });
  });
});
