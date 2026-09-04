/**
 * @cordele/shared/access-http-base — AccessHttpClient + X-Empresa-Id wiring.
 * D-328/FE-4: flesh-out in execute cycle (P2).
 *
 * All module-level HTTP clients (ImpHttpClient, etc.) MUST extend AccessHttpClient.
 * Never use HttpClient directly in module adapters — RULE-NX-05.
 *
 * X-Empresa-Id header: added automatically when ACCESS_EMPRESA_ID is provided.
 * Default: null (safe for auth-only environments; override in app providers).
 */
import { HttpClient, HttpHeaders } from '@angular/common/http';
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
 * Set this in each app's providers to enable X-Empresa-Id on every request.
 * Default factory returns null (no header sent).
 *
 * @example
 * // In app.config.ts:
 * { provide: ACCESS_EMPRESA_ID, useFactory: () => empresaContextService.currentId() }
 */
export const ACCESS_EMPRESA_ID = new InjectionToken<string | null>('ACCESS_EMPRESA_ID', {
  providedIn: 'root',
  factory: () => null,
});

/**
 * AccessHttpClient — base HTTP client for Cordelê modules.
 *
 * - Adds `X-Empresa-Id` header on every request when empresa context is set.
 * - Provides typed get/post/delete/patch methods with consistent options signature.
 * - Extend this class (never inject HttpClient directly) in module-level HTTP clients.
 *
 * @example
 * // In imp-data-access:
 * @Injectable({ providedIn: 'root' })
 * export class ImpHttpClient extends AccessHttpClient {}
 */
@Injectable({ providedIn: 'root' })
export class AccessHttpClient {
  protected readonly http = inject(HttpClient);
  private readonly empresaId = inject(ACCESS_EMPRESA_ID);

  /** Build headers with X-Empresa-Id when available. */
  protected empresaHeaders(): HttpHeaders {
    return this.empresaId
      ? new HttpHeaders({ 'X-Empresa-Id': this.empresaId })
      : new HttpHeaders();
  }

  /** GET — emits a single typed response. */
  get<T>(url: string): Observable<T> {
    return this.http.get<T>(url, { headers: this.empresaHeaders() });
  }

  /**
   * POST — typed response body.
   * body accepts any value including FormData (browser sets Content-Type/boundary).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  post<T>(url: string, body: any): Observable<T> {
    return this.http.post<T>(url, body, { headers: this.empresaHeaders() });
  }

  /** DELETE — returns raw response (callers pipe map(() => undefined) for void). */
  delete(url: string): Observable<unknown> {
    return this.http.delete(url, { headers: this.empresaHeaders() });
  }

  /** PUT — typed response body. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  put<T>(url: string, body: any): Observable<T> {
    return this.http.put<T>(url, body, { headers: this.empresaHeaders() });
  }

  /** PATCH — typed response body. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  patch<T>(url: string, body: any): Observable<T> {
    return this.http.patch<T>(url, body, { headers: this.empresaHeaders() });
  }
}
