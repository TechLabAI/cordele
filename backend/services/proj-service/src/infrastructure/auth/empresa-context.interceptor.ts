import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

import type { AuthenticatedUser } from './jwt-auth.guard';
import { EmpresaContextStore } from '../context/empresa.context';

/**
 * EmpresaContextInterceptor — populates `EmpresaContextStore` (tenant-routing
 * AsyncLocalStorage) with the verified empresa context for every authenticated request.
 *
 * ### Why an interceptor (not the guard)?
 *
 * `JwtAuthGuard.canActivate()` is an `async` method that calls
 * `await super.canActivate(context)` before resolving the tenant. The `await`
 * suspends execution and resumes on a Promise continuation — a NEW async resource
 * that is a child of the original request resource. Calling
 * `AsyncLocalStorage.enterWith()` at that point writes the store onto the child
 * resource's context, but NestJS dispatches the handler continuation from the
 * ORIGINAL request resource (the one that was never updated). The child and original
 * branches are parallel: `enterWith()` in the child is invisible to the handler.
 *
 * Empirical proof: `src/infrastructure/context/als-guard-propagation.spec.ts`,
 * scenario 5 (async guard + enterWith → 500) vs scenario 6 (interceptor +
 * store.run → 200). The guard path breaks; the interceptor path works.
 *
 * `AsyncLocalStorage.run(data, fn)` creates a NEW async scope and executes `fn`
 * — and everything `fn` awaits — within that scope. Calling `next.handle()` inside
 * `EmpresaContextStore.run()` ensures the full handler → use-case → repository call
 * chain runs inside the ALS scope and can read context via `getEditoraId()` / `getSlug()`.
 *
 * ### Context source / security
 *
 * `request.user` is set by `JwtAuthGuard.canActivate()` AFTER Passport's
 * `AuthGuard('jwt')` verifies the RS256/JWKS JWT signature and `resolveTenant`
 * applies the optional `x-tenant-id` header override. This interceptor runs AFTER
 * the guard (NestJS lifecycle: Middleware → Guard → Interceptor → Handler), so
 * `request.user.empresaId` is always from a cryptographically verified source
 * (RULE-07 compliant).
 *
 * Routes marked `@Public()` receive no `request.user`; the interceptor passes them
 * through without setting any ALS context.
 *
 * ### Registration
 *
 * Registered globally as `APP_INTERCEPTOR` in `AppModule` (composition root) so
 * every authenticated route gets empresa context without `ProjModule` importing
 * `infrastructure/` directly (RULE-04 compliant).
 *
 * @see src/infrastructure/context/empresa.context.ts
 * @see src/infrastructure/context/als-guard-propagation.spec.ts
 * @see docs/architecture/shared/multi-empresa.md
 */
@Injectable()
export class EmpresaContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const empresaId = request.user?.empresaId;

    // Public routes (health, metrics) carry no authenticated user — pass through.
    if (!empresaId) {
      return next.handle();
    }

    // Wrap the handler's Observable inside an EmpresaContextStore.run() scope.
    // Everything that runs within fn (handler, use-cases, adapters) sees the context
    // via EmpresaContextStore.getEditoraId() / getSlug().
    return new Observable((observer) => {
      EmpresaContextStore.run(
        { editoraId: empresaId, slug: empresaId },
        () => {
          next.handle().subscribe({
            next: (v) => observer.next(v),
            error: (e) => observer.error(e),
            complete: () => observer.complete(),
          });
        },
      );
    });
  }
}
