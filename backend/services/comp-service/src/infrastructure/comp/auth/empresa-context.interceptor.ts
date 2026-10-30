import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';

import type { AuthenticatedUser } from './jwt-auth.guard';
import { PrismaEmpresaService } from '../../persistence/prisma-empresa.service';

/**
 * EmpresaContextInterceptor — populates `PrismaEmpresaService.store` (tenant-routing
 * AsyncLocalStorage) with the verified empresa slug for every authenticated request.
 *
 * ### Why an interceptor (not the guard or middleware)?
 *
 * `JwtAuthGuard.canActivate()` is an `async` method that calls
 * `await super.canActivate(context)` before resolving the tenant. The `await`
 * suspends execution and resumes on a Promise continuation — a NEW async resource
 * (child of the original request resource). Calling `AsyncLocalStorage.enterWith()`
 * at that point writes the store onto the child resource's context, but NestJS
 * dispatches the handler continuation from the ORIGINAL request resource — a
 * parallel branch that was never updated. A synchronous guard would propagate
 * correctly; the `await` is what breaks it.
 *
 * Empirical proof: `proj-service/src/infrastructure/context/als-guard-propagation.spec.ts`,
 * scenario 5 (async guard + enterWith → HTTP 500) vs scenario 6 (interceptor +
 * store.run → HTTP 200).
 *
 * `AsyncLocalStorage.run(slug, fn)`, by contrast, creates a NEW async scope and
 * executes `fn` — and everything `fn` awaits — within that scope. Calling
 * `next.handle()` inside `runWithSlug` ensures the full handler → use-case →
 * repository call chain runs inside the ALS scope and sees the correct slug via
 * `PrismaEmpresaService.getCurrentSlug()`.
 *
 * ### Slug source / security
 *
 * `request.user.empresaId` is set by `JwtAuthGuard.canActivate()` AFTER Passport's
 * `AuthGuard('jwt')` verifies the RS256/JWKS JWT signature. This interceptor runs
 * AFTER the guard (NestJS lifecycle: Middleware → Guard → Interceptor → Handler), so
 * the slug is always from a cryptographically verified source (RULE-07 compliant).
 *
 * Routes marked `@Public()` receive no `request.user`; the interceptor passes them
 * through without touching the ALS.
 *
 * ### Registration
 *
 * Registered globally as `APP_INTERCEPTOR` in `AppModule` (composition root) so
 * every authenticated route gets tenant context without `CompModule` importing
 * `infrastructure/` directly (RULE-04 compliant).
 *
 * @see src/infrastructure/persistence/prisma-empresa.service.ts
 * @see docs/architecture/shared/multi-empresa.md
 */
@Injectable()
export class EmpresaContextInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const slug = request.user?.empresaId;

    // Public routes (health, metrics) carry no authenticated user — pass through.
    if (!slug) {
      return next.handle();
    }

    // Wrap the handler's Observable inside a runWithSlug scope.
    // `runWithSlug` validates the slug before entering — throws immediately on
    // invalid slug (never falls back to a default schema).
    return new Observable((observer) => {
      PrismaEmpresaService.runWithSlug(slug, () => {
        next.handle().subscribe({
          next: (v) => observer.next(v),
          error: (e) => observer.error(e),
          complete: () => observer.complete(),
        });
      });
    });
  }
}
