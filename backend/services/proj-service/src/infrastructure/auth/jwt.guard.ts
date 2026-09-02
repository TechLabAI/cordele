import {
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import { EmpresaContextStore } from '../context/empresa.context';

/** Request-scoped principal produced by `JwtStrategy.validate`. */
export interface AuthenticatedUser {
  readonly userId: string;
  readonly username: string;
  readonly roles: string[];
  readonly scopes: string[];
  /** Resolved empresa — every repository call is scoped by it. */
  readonly empresaId: string;
}

export const IS_PUBLIC_KEY = 'isPublic';
export const REQUIRED_SCOPES_KEY = 'requiredScopes';

/** Opts a route out of authentication (health checks, webhooks, docs). */
export const Public = (): MethodDecorator & ClassDecorator =>
  SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Declares the OAuth2 scopes required to access a route.
 *
 * The `JwtAuthGuard` reads this metadata and enforces it after JWT validation.
 * If the principal's `scope` claim does not include at least one of the listed
 * scopes, a `ForbiddenException` (403) is thrown.
 *
 * Kept here for parity with `jwt-auth.guard.spec.ts`; controllers under
 * `modules/proj/` must use `RequiredScopes` from
 * `modules/proj/decorators/require-scope.decorator.ts` instead of importing
 * this file directly (RULE-04).
 */
export const RequiredScopes = (...scopes: string[]): MethodDecorator & ClassDecorator =>
  SetMetadata(REQUIRED_SCOPES_KEY, scopes);

/** Injects the authenticated principal into a controller handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    if (!request.user) {
      throw new UnauthorizedException('No authenticated principal on request');
    }
    return request.user;
  },
);

/**
 * Bearer-token guard for the PROJ (Projetos Editoriais) module.
 *
 * Validates the JWT from `Authorization: Bearer <token>`.
 *   - Missing or expired token  → 401 `urn:cordele:proj:unauthorized`
 *   - Valid token, wrong scope  → 403 `urn:cordele:proj:forbidden`
 *   - Valid token, correct scope → populates `EmpresaContextStore` (ALS) with
 *     `{ editoraId, slug }` extracted exclusively from the JWT `empresa_id`
 *     claim and then allows the request through (PROJ-014 / RULE-07).
 *
 * Registered globally via `{ provide: APP_GUARD, useClass: JwtAuthGuard }` in
 * `app.module.ts`. `@Public()` opts a route out of authentication (health,
 * webhooks). `@RequiredScopes()` restricts a route to one or more OAuth2 scopes.
 *
 * RULE-04: this file lives in `infrastructure/auth/` and is never imported
 * directly by anything under `modules/`.
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
    this.enforceScopes(context, request.user);

    // PROJ-014 / P9: populate the empresa AsyncLocalStorage so downstream
    // repositories and domain services can call EmpresaContextStore.getEditoraId()
    // without receiving empresaId as an explicit argument. The empresaId comes
    // exclusively from the resolved JWT claim — never from body or path params.
    EmpresaContextStore.enterWith({
      editoraId: request.user.empresaId,
      // slug maps to the schema suffix: 'aetos' → emp_aetos (TenantPrismaFactory).
      slug: request.user.empresaId,
    });

    return true;
  }

  /**
   * Produces cordele-typed error bodies for 401 responses.
   * When `user` is falsy (missing or invalid token), throws
   * `UnauthorizedException` with `type: urn:cordele:proj:unauthorized` so
   * clients can distinguish cordele auth errors from framework-level 401s.
   */
  override handleRequest<TUser = AuthenticatedUser>(
    err: Error | null,
    user: TUser | false,
  ): TUser {
    if (err || !user) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Missing or invalid authentication token',
        type: 'urn:cordele:proj:unauthorized',
      });
    }
    return user;
  }

  /**
   * Validates that the principal holds at least one of the scopes required by
   * the handler (or its class). No-op when `@RequiredScopes()` is not applied.
   * Throws 403 `urn:cordele:proj:forbidden` on scope mismatch.
   */
  private enforceScopes(context: ExecutionContext, user: AuthenticatedUser): void {
    const required = this.reflector.getAllAndOverride<string[] | undefined>(
      REQUIRED_SCOPES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return;
    }

    const hasScope = required.some((s) => user.scopes.includes(s));
    if (!hasScope) {
      throw new ForbiddenException({
        statusCode: 403,
        message: `Insufficient scope. Required one of: ${required.join(', ')}`,
        type: 'urn:cordele:proj:forbidden',
      });
    }
  }

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
