import { AsyncLocalStorage } from 'async_hooks';

/**
 * Shape of the data stored in the AsyncLocalStorage context per request.
 *
 * Populated by `JwtAuthGuard.handleRequest()` (after JWT validation succeeds)
 * so downstream repository calls can resolve the Postgres schema without
 * threading `empresaId` through every method signature.
 */
export interface EmpresaContextData {
  /** Schema slug that maps to a Postgres schema (e.g. 'aetos' → emp_aetos). */
  readonly slug: string;
  /** editoraId / empresaId extracted from the JWT `empresa_id` claim. */
  readonly editoraId: string;
}

const _storage = new AsyncLocalStorage<EmpresaContextData>();

/**
 * AsyncLocalStorage singleton that carries the active empresa context for the
 * duration of a request (and all async continuations within it).
 *
 * ### Wiring (guard-based, P9 / PROJ-014)
 * `JwtAuthGuard.canActivate()` calls `EmpresaContextStore.enterWith()` after
 * resolving the tenant from the JWT claim. This sets the store on the current
 * async resource so handlers and repositories see it without explicit arguments.
 *
 * ### API
 * - `EmpresaContextStore.run(data, fn)` — wrap a callback (middleware / tests)
 * - `EmpresaContextStore.enterWith(data)` — set in current async context (guards)
 * - `EmpresaContextStore.getEditoraId()` — read editoraId; throws outside context
 * - `EmpresaContextStore.getSlug()` — read slug; throws outside context
 *
 * ### RULE compliance
 * This file is in `infrastructure/` and may import Node built-ins only. It does
 * NOT import `@nestjs/*` or `@prisma/client` so it can be loaded by test helpers
 * and scripts without the full Nest runtime.
 */
export const EmpresaContextStore = {
  /**
   * Runs `fn` inside a new ALS context seeded with `data`.
   * All async operations started within `fn` will see `data` via `getStore()`.
   * Preferred for middleware and test helpers where a callback boundary exists.
   */
  run<T>(data: EmpresaContextData, fn: () => T): T {
    return _storage.run(data, fn);
  },

  /**
   * Transitions the _current_ async resource to use `data` as the ALS store.
   * Unlike `run()`, no callback is needed — all subsequent async continuations
   * from this point forward (including NestJS handler dispatch after the guard
   * returns `true`) will see `data`.
   *
   * Used by `JwtAuthGuard.canActivate()` after tenant resolution.
   */
  enterWith(data: EmpresaContextData): void {
    _storage.enterWith(data);
  },

  /**
   * Returns the `editoraId` of the empresa active in the current async context.
   *
   * @throws {Error} When called outside a populated ALS context (missing guard /
   *   middleware wiring). Callers that cannot guarantee context presence should
   *   call `tryGetEditoraId()` instead.
   */
  getEditoraId(): string {
    const store = _storage.getStore();
    if (!store) {
      throw new Error(
        'EmpresaContextStore.getEditoraId() invoked outside an AsyncLocalStorage context. ' +
          'Ensure JwtAuthGuard (or EmpresaContextMiddleware for legacy routes) ' +
          'calls EmpresaContextStore.enterWith() before the handler runs.',
      );
    }
    return store.editoraId;
  },

  /**
   * Returns the `slug` of the empresa active in the current async context.
   *
   * @throws {Error} When called outside a populated ALS context.
   */
  getSlug(): string {
    const store = _storage.getStore();
    if (!store) {
      throw new Error(
        'EmpresaContextStore.getSlug() invoked outside an AsyncLocalStorage context.',
      );
    }
    return store.slug;
  },

  /**
   * Returns the `editoraId` or `undefined` when outside a context.
   * Safe to call from code that may or may not run within a request scope
   * (e.g. startup probes, health checks).
   */
  tryGetEditoraId(): string | undefined {
    return _storage.getStore()?.editoraId;
  },
};
