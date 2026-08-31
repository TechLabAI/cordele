import { createParamDecorator, ExecutionContext, UnauthorizedException } from '@nestjs/common';

import type { AuthenticatedUser } from '../../../domain/auth/authenticated-user';

/**
 * Decorator de controller que injeta o principal autenticado no parâmetro do handler.
 *
 * Importado pelos controllers/use cases a partir de `domain/` — não de
 * `infrastructure/`. Isso mantém RULE-04: `modules/` não importa
 * `infrastructure/` diretamente.
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
