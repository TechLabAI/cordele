/**
 * @cordele/shared/access-http-base — AccessHttpClient base HTTP client.
 * D-328/FE-4: flesh-out in execute cycle (P2).
 *
 * All module-level HTTP clients (ImpHttpClient, etc.) MUST extend AccessHttpClient.
 * Never use HttpClient directly in module adapters — RULE-NX-05.
 *
 * Empresa context is resolved server-side exclusively from the `empresa_id` claim
 * in the JWT (via EmpresaContextInterceptor). The FE does NOT send X-Empresa-Id;
 * the backend never reads it from FE requests. See docs/architecture/shared/multi-empresa.md.
 */
import { HttpClient, HttpResponse } from '@angular/common/http';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Versioned API base path for all Cordelê backend endpoints.
 *
 * Every Cordelê service runs:
 *   app.setGlobalPrefix('api')
 *   app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
 * which puts every route under /api/v1/<mod>/...
 * The un-versioned path /api/<mod>/... returns 404 — it does NOT exist.
 *
 * Verified against running containers (2026-09):
 *   GET /api/v1/imp/manuscripts/x → 401 (route exists, auth required)
 *   GET /api/imp/manuscripts/x   → 404 (route absent)
 *
 * Do NOT simplify this back to '/api' — the /v1 segment is load-bearing.
 */
export const ACCESS_HTTP_BASE = '/api/v1';

/**
 * Build the canonical base path for a Cordelê backend module.
 * Derives from ACCESS_HTTP_BASE so the /v1 prefix lives in exactly one place.
 *
 * @example moduleBase('pub')  → '/api/v1/pub'
 * @example moduleBase('proj') → '/api/v1/proj'
 *
 * All module adapters and guards MUST use this function instead of hardcoding the prefix.
 */
export function moduleBase(mod: 'imp' | 'comp' | 'pub' | 'proj'): string {
  return `${ACCESS_HTTP_BASE}/${mod}`;
}

/**
 * Injection token for the current empresa identifier.
 *
 * This token carries the empresa_id resolved from the JWT claim via EmpresaContextService.
 * It is kept as a stable export for potential future observability/telemetry use
 * (e.g. injecting into request telemetry interceptors), but it is NOT wired to any
 * HTTP request header — the server resolves empresa context exclusively from the JWT claim.
 *
 * Multi-empresa contract: empresa switching emits a new JWT with the updated `empresa_id`
 * claim. The FE never needs to send empresa identity via a request header.
 *
 * Default factory returns null (no-op when not provided).
 */
export const ACCESS_EMPRESA_ID = new InjectionToken<string | null>('ACCESS_EMPRESA_ID', {
  providedIn: 'root',
  factory: () => null,
});

/**
 * AccessHttpClient — base HTTP client for Cordelê modules.
 *
 * Provides typed get/post/delete/patch/put methods with consistent options signature.
 * Extend this class (never inject HttpClient directly) in module-level HTTP clients.
 *
 * Authorization: the Angular app attaches the JWT via an HTTP interceptor (withInterceptorsFromDi).
 * Empresa isolation: resolved server-side from the JWT `empresa_id` claim — no custom header needed.
 *
 * @example
 * // In imp-data-access:
 * @Injectable({ providedIn: 'root' })
 * export class ImpHttpClient extends AccessHttpClient {}
 */
@Injectable({ providedIn: 'root' })
export class AccessHttpClient {
  protected readonly http = inject(HttpClient);

  /** GET — emits a single typed response (body only). */
  get<T>(url: string): Observable<T> {
    return this.http.get<T>(url);
  }

  /**
   * GET with full HTTP response — emits `HttpResponse<T>` so callers can read
   * response headers (e.g. `X-Degraded`) while carrying the Authorization JWT.
   * Use when a response header drives business logic (api-contract §3).
   */
  getResponse<T>(url: string): Observable<HttpResponse<T>> {
    return this.http.get<T>(url, { observe: 'response' });
  }

  /**
   * POST — typed response body.
   * body accepts any value including FormData (browser sets Content-Type/boundary).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  post<T>(url: string, body: any): Observable<T> {
    return this.http.post<T>(url, body);
  }

  /** DELETE — returns raw response (callers pipe map(() => undefined) for void). */
  delete(url: string): Observable<unknown> {
    return this.http.delete(url);
  }

  /** PUT — typed response body. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  put<T>(url: string, body: any): Observable<T> {
    return this.http.put<T>(url, body);
  }

  /** PATCH — typed response body. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patch<T>(url: string, body: any): Observable<T> {
    return this.http.patch<T>(url, body);
  }
}
