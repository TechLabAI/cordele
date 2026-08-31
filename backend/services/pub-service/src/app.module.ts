import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import { AuthModule } from './infrastructure/auth/auth.module';
import { JwtAuthGuard } from './infrastructure/auth/jwt-auth.guard';
import { EmpresaContextMiddleware } from './infrastructure/auth/empresa-context.middleware';
import { HealthModule } from './infrastructure/health/health.module';
import { ValidationModule } from './infrastructure/pub/validation/validation.module';
import { StorageModule } from './infrastructure/pub/storage/storage.module';
import { StubsModule } from './infrastructure/pub/stubs/stubs.module';
import { PubInfraBindingsModule } from './infrastructure/pub/pub-infra-bindings.module';
import { PubModule } from './modules/pub/pub.module';
import { PubObservabilityModule } from './modules/pub/observability/pub-observability.module';

/**
 * Root composition module for pub-service.
 *
 * Feature modules map one-to-one to bounded contexts; they must never import
 * each other's providers directly — cross-context communication goes through
 * published contracts (HTTP or the message broker).
 *
 * `JwtAuthGuard` is registered globally here so every route is protected
 * without `PubController` (or any use case) importing `infrastructure/`
 * directly — RULE-04.
 *
 * P3 (PUB-007/008): `PersistenceModule` is registered here as `@Global()` so
 * `PubModule` receives `PublicacaoRepositoryPort` from the global scope without
 * importing `infrastructure/` directly (RULE-04 compliant).
 *
 * P5 (PUB-013): `EmpresaContextMiddleware` is registered here (root
 * composition) so it covers all routes without requiring `PubModule` to import
 * from `infrastructure/`. The `APP_GUARD` order matters — ThrottlerGuard first
 * (rate limiting), then JwtAuthGuard (authentication + scope enforcement).
 *
 * P6 (INT-PUB-001/003): When `PUB_USE_STUBS` is not `true`, the real HTTP
 * adapters (`ImpManuscriptContentAdapter`, `ProjProjectStatusAdapter`) are
 * registered globally to override the stub bindings from `StubsModule`.
 * `StubsModule` is always loaded first (for COMP stubs that have no real
 * adapter yet), then `PubInfraBindingsModule` overrides the IMP and PROJ
 * tokens with the real adapters and binds `EmpresaContextRunnerPort` — see
 * that module's docstring for why these bindings cannot live directly in
 * `AppModule.providers` (they are consumed inside `PubModule`, a child
 * module, and a parent's own providers are never visible to its children).
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
    AuthModule,
    // P4 (PUB-010/011/012): infra adapters registered globally so PubModule
    // receives port tokens without importing infrastructure/ directly (RULE-04).
    ValidationModule,
    StorageModule,
    // StubsModule always loaded — provides COMP stubs (INT-PUB-002 pending).
    // IMP/PROJ stubs are overridden below when PUB_USE_STUBS != true.
    StubsModule,
    PubInfraBindingsModule,
    PubObservabilityModule,
    PubModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule implements NestModule {
  /**
   * Aplica `EmpresaContextMiddleware` para todas as rotas do processo.
   *
   * O middleware decodifica (sem verificar) o Bearer JWT para extrair
   * `empresa_id` e popula o `AsyncLocalStorage` antes de qualquer guard ou
   * handler. Rotas públicas (`@Public()`) recebem `next()` sem contexto.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(EmpresaContextMiddleware).forRoutes('*');
  }
}
