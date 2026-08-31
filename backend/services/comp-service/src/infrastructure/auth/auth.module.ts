import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';

import { EmpresaContextService } from './empresa-context.service';
import { EmpresaContextMiddleware } from './empresa-context.middleware';
import { JwtStrategy } from './jwt.strategy';

/**
 * Registers the JWT strategy and empresa context services once for the whole process.
 *
 * Global because `EmpresaContextService` must be resolvable by any provider
 * (repositories, mapper factories, use-cases) without a local import.
 *
 * `JwtAuthGuard` and `ScopeGuard` are registered as `APP_GUARD` in `app.module.ts`
 * (composition root) via `infrastructure/comp/auth/` — not here.
 *
 * `EmpresaContextMiddleware` is registered in `AppModule.configure()` to cover
 * all routes without violating RULE-04 (AppModule is the composition root and
 * the only module that imports from both modules/ and infrastructure/).
 *
 * P5 (COMP-013): EmpresaContextService + EmpresaContextMiddleware propagate the
 * empresaId JWT claim via AsyncLocalStorage before any repository call resolves
 * the tenant schema.
 */
@Global()
@Module({
  imports: [ConfigModule, PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [JwtStrategy, EmpresaContextService, EmpresaContextMiddleware],
  exports: [PassportModule, EmpresaContextService, EmpresaContextMiddleware],
})
export class AuthModule {}
