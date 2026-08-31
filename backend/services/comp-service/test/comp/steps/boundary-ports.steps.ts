/**
 * BDD step definitions for: Composition Boundary and Ports
 * Contract: test/comp/features/composition-boundary-and-ports.feature
 *
 * Verifies COMP reads from IMP via ManuscriptContentPort and correctly computes
 * stale overrides when referenced nodes are absent from the content tree.
 *
 * P4: Runs against a real PostgreSQL 16 Testcontainer (emp_test schema).
 * ManuscriptContentPort is still served by BddManuscriptStub (no real IMP integration).
 * Test 4 (read-only assertion) queries DB directly via queryMetadadosByProjetoId.
 *
 * Issue: COMP-020
 *
 * Key: The PUT layout response is LayoutResponseDto, which has:
 *   overrides: [{ referenciaNo, tipo, stale, ... }]
 * (not a top-level staleOverrides array — that's only in PreviewContextResponseDto)
 */

import { INestApplication } from '@nestjs/common';
import { defineFeature, loadFeature } from 'jest-cucumber';
import { join } from 'node:path';
import type { Response } from 'supertest';

import {
  getTestApp,
  fakeManuscript,
  resetUser,
  truncateBddTables,
  queryMetadadosByProjetoId,
} from '../cucumber-context';
import {
  setupAuthenticatedEditor,
  httpPutLayout,
  httpGetPreviewContext,
  defaultLayoutBody,
  imagemOverride,
  getField,
} from '../shared.steps';

const feature = loadFeature(join(__dirname, '../features/composition-boundary-and-ports.feature'));

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

  // ── Test 1: Override for existing node — not stale ─────────────────────────

  test('Override referencing existing manuscript node is marked as active in response', ({
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
      /^the editor sends PUT layout for project "(.*)" with override for node "(.*)" and tipo "(.*)"$/,
      async (projetoId: string, nodeId: string, _tipo: string) => {
        // The feature requests tipo='imagem' — imagemOverride includes alinhamento (required).
        const body = defaultLayoutBody({
          overrides: [imagemOverride(nodeId)],
        });
        response = await httpPutLayout(app, projetoId, body, { empresaId: activeEmpresa });
      },
    );

    then(/^the response status should be (\d+)$/, (status: string) => {
      expect(response.status).toBe(Number(status));
    });

    and(/^the override for node "(.*)" is not stale$/, (nodeId: string) => {
      // PUT layout returns LayoutResponseDto: overrides[i].referenciaNo + overrides[i].stale.
      const overrides = getField(response, 'overrides') as Array<{ referenciaNo: string; stale: boolean }>;
      expect(Array.isArray(overrides)).toBe(true);
      const match = overrides.find((o) => o.referenciaNo === nodeId);
      expect(match).toBeDefined();
      expect(match?.stale).toBe(false);
    });
  });

  // ── Test 2: Override for non-existing node — stale ────────────────────────

  test('Override referencing non-existing manuscript node is marked as stale', ({
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
      /^the editor sends PUT layout for project "(.*)" with override for node "(.*)" and tipo "(.*)"$/,
      async (projetoId: string, nodeId: string, _tipo: string) => {
        const body = defaultLayoutBody({
          overrides: [imagemOverride(nodeId)],
        });
        response = await httpPutLayout(app, projetoId, body, { empresaId: activeEmpresa });
      },
    );

    then(/^the response status should be (\d+)$/, (status: string) => {
      expect(response.status).toBe(Number(status));
    });

    and(/^the override for node "(.*)" is stale$/, (nodeId: string) => {
      const overrides = getField(response, 'overrides') as Array<{ referenciaNo: string; stale: boolean }>;
      expect(Array.isArray(overrides)).toBe(true);
      const match = overrides.find((o) => o.referenciaNo === nodeId);
      expect(match).toBeDefined();
      expect(match?.stale).toBe(true);
    });
  });

  // ── Test 3: No manuscript → all overrides stale ────────────────────────────

  test('PUT layout when no manuscript exists marks all overrides as stale', ({
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

    when(
      /^the editor sends PUT layout for project "(.*)" with override for node "(.*)" and tipo "(.*)"$/,
      async (projetoId: string, nodeId: string, _tipo: string) => {
        const body = defaultLayoutBody({
          overrides: [imagemOverride(nodeId)],
        });
        response = await httpPutLayout(app, projetoId, body, { empresaId: activeEmpresa });
      },
    );

    then(/^the response status should be (\d+)$/, (status: string) => {
      expect(response.status).toBe(Number(status));
    });

    and(/^the override for node "(.*)" is stale$/, (nodeId: string) => {
      const overrides = getField(response, 'overrides') as Array<{ referenciaNo: string; stale: boolean }>;
      expect(Array.isArray(overrides)).toBe(true);
      const match = overrides.find((o) => o.referenciaNo === nodeId);
      expect(match).toBeDefined();
      expect(match?.stale).toBe(true);
    });
  });

  // ── Test 4: GET preview-context is read-only ───────────────────────────────

  test('GET preview-context is read-only and does not create metadados records', ({
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

    and(
      /^no metadados record was persisted for project "(.*)"$/,
      async (projetoId: string) => {
        // After GET preview-context, no row should exist in the real DB for this project.
        // queryMetadadosByProjetoId returns null when no upsert was triggered.
        const record = await queryMetadadosByProjetoId(activeEmpresa, projetoId);
        expect(record).toBeNull();
      },
    );
  });

  // ── Test 5: Stale override appears in staleOverrides on preview-context ────

  test('GET preview-context with stale stored override lists it in staleOverrides', ({
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
        // Store layout with an override for a node that doesn't exist in the fake manuscript tree.
        // imagemOverride ensures correct DTO shape (referenciaNo + alinhamento + ordem).
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
      // PreviewContextResponseDto has staleOverrides: LayoutOverrideResponseDto[]
      const value = getField(response, field);
      expect(Array.isArray(value)).toBe(true);
      expect((value as unknown[]).length).toBeGreaterThan(0);
    });
  });
});
