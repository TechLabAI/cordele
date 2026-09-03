import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import { AuthModule } from './infrastructure/auth/auth.module';
import { JwtAuthGuard } from './infrastructure/auth/jwt-auth.guard';
import { CorrelationIdInterceptor } from './infrastructure/http/correlation-id.interceptor';
import { EmpresaContextInterceptor } from './infrastructure/auth/empresa-context.interceptor';
import { HealthModule } from './infrastructure/health/health.module';
import { ReadPortsModule } from './infrastructure/proj/read-ports.module';
import { ErasurePortsModule } from './infrastructure/proj/erasure-ports.module';
import { LookupPortsModule } from './infrastructure/proj/lookup-ports.module';
import { ProjModule } from './modules/proj/proj.module';

/**
 * Root composition module for cordele.
 *
 * Feature modules map one-to-one to bounded contexts; they must never import
 * each other's providers directly — cross-context communication goes through
 * published contracts (HTTP or the message broker).
 *
 * P5 (PROJ-014): `APP_GUARD` registers two global guards (order matters):
 *   1. ThrottlerGuard — rate limiting (runs first, before authentication).
 *   2. JwtAuthGuard    — JWT Bearer authentication + `@RequiredScopes` scope
 *      enforcement. Registering it here (root composition) — rather than
 *      inside `ProjModule` — keeps `modules/proj/*` free of any
 *      `infrastructure/` import (RULE-04), mirroring imp-service.
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60_000, limit: 120 }]),
    HealthModule,
    PersistenceModule,
    ReadPortsModule,
    ErasurePortsModule,
    LookupPortsModule,
    AuthModule,
    ProjModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_INTERCEPTOR, useClass: CorrelationIdInterceptor },
    { provide: APP_INTERCEPTOR, useClass: EmpresaContextInterceptor },
  ],
})
export class AppModule {}
