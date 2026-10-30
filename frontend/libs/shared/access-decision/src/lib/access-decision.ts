/**
 * @cordele/shared/access-decision — AccessDecisionService + authGuard + accessGuard.
 *
 * Responsibilities:
 *   - Evaluate permissions (can/view) from JWT scopes.
 *   - Evaluate feature flags (hasFlag) from registered module flags + runtime overrides.
 *   - Provide `authGuard` (valid session) and `accessGuard(perm)` (scope check).
 *
 * Access-layer-contracts.md:
 *   - Components NEVER test roles directly — always via AccessDecisionService.can(perm).
 *   - Permissions map FE perm keys (e.g. 'comp.view') to BE scopes (e.g. 'comp:read').
 *   - Feature flags default to 'on' unless explicitly disabled at runtime.
 *
 * INT-FE-COMP-005: initial implementation reading scopes from JWT claims.
 */
import { Injectable, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthSessionService } from '@cordele/shared/auth-session';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface AccessDecision {
  can(permission: string): boolean;
}

export interface PermissionEntry {
  readonly beScope: string;
}

export type PermissionMap = Record<string, PermissionEntry>;
export type FeatureFlagMap = Record<string, boolean>;

// ── Service ───────────────────────────────────────────────────────────────────

@Injectable({ providedIn: 'root' })
export class AccessDecisionService implements AccessDecision {
  private readonly authSession = inject(AuthSessionService);

  /**
   * Registered FE→BE permission mapping (populated by module bootstraps).
   * e.g. { 'comp.view': { beScope: 'comp:read' } }
   */
  private readonly _permissionMap = signal<PermissionMap>({});

  /**
   * Runtime feature flags (module defaults merged with server overrides).
   * null = not registered → treated as 'on' by default.
   */
  private readonly _flags = signal<FeatureFlagMap>({});

  /** Derived scopes from current session claims — reactive. */
  private readonly _scopes = computed<string[]>(
    () => this.authSession.claims?.scopes ?? [],
  );

  // ── Registration ──────────────────────────────────────────────────────────

  /**
   * Register a module's permission map.
   * Called once at module bootstrap (e.g. COMP_PERMISSION_MAP).
   */
  registerPermissions(map: PermissionMap): void {
    this._permissionMap.update(current => ({ ...current, ...map }));
  }

  /**
   * Register a module's feature flags with their default states.
   * Called once at module bootstrap.
   */
  registerFlags(flags: Record<string, { defaultState: 'on' | 'off' }>): void {
    const resolved: FeatureFlagMap = {};
    for (const [key, entry] of Object.entries(flags)) {
      resolved[key] = entry.defaultState === 'on';
    }
    this._flags.update(current => ({ ...current, ...resolved }));
  }

  /**
   * Override a feature flag at runtime (e.g. from server-side configuration).
   */
  setFlag(flag: string, enabled: boolean): void {
    this._flags.update(current => ({ ...current, [flag]: enabled }));
  }

  // ── Evaluation ────────────────────────────────────────────────────────────

  /**
   * Evaluate a FE permission key.
   * Resolves the BE scope via the registered permission map and checks against JWT scopes.
   *
   * @example can('comp.view') → checks JWT has 'comp:read' scope
   */
  can(permission: string): boolean {
    if (!this.authSession.isAuthenticated) return false;
    const entry = this._permissionMap()[permission];
    if (!entry) {
      // Unknown permission — deny by default (fail-closed)
      return false;
    }
    const scopes = this._scopes();
    return scopes.includes(entry.beScope);
  }

  /**
   * Evaluate a feature flag.
   * Returns true (on) if the flag is enabled or not registered (default: on).
   */
  hasFlag(flag: string): boolean {
    const flags = this._flags();
    // Default to true if not explicitly registered
    return flags[flag] !== false;
  }

  /**
   * Check whether the current session is authenticated (token present + not expired).
   */
  hasSession(): boolean {
    return this.authSession.isAuthenticated;
  }
}

// ── Guards ────────────────────────────────────────────────────────────────────

/**
 * authGuard — blocks routes when no valid session is present.
 * Source: @cordele/shared/access-decision (SPEC-01 §3 / INT-FE-COMP-001).
 */
export const authGuard: CanActivateFn = () => {
  const svc = inject(AccessDecisionService);
  const router = inject(Router);
  return svc.hasSession() ? true : router.createUrlTree(['/login']);
};

/**
 * accessGuard — factory guard that checks a named permission.
 * Source: @cordele/shared/access-decision (SPEC-01 §3 / INT-FE-COMP-005).
 *
 * @example canActivate: [accessGuard('comp.view')]
 */
export function accessGuard(permission: string): CanActivateFn {
  return () => {
    const svc = inject(AccessDecisionService);
    const router = inject(Router);
    if (svc.can(permission)) return true;
    // Authenticated but lacks permission → access-denied
    return svc.hasSession()
      ? router.createUrlTree(['/acesso-negado'])
      : router.createUrlTree(['/login']);
  };
}
