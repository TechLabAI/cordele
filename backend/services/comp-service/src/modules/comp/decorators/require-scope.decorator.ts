import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key shared between `RequiredScopes` and `JwtAuthGuard`.
 *
 * IMPORTANT: must stay in sync with `REQUIRED_SCOPES_KEY` in
 * `src/infrastructure/comp/auth/scope.guard.ts`.  Both files use the same
 * string literal so that the guard and the decorator cooperate without
 * either layer importing the other (RULE-04).
 */
export const REQUIRED_SCOPES_KEY = 'requiredScopes';

/**
 * Declares the OAuth2 scopes required to access a route.
 *
 * `JwtAuthGuard` (registered as `APP_GUARD` in `app.module.ts`) reads this
 * metadata and enforces it after JWT validation.  If the principal's `scope`
 * claim does not include at least one of the listed scopes, a
 * `ForbiddenException` (403) is thrown.
 *
 * Lives in `modules/comp/decorators/` so `CompController` can use it without
 * importing from `infrastructure/` (RULE-04 compliance).
 *
 * Example:
 * ```ts
 * \@RequiredScopes('comp:write')
 * \@Put('metadados')
 * updateMetadados(...) {}
 * ```
 */
export const RequiredScopes = (...scopes: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_SCOPES_KEY, scopes);
