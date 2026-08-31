import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { DatabaseModule } from './infrastructure/persistence/database.module';
import { PersistenceModule } from './infrastructure/persistence/persistence.module';
import { CompInfraBindingsModule } from './infrastructure/comp/comp-infra-bindings.module';
import { ProblemJsonFilter } from './infrastructure/comp/filters/problem-json.filter';
import { AuthModule } from './infrastructure/auth/auth.module';
import { JwtAuthGuard } from './infrastructure/comp/auth/jwt-auth.guard';
import { ScopeGuard } from './infrastructure/comp/auth/scope.guard';
import { EmpresaContextMiddleware } from './infrastructure/auth/empresa-context.middleware';
import { CorrelationMiddleware } from './infrastructure/comp/middleware/correlation.middleware';
import { RequestLoggerMiddleware } from './infrastructure/comp/middleware/request-logger.middleware';
import { HealthModule } from './infrastructure/health/health.module';
import { CompModule } from './modules/comp/comp.module';

/**
 * Root composition module for cordele.
 *
 * Feature modules map one-to-one to bounded contexts; they must never import
 * each other's providers directly — cross-context communication goes through
 * published contracts (HTTP or the message broker).
 *
 * PersistenceModule (@Global) is imported here so CompModule never imports
 * infrastructure/ directly (RULE-04). CompInfraBindingsModule (@Global) holds
 * ALL port-token bindings (COMP_METADADOS_REPO, COMP_LAYOUT_REPO,
 * COMP_MANUSCRIPT_CONTENT_PORT, COMP_FILE_STORAGE_PORT,
 * COMP_DATABASE_HEALTH_PORT, COMP_EVENT_EMITTER, COMP_METRICS_SERVICE) so
 * they are visible to CompModule without CompModule importing infrastructure/.
 *
 * FIX CRITICO: previously these bindings lived in AppModule.providers[], which
 * NestJS does NOT propagate to child modules (DI visibility flows only from
 * child → parent via exports, never parent → child). Moving them to a @Global()
 * module applies the same pattern as PersistenceModule and fixes the boot crash:
 * "Nest can't resolve dependencies of the CompHealthService (?)" at index [0].
 *
 * P5: JwtAuthGuard registered as APP_GUARD (order matters: ThrottlerGuard first,
 * then JwtAuthGuard) — mirrors imp-service and proj-service, keeps
 * modules/comp/* free of any infrastructure/ import (RULE-04).
 * EmpresaContextMiddleware and CorrelationMiddleware are registered here
 * (composition root) via configure(), not in CompModule, so CompModule stays
 * RULE-04 compliant.
 *
 * P7 / COMP-018: ProblemJsonFilter registered as APP_FILTER global here
 * (composition root) so CompModule need not import infrastructure/comp/filters/
 * (RULE-04 compliance). RequestLoggerMiddleware wired in configure() after
 * EmpresaContextMiddleware so empresa and correlationId are set before logging.
 *
 * COMP-016/COMP-017: COMP_PROJECT_METADATA_PORT and COMP_COMPOSITION_ERASURE_PORT
 * are now registered inside CompModule (as use-case providers) and exported from
 * there. AppModule no longer binds them — the bindings live in the bounded context.
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
    DatabaseModule,
    PersistenceModule,
    // CompInfraBindingsModule is @Global() and provides all COMP port-token
    // bindings (COMP_METADADOS_REPO, COMP_LAYOUT_REPO, COMP_MANUSCRIPT_CONTENT_PORT,
    // COMP_FILE_STORAGE_PORT, COMP_DATABASE_HEALTH_PORT, COMP_EVENT_EMITTER,
    // COMP_METRICS_SERVICE). @Global() makes these visible to CompModule
    // (and HealthModule → CompModule) without CompModule importing infrastructure/
    // directly (RULE-04 compliant). See FIX CRITICO: DI crash on real boot.
    CompInfraBindingsModule,
    AuthModule,
    CompModule,
  ],
  providers: [
    // --- Rate limiting and JWT auth guards (global, ordered) ---
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // JwtAuthGuard registered globally so CompController (and any future
    // controller) does not need @UseGuards() — RULE-04 compliant.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // ScopeGuard runs AFTER JwtAuthGuard (order matches APP_GUARD declaration
    // order) and enforces @RequiredScopes() metadata — SPEC-06 §2.
    { provide: APP_GUARD, useClass: ScopeGuard },

    // --- P7/COMP-018: RFC 7807 exception filter (global) ---
    // Registered here (not in CompModule) so CompModule does not import
    // infrastructure/comp/filters/ (RULE-04 compliance).
    { provide: APP_FILTER, useClass: ProblemJsonFilter },
  ],
})
export class AppModule implements NestModule {
  /**
   * Register cross-cutting HTTP middlewares at the composition root.
   *
   * Ordering matters (NestJS applies them in the order .apply() is called):
   *   1. CorrelationMiddleware — mints X-Correlation-Id header first so it
   *      is available in ProblemJsonFilter (traceId in RFC 7807 responses).
   *   2. EmpresaContextMiddleware — decodes the Bearer JWT and populates
   *      AsyncLocalStorage before JwtAuthGuard runs (RULE-07).
   *   3. RequestLoggerMiddleware — reads correlationId + empresaId set above
   *      and emits a structured log entry per request/response pair.
   *
   * Registering all three middlewares here (composition root) instead of inside
   * CompModule keeps modules/comp/* free of any infrastructure/ import
   * (RULE-04 compliance — same pattern used by proj-service).
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(CorrelationMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });

    consumer
      .apply(EmpresaContextMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });

    consumer
      .apply(RequestLoggerMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
