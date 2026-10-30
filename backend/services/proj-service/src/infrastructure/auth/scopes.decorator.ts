import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key used by `ScopesGuard` to read the OAuth2 scopes required for
 * a route.
 *
 * Intentionally different from `REQUIRED_SCOPES_KEY` used by `JwtAuthGuard`
 * (which reads `@RequiredScopes()` from `modules/proj/decorators/`): the two
 * keys can coexist without conflict. When both guards are stacked via
 * `@UseGuards(JwtAuthGuard, ScopesGuard)`, each reads its own metadata key.
 */
export const SCOPES_KEY = 'scopes';

/**
 * Decorator that declares the OAuth2 scopes required to access a route.
 *
 * Read by `ScopesGuard` (`infrastructure/auth/scopes.guard.ts`) after JWT
 * authentication succeeds. If the principal's `scope` claim does not include
 * at least one of the listed scopes, `ScopesGuard` throws a `ForbiddenException`
 * (HTTP 403).
 *
 * **RULE-04 note:** controllers in `modules/proj/` should use `@RequiredScopes()`
 * from `modules/proj/decorators/require-scope.decorator.ts` instead of this
 * decorator — that keeps `modules/` free of `infrastructure/` imports. This
 * decorator is intended for use within `infrastructure/` or for guard composition
 * in the root `app.module.ts`.
 *
 * Example:
 * ```ts
 * \@Scopes('proj:read')
 * \@Get('projetos/:id')
 * findOne(...) {}
 * ```
 */
export const Scopes = (...scopes: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(SCOPES_KEY, scopes);
