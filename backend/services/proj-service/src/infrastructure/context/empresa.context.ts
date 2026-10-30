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
 * ### Wiring (interceptor-based — EmpresaContextInterceptor)
 * `EmpresaContextInterceptor` (registered as `APP_INTERCEPTOR` in `AppModule`)
 * calls `EmpresaContextStore.run({ editoraId, slug }, fn)` where `fn` subscribes
 * to `next.handle()`. This ensures every handler, use-case, and adapter running
 * within that Observable chain sees the correct empresa context.
 *
 * The guard (`JwtAuthGuard`) does NOT call `enterWith()` because doing so after
 * `await super.canActivate()` would write the store onto an async-child resource
 * that is invisible to the handler's continuation. Empirical proof and
 * explanation in `src/infrastructure/context/als-guard-propagation.spec.ts`
 * (scenario 5 — broken, vs scenario 6 — working).
 *
 * ### API
 * - `EmpresaContextStore.run(data, fn)` — wrap a callback (interceptor / tests)
 * - `EmpresaContextStore.enterWith(data)` — set in current async context (sync guards only; not used in production)
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
          'Ensure EmpresaContextInterceptor is registered as APP_INTERCEPTOR in AppModule ' +
          'and that the route is authenticated (JwtAuthGuard must set request.user first).',
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
