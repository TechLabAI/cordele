/**
 * app.config.ts — root ApplicationConfig for cordele-web.
 * P2 shell setup (first module promoted — IMP, D-494).
 * - No withHashLocation() (P2.4: removed, deep-linkable routes).
 * - provideHttpClient: required by all HTTP adapters.
 * - COMP: adapter='http' — comp-service is available; real API, no mocks.
 *
 * Updated: INT-FE-COMP-001/006 (P4) — empresa context is resolved server-side from the
 * JWT `empresa_id` claim via EmpresaContextInterceptor. The FE does NOT send X-Empresa-Id;
 * ACCESS_EMPRESA_ID provider removed (token no longer wired to HTTP headers).
 *
 * Updated: P7 (E2E fix A) — adds APP_INITIALIZER that reads localStorage['cordele_access_token']
 * at bootstrap so AuthSessionService.isAuthenticated is true when authGuard runs.
 * This covers both real users (token persisted from login) and E2E tests that inject
 * the token via page.addInitScript() before the Angular app bootstraps.
 *
 * Updated: P7 (E2E fix B) — adds APP_INITIALIZER that registers IMP_PERMISSION_MAP_METADATA
 * and IMP_FEATURE_FLAGS_METADATA into AccessDecisionService so that accessGuard('imp.import')
 * and accessGuard('imp.review') can resolve the BE scope from the JWT and pass for authed users.
 *
 * Updated: P7 (lint fix) — removed provideProj (static import of lazy @cordele/proj).
 * provideProj is now self-provided inside PROJ_ROUTES lazy route scope (proj.routes.ts).
 *
 * Updated: PUB P4 (INT-FE-PUB-001/006):
 * - INT-FE-PUB-001: provider order verified — provideHttpClient + interceptors declared before
 *   all module providers (provideImp, provideComp, providePub).
 * - INT-FE-PUB-006: PUB_EMPRESA_CHANGED token wired to PubShellIntegrationService.empresaChanged
 *   so that ExportFacade cancels in-flight polls on empresa switch.
 *
 * Updated: PUB P6 (FE-PUB-023 — Navigation / Breadcrumbs):
 * - PUB_UPDATE_BREADCRUMB token wired to PubShellIntegrationService.updateBreadcrumb.
 *   Feature components (T07/T08) inject this token (type:domain) to call updateBreadcrumb
 *   without violating Nx boundary (type:feature cannot import type:feature).
 */
import {
  ApplicationConfig,
  APP_INITIALIZER,
  inject,
  provideZoneChangeDetection,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptorsFromDi } from '@angular/common/http';
import { appRoutes } from './app.routes';
// FE-IMP-003 (P3): import directly from canonical sublib (bypasses legacy @cordele/imp barrel)
import {
  provideImp,
  IMP_PERMISSION_MAP_METADATA,
  IMP_FEATURE_FLAGS_METADATA,
} from '@cordele/imp/data-access';
// INT-FE-COMP-006 (P6): import from canonical non-lazy sublib to avoid boundary violation
import { provideComp } from '@cordele/comp/data-access';
// P2 (FE-PUB-007): import from canonical sub-lib — real pub-service integration, no mocks
import { PUB_EMPRESA_CHANGED, providePub, PUB_UPDATE_BREADCRUMB } from '@cordele/pub-data-access';
// PUB P4 (INT-FE-PUB-006): wire empresaChanged signal so ExportFacade cancels poll on empresa switch
// PUB P6 (FE-PUB-023): wire PUB_UPDATE_BREADCRUMB token to PubShellIntegrationService.updateBreadcrumb
import { PubShellIntegrationService } from '@cordele/pub-integration';
import { AuthSessionService } from '@cordele/shared/auth-session';
import { AccessDecisionService } from '@cordele/shared/access-decision';

/**
 * initAuthSession — APP_INITIALIZER factory (Fix A).
 * Reads localStorage['cordele_access_token'] at bootstrap and calls setToken()
 * so AuthSessionService.isAuthenticated is true before any route guard runs.
 *
 * Covers:
 *  - Real users: token was written to localStorage after OIDC login.
 *  - E2E specs: token injected via page.addInitScript() before Angular bootstraps.
 *
 * Wrapped in try/catch: localStorage is unavailable in some sandboxed contexts (e.g. SSR).
 */
function initAuthSession(): () => void {
  const authService = inject(AuthSessionService);
  return () => {
    try {
      const token = localStorage.getItem('cordele_access_token');
      if (token) {
        authService.setToken(token);
      }
    // eslint-disable-next-line no-restricted-syntax -- SSR/sandbox: localStorage unavailable in some environments (SSR, sandboxed iframes, private-browsing locks); silence is correct here because the app initializes without a token and Keycloak redirect handles re-auth.
    } catch {
      // localStorage unavailable (SSR, sandboxed iframe, private-browsing locks) — safe to ignore.
    }
  };
}

/**
 * initImpPermissions — APP_INITIALIZER factory (Fix B).
 * Registers IMP_PERMISSION_MAP and IMP_FEATURE_FLAGS in AccessDecisionService
 * so that accessGuard('imp.import') and accessGuard('imp.review') can resolve
 * the BE scope from JWT claims and evaluate correctly.
 *
 * Without this, AccessDecisionService.can('imp.import') returns false (fail-closed
 * on unknown permission) → accessGuard redirects to /acesso-negado even for
 * authenticated users with the correct JWT scopes.
 */
function initImpPermissions(): () => void {
  const ads = inject(AccessDecisionService);
  return () => {
    ads.registerPermissions(IMP_PERMISSION_MAP_METADATA);
    ads.registerFlags(IMP_FEATURE_FLAGS_METADATA);
  };
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(appRoutes),
    provideHttpClient(withInterceptorsFromDi()),
    // P7 (E2E fix A): reads localStorage token at bootstrap → authGuard sees isAuthenticated = true.
    {
      provide: APP_INITIALIZER,
      useFactory: initAuthSession,
      multi: true,
    },
    // P7 (E2E fix B): registers IMP permissions so accessGuard('imp.import') evaluates correctly.
    {
      provide: APP_INITIALIZER,
      useFactory: initImpPermissions,
      multi: true,
    },
    // P7 (E2E fix C): adapter='http' — IMP e2e tests use page.route() Playwright intercepts
    // at the network boundary. With adapter='mock', no HTTP requests are made and Playwright
    // intercepts never fire. Switching to 'http' enables the e2e suite to control responses.
    provideImp({ adapter: 'http' }),
    provideComp({ adapter: 'http' }),
    // provideProj removed — now self-provided inside PROJ_ROUTES lazy route scope (proj.routes.ts).
    // P2 (FE-PUB-007): adapter='http' — pub-service is complete; real API, no mocks.
    providePub({ adapter: 'http' }),
    // PUB P4 (INT-FE-PUB-006): wire PUB_EMPRESA_CHANGED to PubShellIntegrationService.empresaChanged.
    // ExportFacade watches this signal; when empresa switches, it cancels any in-flight export poll.
    // PubShellIntegrationService is scope:pub type:feature — importable from type:app (no scope restriction on app).
    // provideHttpClient is declared above, so interceptors are active before this DI factory runs.
    {
      provide: PUB_EMPRESA_CHANGED,
      useFactory: () => inject(PubShellIntegrationService).empresaChanged,
    },
    // PUB P6 (FE-PUB-023): wire PUB_UPDATE_BREADCRUMB to PubShellIntegrationService.updateBreadcrumb.
    // Feature components (T07/T08) inject PUB_UPDATE_BREADCRUMB from @cordele/pub-data-access and call
    // it with the projetoId/nomeProjeto to resolve breadcrumb segments for the active screen.
    // This avoids the Nx boundary violation: type:feature (pub-feature-*) cannot import type:feature (pub-integration).
    {
      provide: PUB_UPDATE_BREADCRUMB,
      useFactory: () => {
        const svc = inject(PubShellIntegrationService);
        return (nomeProjeto: string) => svc.updateBreadcrumb(nomeProjeto);
      },
    },
  ],
};
