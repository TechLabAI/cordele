/**
 * auth-helpers.ts — E2E auth utilities for PUB module tests.
 * Strategy: page.addInitScript(scriptString) writes JWT to localStorage BEFORE Angular bootstraps.
 * This is picked up by initAuthSession APP_INITIALIZER in app.config.ts.
 *
 * MUST be called BEFORE page.goto() — the token must be available at Angular bootstrap time
 * so that authGuard sees isAuthenticated = true.
 *
 * Pattern: mirrors apps/imp-e2e (P7 E2E fix A) exactly — pass script as a STRING so the
 * token value is inlined via template literal in Node context. Do NOT use addInitScript(fn, arg)
 * with a separate arg: Playwright serialises the fn.toString() and the TypeScript closure does
 * not carry the outer variable, so the token would be undefined in the browser.
 *
 * FE-PUB-027 / FE-PUB-028 (P9 E2E hardening).
 */
import { Page } from '@playwright/test';

/**
 * Pre-generated hardcoded JWTs (exp=9999999999 = year 2286 — effectively never expires).
 * Generated with:
 *   node -e "const h=Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url');
 *            const p=Buffer.from(JSON.stringify({...payload...})).toString('base64url');
 *            console.log(h+'.'+p+'.fakesig');"
 *
 * Payload structure (same for all):
 *   { sub: 'e2e-test-user', empresa_id: 'emp_aetos', scope: '<scopes>', exp: 9999999999, roles: ['editor'] }
 *
 * decodeJwtPayload() (auth-session.ts) reads: sub, empresa_id, scope (split ' '), exp, roles.
 */
const JWT_PUB_FULL =
  'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0' +
  '.eyJzdWIiOiJlMmUtdGVzdC11c2VyIiwiZW1wcmVzYV9pZCI6ImVtcF9hZXRvcyIsInNjb3BlIjoicHViOnJlYWQgcHViOndyaXRlIiwiZXhwIjo5OTk5OTk5OTk5LCJyb2xlcyI6WyJlZGl0b3IiXX0' +
  '.fakesig';

const JWT_PUB_VIEW =
  'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0' +
  '.eyJzdWIiOiJlMmUtdGVzdC11c2VyIiwiZW1wcmVzYV9pZCI6ImVtcF9hZXRvcyIsInNjb3BlIjoicHViOnJlYWQiLCJleHAiOjk5OTk5OTk5OTksInJvbGVzIjpbImVkaXRvciJdfQ' +
  '.fakesig';

/** No pub scope — JWT present (authenticated) but no pub:read or pub:write. */
const JWT_NO_PUB =
  'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0' +
  '.eyJzdWIiOiJlMmUtdGVzdC11c2VyIiwiZW1wcmVzYV9pZCI6ImVtcF9hZXRvcyIsInNjb3BlIjoiIiwiZXhwIjo5OTk5OTk5OTk5LCJyb2xlcyI6WyJlZGl0b3IiXX0' +
  '.fakesig';

/** Scope sets exposed for test consumers. */
export const SCOPES_PUB_FULL    = ['pub:read', 'pub:write'] as const;
export const SCOPES_PUB_VIEW    = ['pub:read'] as const;
export const SCOPES_NO_PUB      = [] as const;

/**
 * seedPubSession — writes a JWT and empresa context to localStorage
 * using page.addInitScript() so they are available at Angular bootstrap.
 *
 * Implementation: passes the script as a template-literal STRING so that the
 * token value is substituted in the Node.js context and arrives in the browser
 * as a literal. This avoids the fn+arg pattern that loses closure variables
 * after Playwright serialises the function.
 *
 * MUST be called BEFORE page.goto().
 */
export async function seedPubSession(
  page: Page,
  scopes: readonly string[] = SCOPES_PUB_FULL,
): Promise<void> {
  const token =
    scopes.length === 0   ? JWT_NO_PUB :
    scopes.includes('pub:write') ? JWT_PUB_FULL :
    JWT_PUB_VIEW;

  // Token chars are [a-zA-Z0-9\-_.] — safe in a JS single-quoted string literal.
  await page.addInitScript(`
    localStorage.setItem('cordele_access_token', '${token}');
    localStorage.setItem(
      'cordele_empresa_current',
      JSON.stringify({ id: 'emp_aetos', nome: 'Editora Aetós', schema: 'emp_aetos' })
    );
  `);
}
