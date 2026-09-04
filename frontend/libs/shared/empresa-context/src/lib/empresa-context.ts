/**
 * @cordele/shared/empresa-context — EmpresaContextService + empresaGuard.
 *
 * Responsibilities:
 *   - Expose the current empresa_id as a reactive signal (derived from JWT claim).
 *   - Provide `empresaGuard` to protect routes that require an active empresa.
 *   - Support empresa switching (triggers signal update; callers re-evaluate decisions).
 *
 * Multi-empresa contract (multi-empresa.md §3):
 *   - empresa_id is carried in the JWT claim `empresa_id`.
 *   - The FE NEVER sends `X-Empresa-Id` as a scoping authority; it is observability-only.
 *   - `EmpresaContextService` is the single source of truth for empresa_id on the FE.
 *
 * INT-FE-COMP-006: initial implementation wired to AuthSessionService.
 */
import { Injectable, NgZone, computed, inject, signal } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthSessionService } from '@cordele/shared/auth-session';

export interface EmpresaContext {
  readonly id: string | null;
}

/** Key written by the shell UI and e2e tests to persist the selected empresa. */
const EMPRESA_STORAGE_KEY = 'cordele_empresa_current';

@Injectable({ providedIn: 'root' })
export class EmpresaContextService {
  private readonly authSession = inject(AuthSessionService);
  private readonly ngZone      = inject(NgZone);

  /**
   * Manual override: set when the user explicitly selects an empresa via switchTo().
   * Null = derive from storage key or JWT claim.
   */
  private readonly _override = signal<string | null>(null);

  /**
   * Storage-backed empresa id: tracks `cordele_empresa_current` localStorage key.
   *
   * Initialised from localStorage at construction time; updated reactively via
   * StorageEvent so that e2e tests (and future multi-tab support) can change the
   * active empresa by writing to localStorage + dispatching a StorageEvent on window.
   *
   * Priority below _override; above JWT claim.
   */
  private readonly _storageEmpresaId = signal<string | null>(
    this.parseStorageEmpresaId(
      (() => { try { return localStorage.getItem(EMPRESA_STORAGE_KEY); } catch { return null; } })()
    )
  );

  /**
   * Current empresa_id.
   * Priority: manual override → localStorage key → JWT claim empresa_id → null.
   */
  readonly current = computed<string | null>(() => {
    const override = this._override();
    if (override !== null) return override;
    const storageId = this._storageEmpresaId();
    if (storageId !== null) return storageId;
    return this.authSession.claims?.empresa_id ?? null;
  });

  constructor() {
    // React to StorageEvent for EMPRESA_STORAGE_KEY.
    // This enables e2e tests to simulate empresa switching by calling:
    //   localStorage.setItem(EMPRESA_STORAGE_KEY, JSON.stringify({ id: '...' }));
    //   window.dispatchEvent(new StorageEvent('storage', { key: EMPRESA_STORAGE_KEY, newValue: '...' }));
    // It also enables multi-tab support — when another tab switches empresa, this tab reacts.
    // Wrapped in try/catch for SSR compatibility.
    try {
      window.addEventListener('storage', (evt: StorageEvent) => {
        if (evt.key !== EMPRESA_STORAGE_KEY) return;
        const id = this.parseStorageEmpresaId(evt.newValue);
        // NgZone.run() ensures Angular's change detection triggers after the signal update.
        this.ngZone.run(() => this._storageEmpresaId.set(id));
      });
    // eslint-disable-next-line no-restricted-syntax -- SSR / sandboxed iframe: window.addEventListener is unavailable; silence is correct and no alternative exists
    } catch {
      // SSR or sandboxed iframe — window not available.
    }
  }

  currentId(): string | null {
    return this.current();
  }

  /**
   * Switch the active empresa programmatically (highest priority).
   * Triggers re-evaluation of all computed signals that depend on `current`.
   * Callers must cancel in-flight requests and re-hydrate their state.
   */
  switchTo(empresaId: string): void {
    this._override.set(empresaId);
  }

  /**
   * Clear the manual override — reverts to storage-key or JWT-derived empresa.
   */
  clearOverride(): void {
    this._override.set(null);
  }

  /**
   * Parse empresa_id from the `cordele_empresa_current` localStorage value.
   * The stored value is JSON: `{ id: string, nome: string, schema: string }`.
   * Returns null if the value is absent, malformed, or lacks an `id` field.
   */
  private parseStorageEmpresaId(value: string | null): string | null {
    if (!value) return null;
    try {
      const parsed = JSON.parse(value) as { id?: unknown };
      return typeof parsed.id === 'string' ? parsed.id : null;
    } catch {
      return null;
    }
  }
}

/**
 * empresaGuard — blocks COMP routes when no active empresa is set.
 * Source: @cordele/shared/empresa-context (SPEC-01 §3 / INT-FE-COMP-006).
 *
 * An active empresa is required to scope all COMP API calls server-side.
 * The guard does NOT set the empresa; it only verifies that one is set.
 */
export const empresaGuard: CanActivateFn = () => {
  const ctx = inject(EmpresaContextService);
  const router = inject(Router);
  const empresaId = ctx.current();
  if (empresaId !== null) return true;
  // No active empresa → redirect to projeto list (safe fallback)
  return router.createUrlTree(['/proj/biblioteca-de-projetos']);
};
