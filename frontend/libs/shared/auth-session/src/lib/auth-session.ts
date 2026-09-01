/**
 * @cordele/shared/auth-session — AuthSessionService (POC implementation).
 * Manages the JWT session state: token, decoded claims, expiry.
 *
 * POC: stores the token in memory (signal). A full OIDC implementation
 * replaces setToken/clearSession with OIDC callbacks.
 *
 * Claims read from the JWT payload (base64url-decoded, no signature validation on FE):
 *   - sub: user identifier
 *   - empresa_id: current empresa (used by EmpresaContextService)
 *   - scopes: space-separated list of BE scopes (e.g. "comp:read comp:write")
 *   - exp: expiry timestamp (seconds)
 */
import { Injectable, signal } from '@angular/core';

export interface JwtClaims {
  readonly sub: string;
  readonly empresa_id: string | null;
  readonly scopes: string[];
  readonly exp: number;
  readonly roles: string[];
}

export interface AuthSession {
  readonly token: string | null;
  readonly claims: JwtClaims | null;
  readonly isExpired: boolean;
}

function decodeJwtPayload(token: string): JwtClaims | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    return {
      sub: payload['sub'] ?? '',
      empresa_id: payload['empresa_id'] ?? null,
      scopes: typeof payload['scope'] === 'string' ? payload['scope'].split(' ').filter(Boolean) : [],
      exp: payload['exp'] ?? 0,
      roles: Array.isArray(payload['roles']) ? payload['roles'] : [],
    };
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthSessionService {
  private readonly _session = signal<AuthSession>({ token: null, claims: null, isExpired: false });

  readonly session = this._session.asReadonly();

  get token(): string | null {
    return this._session().token;
  }

  get claims(): JwtClaims | null {
    return this._session().claims;
  }

  get isAuthenticated(): boolean {
    const s = this._session();
    if (!s.token || !s.claims) return false;
    return !s.isExpired;
  }

  setToken(token: string): void {
    const claims = decodeJwtPayload(token);
    const isExpired = claims ? (claims.exp * 1000 < Date.now()) : true;
    this._session.set({ token, claims, isExpired });
  }

  clearSession(): void {
    this._session.set({ token: null, claims: null, isExpired: false });
  }
}
