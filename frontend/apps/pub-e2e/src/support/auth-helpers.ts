/**
 * auth-helpers.ts — E2E auth utilities for PUB module tests.
 * Strategy: page.addInitScript() writes JWT to localStorage BEFORE Angular bootstraps.
 * This is picked up by initAuthSession APP_INITIALIZER in app.config.ts.
 *
 * Do NOT call seedPubSession() after page.goto() — the token must be available
 * at Angular bootstrap time so that authGuard sees isAuthenticated = true.
 *
 * FE-PUB-027 / FE-PUB-028 (P9 E2E hardening).
 */
import { Page } from '@playwright/test';

export function makeTestJwt(
  scopes: readonly string[] = ['pub:read', 'pub:write'],
  empresaId = 'emp_aetos',
  expiresInSeconds = 7200,
): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const toBase64Url = (obj: object): string =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const header  = toBase64Url({ alg: 'none', typ: 'JWT' });
  const payload = toBase64Url({
    sub: 'e2e-test-user',
    empresa_id: empresaId,
    scope: scopes.join(' '),
    exp,
    roles: ['editor'],
  });
  return `${header}.${payload}.e2e-test-signature`;
}

/**
 * seedPubSession — writes a JWT and empresa context to localStorage
 * using page.addInitScript() so they are available at Angular bootstrap.
 *
 * MUST be called BEFORE page.goto().
 * Pattern mirrors apps/imp-e2e (P7 E2E fix A).
 */
export async function seedPubSession(
  page: Page,
  scopes: readonly string[] = SCOPES_PUB_FULL,
  empresaId = 'emp_aetos',
): Promise<void> {
  const token = makeTestJwt(scopes, empresaId);
  await page.addInitScript(
    ({ tok, empId }: { tok: string; empId: string }) => {
      localStorage.setItem('cordele_access_token', tok);
      localStorage.setItem(
        'cordele_empresa_current',
        JSON.stringify({ id: empId, nome: 'Editora Aetós', schema: 'emp_aetos' }),
      );
    },
    { tok: token, empId: empresaId },
  );
}

export const SCOPES_PUB_FULL    = ['pub:read', 'pub:write'] as const;
export const SCOPES_PUB_VIEW    = ['pub:read'] as const;
export const SCOPES_NO_PUB      = [] as const;
