/**
 * Shared step helpers for COMP BDD tests.
 *
 * Steps that appear in two or more feature files are consolidated here to
 * prevent the `bdd-scaffold:step-definitions:duplicate-response-status-steps`
 * pitfall (D-497/D-498). Each step file imports and uses these helpers.
 *
 * IMPORTANT: This file exports helper functions only — it does NOT call
 * defineFeature. Step files import these and call them inside their own
 * defineFeature blocks.
 *
 * Issue: COMP-020
 */

import type { INestApplication } from '@nestjs/common';
import type { Response } from 'supertest';
import request from 'supertest';

import {
  currentUser,
  setCurrentUser,
  buildFakeJwt,
  compUrl,
} from './cucumber-context';

// ── Authentication helpers ────────────────────────────────────────────────────

/**
 * Sets the active BDD user with the given empresa and comma-separated scopes.
 */
export function setupAuthenticatedEditor(empresa: string, scopeString: string): void {
  const scopes = scopeString.split(',').map((s) => s.trim());
  setCurrentUser({
    userId: `user-${empresa}-001`,
    username: `editor-${empresa}`,
    roles: [],
    scopes,
    empresaId: empresa,
  });
}

/**
 * Sets the active BDD user as an empresa-admin.
 */
export function setupEmpresaAdmin(empresa: string): void {
  setCurrentUser({
    userId: `admin-${empresa}-001`,
    username: `admin-${empresa}`,
    roles: ['empresa-admin'],
    scopes: ['comp:read', 'comp:write'],
    empresaId: empresa,
  });
}

// ── Default request body builders ─────────────────────────────────────────────

/**
 * Returns a valid UpdateLayoutRequestDto body with sensible defaults.
 * Individual fields can be overridden via the `overrides` parameter.
 */
export function defaultLayoutBody(fieldOverrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    fonteCorpoFamilia: 'serif',
    fonteCorpoTamanho: 12,
    espacamentoLinha: 1.5,
    margemLateral: 20,
    h1Tamanho: 28,
    h2Tamanho: 22,
    h3Tamanho: 18,
    overrides: [],
    ...fieldOverrides,
  };
}

/**
 * Builds a valid LayoutOverrideInputDto for tipo='imagem'.
 *
 * The LayoutOverride domain object requires alinhamento for tipo='imagem'.
 * Uses referenciaNo (the DTO field name) not nodeId (the domain field name).
 */
export function imagemOverride(
  referenciaNo: string,
  ordem = 0,
): Record<string, unknown> {
  return { referenciaNo, tipo: 'imagem', alinhamento: 'centralizado', ordem };
}

/**
 * Builds a LayoutOverrideInputDto for tipo='em-branco'.
 *
 * The domain rejects this with 422 (DomainException EM_BRANCO_NAO_SUPORTADO).
 * No alinhamento needed — the constructor throws before checking it.
 */
export function emBrancoOverride(
  referenciaNo: string,
  ordem = 0,
): Record<string, unknown> {
  return { referenciaNo, tipo: 'em-branco', ordem };
}

// ── HTTP request helpers ───────────────────────────────────────────────────────

/**
 * Performs a GET metadados request and returns the supertest Response.
 */
export async function httpGetMetadados(
  app: INestApplication,
  projetoId: string,
  opts: {
    empresaId?: string;
    withoutToken?: boolean;
    correlationId?: string;
    tenantHeader?: string;
  } = {},
): Promise<Response> {
  const empresaId = opts.empresaId ?? currentUser.empresaId;
  const req = request(app.getHttpServer()).get(compUrl(projetoId, 'metadados'));
  if (!opts.withoutToken) {
    req.set('Authorization', `Bearer ${buildFakeJwt({ sub: 'user-001', empresa_id: empresaId })}`);
  }
  if (opts.correlationId) {
    req.set('X-Correlation-Id', opts.correlationId);
  }
  if (opts.tenantHeader) {
    req.set('X-Tenant-Id', opts.tenantHeader);
  }
  return req;
}

/**
 * Performs a PUT metadados request.
 */
export async function httpPutMetadados(
  app: INestApplication,
  projetoId: string,
  body: Record<string, unknown>,
  opts: { empresaId?: string } = {},
): Promise<Response> {
  const empresaId = opts.empresaId ?? currentUser.empresaId;
  return request(app.getHttpServer())
    .put(compUrl(projetoId, 'metadados'))
    .set('Authorization', `Bearer ${buildFakeJwt({ sub: 'user-001', empresa_id: empresaId })}`)
    .send(body);
}

/**
 * Performs a POST capa (cover upload) request.
 */
export async function httpPostCapa(
  app: INestApplication,
  projetoId: string,
  opts: { empresaId?: string; withoutToken?: boolean } = {},
): Promise<Response> {
  const empresaId = opts.empresaId ?? currentUser.empresaId;
  const req = request(app.getHttpServer())
    .post(compUrl(projetoId, 'capa'))
    .attach('file', Buffer.from('fake-image-content'), {
      filename: 'capa.jpg',
      contentType: 'image/jpeg',
    });
  if (!opts.withoutToken) {
    req.set('Authorization', `Bearer ${buildFakeJwt({ sub: 'user-001', empresa_id: empresaId })}`);
  }
  return req;
}

/**
 * Performs a DELETE capa request.
 */
export async function httpDeleteCapa(
  app: INestApplication,
  projetoId: string,
  opts: { empresaId?: string } = {},
): Promise<Response> {
  const empresaId = opts.empresaId ?? currentUser.empresaId;
  return request(app.getHttpServer())
    .delete(compUrl(projetoId, 'capa'))
    .set('Authorization', `Bearer ${buildFakeJwt({ sub: 'user-001', empresa_id: empresaId })}`);
}

/**
 * Performs a GET layout request.
 */
export async function httpGetLayout(
  app: INestApplication,
  projetoId: string,
  opts: { empresaId?: string; withoutToken?: boolean } = {},
): Promise<Response> {
  const empresaId = opts.empresaId ?? currentUser.empresaId;
  const req = request(app.getHttpServer()).get(compUrl(projetoId, 'layout'));
  if (!opts.withoutToken) {
    req.set('Authorization', `Bearer ${buildFakeJwt({ sub: 'user-001', empresa_id: empresaId })}`);
  }
  return req;
}

/**
 * Performs a PUT layout request.
 */
export async function httpPutLayout(
  app: INestApplication,
  projetoId: string,
  body: Record<string, unknown>,
  opts: { empresaId?: string } = {},
): Promise<Response> {
  const empresaId = opts.empresaId ?? currentUser.empresaId;
  return request(app.getHttpServer())
    .put(compUrl(projetoId, 'layout'))
    .set('Authorization', `Bearer ${buildFakeJwt({ sub: 'user-001', empresa_id: empresaId })}`)
    .send(body);
}

/**
 * Performs a GET preview-context request.
 */
export async function httpGetPreviewContext(
  app: INestApplication,
  projetoId: string,
  opts: { empresaId?: string; withoutToken?: boolean } = {},
): Promise<Response> {
  const empresaId = opts.empresaId ?? currentUser.empresaId;
  const req = request(app.getHttpServer()).get(compUrl(projetoId, 'preview-context'));
  if (!opts.withoutToken) {
    req.set('Authorization', `Bearer ${buildFakeJwt({ sub: 'user-001', empresa_id: empresaId })}`);
  }
  return req;
}

// ── Assertion helpers ─────────────────────────────────────────────────────────

/**
 * Resolves a dot-separated field path on the response body.
 * Example: `getField(resp, "layout.materialized")` → `resp.body.layout.materialized`
 */
export function getField(response: Response, fieldPath: string): unknown {
  const parts = fieldPath.split('.');
  let value: unknown = response.body;
  for (const part of parts) {
    if (value === null || value === undefined) return undefined;
    value = (value as Record<string, unknown>)[part];
  }
  return value;
}
