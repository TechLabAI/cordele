import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

import type { UsuarioContext } from '../../../domain/shared/usuario-context.interface';

/**
 * Shape attached to `request.user` by `JwtStrategy.validate`
 * (`infrastructure/auth/jwt.strategy.ts`). Duplicated here — not imported —
 * so this file stays RULE-04 compliant (modules/ does not import
 * infrastructure/ directly).
 */
interface RequestPrincipal {
  readonly userId: string;
  readonly empresaId: string;
  readonly scopes: string[];
}

/**
 * Injects the authenticated principal as a domain-pure `UsuarioContext`.
 *
 * Maps the infrastructure principal (`userId`) onto the domain contract
 * (`id`) declared in `domain/shared/usuario-context.interface.ts`.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): UsuarioContext => {
    const request = ctx.switchToHttp().getRequest<{ user?: RequestPrincipal }>();
    if (!request.user) {
      throw new UnauthorizedException('No authenticated principal on request');
    }
    return {
      id: request.user.userId,
      empresaId: request.user.empresaId,
      scopes: request.user.scopes,
    };
  },
);
