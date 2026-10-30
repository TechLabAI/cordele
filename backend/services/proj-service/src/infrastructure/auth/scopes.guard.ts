import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { SCOPES_KEY } from './scopes.decorator';

/** Minimal interface for the request principal shape set by `JwtStrategy`. */
interface RequestPrincipal {
  readonly scopes?: string[];
}

/**
 * Guard that enforces OAuth2 scope requirements declared via `@Scopes()`.
 *
 * Must run **after** `JwtAuthGuard` (or any equivalent authentication guard)
 * has populated `request.user`. When composed via
 * `@UseGuards(JwtAuthGuard, ScopesGuard)`, the order is guaranteed by NestJS.
 *
 * Behaviour:
 *   - No `@Scopes()` metadata on the handler or class → always passes (open).
 *   - Principal holds at least one required scope → passes (200/2xx).
 *   - Principal lacks all required scopes → throws `ForbiddenException` (403).
 *
 * Note: `JwtAuthGuard` (registered globally via `APP_GUARD`) already performs
 * inline scope enforcement via `@RequiredScopes()` / `REQUIRED_SCOPES_KEY`.
 * `ScopesGuard` provides the same capability bound to the `@Scopes()` metadata
 * key, satisfying PROJ-014 checklist item 2 for a standalone, independently
 * testable guard class.
 */
@Injectable()
export class ScopesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(SCOPES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No scope restriction declared → open route.
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ user?: RequestPrincipal }>();
    const userScopes: string[] = request.user?.scopes ?? [];

    const hasScope = required.some((s) => userScopes.includes(s));
    if (!hasScope) {
      throw new ForbiddenException({
        statusCode: 403,
        message: `Access denied. Required one of: ${required.join(', ')}`,
        type: 'urn:cordele:proj:forbidden',
      });
    }

    return true;
  }
}
