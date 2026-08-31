/**
 * BDD step definitions for: Layout and Image Alignment Overrides
 * Contract: test/comp/features/layout-and-image-alignment-overrides.feature
 *
 * P4: Runs against a real PostgreSQL 16 Testcontainer (emp_test schema).
 * The `tipo=em-branco` rejection (422) is verified end-to-end: the domain
 * raises DomainException before the Prisma upsert is attempted, so no
 * DB row is written (CHECK constraint is not needed for rejection, but the
 * domain guard fires first). ✓
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
  httpGetLayout,
  httpPutLayout,
  defaultLayoutBody,
  emBrancoOverride,
  getField,
} from '../shared.steps';

const feature = loadFeature(join(__dirname, '../features/layout-and-image-alignment-overrides.feature'));

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

  // ── Test 1: GET layout — lazy default ─────────────────────────────────────

  test('GET layout for new project returns lazy default with materialized false', ({
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

    and(/^the response body field "(.*)" is "(.*)"$/, (field: string, value: string) => {
      expect(getField(response, field)).toBe(value);
    });
  });

  // ── Test 2: PUT layout — stores and returns materialized true ─────────────

  test('PUT layout stores configuration and returns materialized true', ({
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
      /^the editor sends PUT layout for project "(.*)" with default typography$/,
      async (projetoId: string) => {
        response = await httpPutLayout(app, projetoId, defaultLayoutBody(), {
          empresaId: activeEmpresa,
        });
      },
    );

    then(/^the response status should be (\d+)$/, (status: string) => {
      expect(response.status).toBe(Number(status));
    });

    and(/^the response body field "(.*)" is true$/, (field: string) => {
      expect(getField(response, field)).toBe(true);
    });
  });

  // ── Test 3: GET after PUT returns persisted data ──────────────────────────

  test('GET layout after PUT returns persisted data', ({ given, when, then, and }) => {
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

    when(/^the editor requests GET layout for project "(.*)"$/, async (projetoId: string) => {
      response = await httpGetLayout(app, projetoId, { empresaId: activeEmpresa });
    });

    then(/^the response status should be (\d+)$/, (status: string) => {
      expect(response.status).toBe(Number(status));
    });

    and(/^the response body field "(.*)" is (\d+)$/, (field: string, value: string) => {
      expect(getField(response, field)).toBe(Number(value));
    });

    and(/^the response body field "(.*)" is true$/, (field: string) => {
      expect(getField(response, field)).toBe(true);
    });
  });

  // ── Test 4: PUT em-branco override → 422 ─────────────────────────────────
  //
  // Domain validation rejects tipo=em-branco before any DB write (DomainException
  // EM_BRANCO_NAO_SUPORTADO). With real DB: the Prisma upsert is never reached.
  // The 422 response is returned by CompExceptionFilter (RFC 7807). ✓

  test('PUT layout with tipo em-branco override returns 422', ({ given, when, then, and }) => {
    given(/^an authenticated editor of empresa "(.*)" with scope "(.*)"$/, (empresa: string, scopes: string) => {
      activeEmpresa = empresa;
      setupAuthenticatedEditor(empresa, scopes);
    });

    given(/^a project with id "(.*)" in the active empresa$/, (_projetoId: string) => {});

    when(
      /^the editor sends PUT layout for project "(.*)" with override tipo "(.*)"$/,
      async (projetoId: string, _tipo: string) => {
        // _tipo is always 'em-branco' in this scenario — emBrancoOverride helper hardcodes it.
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

  // ── Test 5: PUT no overrides → empty array ────────────────────────────────

  test('PUT layout without overrides returns empty overrides list', ({
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
      /^the editor sends PUT layout for project "(.*)" with default typography$/,
      async (projetoId: string) => {
        response = await httpPutLayout(app, projetoId, defaultLayoutBody(), {
          empresaId: activeEmpresa,
        });
      },
    );

    then(/^the response status should be (\d+)$/, (status: string) => {
      expect(response.status).toBe(Number(status));
    });

    and(/^the response body field "(.*)" is an empty array$/, (field: string) => {
      const value = getField(response, field);
      expect(Array.isArray(value)).toBe(true);
      expect((value as unknown[]).length).toBe(0);
    });
  });

  // ── Test 6: PUT with invalid typography field (Scenario Outline) ──────────

  test('PUT layout with invalid typography field value returns 400', ({
    given,
    when,
    then,
  }) => {
    given(/^an authenticated editor of empresa "(.*)" with scope "(.*)"$/, (empresa: string, scopes: string) => {
      activeEmpresa = empresa;
      setupAuthenticatedEditor(empresa, scopes);
    });

    given(/^a project with id "(.*)" in the active empresa$/, (_projetoId: string) => {});

    when(
      /^the editor sends PUT layout for project "(.*)" with field "(.*)" equal to (\d+)$/,
      async (projetoId: string, field: string, value: string) => {
        const body = defaultLayoutBody({ [field]: Number(value) });
        response = await httpPutLayout(app, projetoId, body, { empresaId: activeEmpresa });
      },
    );

    then(/^the response status should be (\d+)$/, (status: string) => {
      expect(response.status).toBe(Number(status));
    });
  });
});
