/**
 * auth-helpers.ts — E2E authentication seeding utilities for PROJ module tests.
 *
 * Strategy: Angular's dev-mode `window.ng` API exposes `ng.getInjector()` which
 * returns a node injector. We walk the injector chain to find `AuthSessionService`
 * by constructor name and call `setToken()` with a fake (but structurally valid) JWT.
 *
 * Requirements:
 *   - Angular application must be built/served in development mode (window.ng present).
 *   - `AuthSessionService` must be `providedIn: 'root'` (it is — @cordele/shared/auth-session).
 *
 * FE-PROJ-024 / FE-PROJ-025 (P3 E2E gate).
 * Adapted from apps/comp-e2e/src/support/auth-helpers.ts — same pattern.
 */
import { Page } from '@playwright/test';

// ── JWT factory ───────────────────────────────────────────────────────────────

/**
 * Creates a structurally valid (unsigned) JWT whose payload satisfies
 * `AuthSessionService.decodeJwtPayload()`:
 *   - `sub`, `empresa_id`, `scope` (space-separated), `exp`, `roles`
 *
 * The signature segment is a test placeholder — not cryptographically valid.
 * The `AuthSessionService` on the FE never verifies the signature.
 */
export function makeTestJwt(
  scopes: readonly string[] = ['proj:read', 'proj:write'],
  empresaId = 'emp_aetos',
  expiresInSeconds = 7200,
): string {
  const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
  const toBase64Url = (obj: object): string =>
    btoa(JSON.stringify(obj))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

  const header  = toBase64Url({ alg: 'none', typ: 'JWT' });
  const payload = toBase64Url({
    sub:        'e2e-test-user',
    empresa_id: empresaId,
    scope:      scopes.join(' '),
    exp,
    roles:      ['editor'],
  });
  return `${header}.${payload}.e2e-test-signature`;
}

// ── Auth injection ─────────────────────────────────────────────────────────

/**
 * Injects a test session into the running Angular application by walking the
 * root injector chain for `AuthSessionService` via Angular's dev-mode `ng` global.
 *
 * Must be called AFTER the page is loaded and Angular has bootstrapped.
 * On failure (non-dev build or service not found) logs a warning and continues —
 * tests that truly depend on auth will fail with meaningful assertion errors
 * rather than silently passing.
 *
 * @param page      - Playwright `Page` handle
 * @param scopes    - BE scopes to grant (defaults to full PROJ access)
 * @param empresaId - empresa context (defaults to emp_aetos)
 */
export async function seedAuthSession(
  page: Page,
  scopes: readonly string[] = ['proj:read', 'proj:write'],
  empresaId = 'emp_aetos',
): Promise<void> {
  const token = makeTestJwt(scopes, empresaId);

  await page.evaluate(
    ({ tok, empId }: { tok: string; empId: string }) => {
      const el = document.querySelector('app-root');
      if (!el) {
        console.warn('[E2E] app-root not found — Angular may not have bootstrapped yet');
        return;
      }

      const ng = (window as unknown as { ng?: Record<string, unknown> })['ng'];
      if (!ng?.['getInjector']) {
        console.warn('[E2E] Angular dev mode (window.ng) not available — auth not seeded');
        return;
      }

      try {
        const injector: {
          get: (t: unknown) => unknown;
          _records?: Map<unknown, unknown>;
          _parent?: unknown;
          _injector?: unknown;
        } = (ng['getInjector'] as (el: Element) => unknown)(el) as never;

        /** Recursively walk the injector chain looking for AuthSessionService by name. */
        const walkAndInject = (
          inj: typeof injector | null | undefined,
        ): boolean => {
          if (!inj) return false;
          const records = inj._records;
          if (records instanceof Map) {
            for (const [tokenCtor] of records) {
              if (
                typeof tokenCtor === 'function' &&
                (tokenCtor as { name?: string }).name === 'AuthSessionService'
              ) {
                const svc = inj.get(tokenCtor) as {
                  setToken?: (t: string) => void;
                } | null;
                if (svc?.setToken) {
                  svc.setToken(tok);
                  return true;
                }
              }
            }
          }
          const parent = inj._parent ?? inj._injector;
          return walkAndInject(
            parent as typeof injector | null | undefined,
          );
        };

        const ok = walkAndInject(injector);
        if (!ok) {
          console.warn(
            '[E2E] AuthSessionService not found in injector chain. Build may not be in dev mode.',
          );
        } else {
          const rawPayload = tok.split('.')[1] ?? '';
          const info = rawPayload ? atob(rawPayload) : '?';
          console.info(`[E2E] Auth seeded: empresa=${empId} payload=${info}`);
        }
      } catch (err) {
        console.warn('[E2E] Error seeding auth session:', err);
      }
    },
    { tok: token, empId: empresaId },
  );
}

// ── Convenience presets ──────────────────────────────────────────────────────

/** Full PROJ access (proj:read + proj:write). */
export const SCOPES_PROJ_FULL  = ['proj:read', 'proj:write'] as const;
/** View-only PROJ access (proj:read only). */
export const SCOPES_PROJ_VIEW  = ['proj:read'] as const;
/** No PROJ access (no scopes at all). */
export const SCOPES_NO_PROJ    = [] as const;
