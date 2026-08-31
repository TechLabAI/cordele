import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

/**
 * Shape of the authenticated principal attached to `request.user` by
 * `JwtStrategy.validate` (infrastructure/auth/jwt.strategy.ts).
 *
 * Declared here so CompController stays RULE-04 compliant: modules/ does not
 * import infrastructure/ directly.  The fields must stay in sync with the
 * shape produced by the JWT strategy.
 */
export interface AuthenticatedUser {
  readonly userId: string;
  readonly username: string;
  readonly roles: string[];
  readonly scopes: string[];
  /** Resolved empresa slug — every repository call is scoped by it. */
  readonly empresaId: string;
}

/**
 * Parameter decorator that injects the authenticated principal into a
 * controller handler.
 *
 * Lives in modules/comp/decorators/ so CompController can use it without
 * importing from infrastructure/ (RULE-04 compliance).
 *
 * Usage:
 * ```ts
 * async myHandler(@CurrentUser() user: AuthenticatedUser) { ... }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!request.user) {
      throw new UnauthorizedException('No authenticated principal on request');
    }
    return request.user;
  },
);
