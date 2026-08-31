import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

/** Request-scoped principal produced by `JwtStrategy.validate`. */
export interface AuthenticatedUser {
  readonly userId: string;
  readonly username: string;
  readonly roles: string[];
  readonly scopes: string[];
  /** Resolved empresa slug — every repository call is scoped by it. */
  readonly empresaId: string;
}

export const IS_PUBLIC_KEY = 'isPublic';

/** Opts a route out of authentication (health checks, webhooks, docs). */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Bearer-token guard for cordele.
 *
 * Runs the `jwt` Passport strategy, honours `@Public()`, and resolves the
 * empresa from the JWT claim (with an `X-Tenant-Id` header override accepted
 * only for principals holding the `empresa-admin` role).
 *
 * Scope enforcement is delegated to `ScopeGuard` which must be registered
 * AFTER this guard in the APP_GUARD chain — SPEC-06 §2.
 *
 * Responses:
 *   401 — no token or expired/invalid token
 *   403 — valid token but cross-empresa override denied or no empresa claim
 *
 * @see src/infrastructure/comp/auth/scope.guard.ts
 * @see docs/architecture/backend/services/comp-service/spec/backend/SPEC-06-security.md
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  // `override` is required: AuthGuard('jwt') already declares canActivate, and
  // the generated tsconfig enables noImplicitOverride (TS4114).
  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const allowed = (await super.canActivate(context)) as boolean;
    if (!allowed) {
      return false;
    }

    const request = context.switchToHttp().getRequest<{
      user: AuthenticatedUser;
      headers: Record<string, string | string[] | undefined>;
    }>();

    request.user = this.resolveTenant(request.user, request.headers['x-tenant-id']);

    return true;
  }

  /**
   * Resolves the effective empresa from the JWT principal, optionally honouring
   * an `X-Tenant-Id` header (only when the principal holds `empresa-admin`).
   */
  private resolveTenant(
    user: AuthenticatedUser,
    header: string | string[] | undefined,
  ): AuthenticatedUser {
    const requested = Array.isArray(header) ? header[0] : header;

    if (requested && requested !== user.empresaId) {
      if (!user.roles.includes('empresa-admin')) {
        throw new ForbiddenException('Not allowed to act on behalf of another empresa');
      }
      return { ...user, empresaId: requested };
    }

    if (!user.empresaId) {
      throw new ForbiddenException('Token carries no empresa claim');
    }
    return user;
  }
}
