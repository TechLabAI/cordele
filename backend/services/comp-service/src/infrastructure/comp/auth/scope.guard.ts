import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Metadata key shared between `@RequiredScopes` decorator and `ScopeGuard`.
 *
 * Must stay in sync with `REQUIRED_SCOPES_KEY` in
 * `src/modules/comp/decorators/require-scope.decorator.ts`.
 * Both files use the same string literal so that the guard and the decorator
 * cooperate without either importing the other (RULE-04 / RULE-05).
 */
export const REQUIRED_SCOPES_KEY = 'requiredScopes';

/**
 * Guard that enforces OAuth2 scope requirements declared via `@RequiredScopes`.
 *
 * Must be registered AFTER `JwtAuthGuard` in the guard chain (either via
 * `@UseGuards(JwtAuthGuard, ScopeGuard)` or as a second `APP_GUARD` entry
 * placed after `JwtAuthGuard`) so that `request.user` is already populated
 * when this guard runs.
 *
 * Scope-matching is disjunctive: the principal must hold AT LEAST ONE of the
 * declared scopes. A route decorated with `@RequiredScopes('comp:write')` is
 * accessible to any token that includes `comp:write` in its `scope` claim.
 *
 * Responses:
 *   403 — valid JWT but token does not carry any of the required scopes
 *
 * No-op when `@RequiredScopes()` metadata is absent from the handler and its
 * class (unprotected routes — use `@Public()` to skip JwtAuthGuard entirely).
 *
 * @see src/infrastructure/comp/auth/jwt-auth.guard.ts
 * @see docs/architecture/backend/services/comp-service/spec/backend/SPEC-06-security.md
 */
@Injectable()
export class ScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      REQUIRED_SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // No scope restriction declared — allow through.
    if (!required || required.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: { scopes: string[] };
    }>();

    // Guard runs after JwtAuthGuard; request.user should always be populated here.
    // Defensive check for misconfigured guard ordering.
    if (!request.user) {
      throw new UnauthorizedException('No authenticated principal on request');
    }

    const hasScope = required.some((s) => request.user!.scopes.includes(s));
    if (!hasScope) {
      throw new ForbiddenException(
        `Insufficient scope. Required one of: ${required.join(', ')}`,
      );
    }

    return true;
  }
}
