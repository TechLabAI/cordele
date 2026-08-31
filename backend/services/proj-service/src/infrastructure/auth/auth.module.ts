import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';

import { JwtStrategy } from './jwt.strategy';

/**
 * Registers the JWT strategy once for the whole process.
 *
 * `JwtAuthGuard` is NOT provided/exported here: it is already registered once,
 * globally, via `{ provide: APP_GUARD, useClass: JwtAuthGuard }` in
 * `app.module.ts`. A second registration here (as it used to be) creates a
 * duplicate binding for the same class token that `TestingModule.overrideGuard()`
 * cannot cleanly target — e2e tests that override the guard would silently hit
 * the real one instead (confirmed: the override's `canActivate` was never
 * invoked, and requests fell through to Passport's real JWT check → 401).
 */
@Global()
@Module({
  imports: [ConfigModule, PassportModule.register({ defaultStrategy: 'jwt' })],
  providers: [JwtStrategy],
  exports: [PassportModule],
})
export class AuthModule {}
