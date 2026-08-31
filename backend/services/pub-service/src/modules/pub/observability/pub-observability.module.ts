import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { CorrelationContextService } from './correlation-context.service';
import { CorrelationInterceptor } from './correlation.interceptor';
import { PubLoggerService } from './pub-logger.service';

/**
 * PubObservabilityModule — cross-cutting observability for the PUB context
 * (PUB-017, P7, SPEC-07).
 *
 * ### Registered providers
 * - `CorrelationContextService` — AsyncLocalStorage wrapper; propagates
 *   `X-Correlation-Id` through the async call chain.
 * - `CorrelationInterceptor` — registered as `APP_INTERCEPTOR` so every route
 *   in the process receives the `X-Correlation-Id` response header without
 *   any controller importing from `infrastructure/` (RULE-04).
 * - `PubLoggerService` — structured JSON logger with correlation + empresa
 *   fields; exported globally for injection in `PubModule` use-cases and jobs.
 *
 * ### Why `@Global()`?
 * `CorrelationContextService` and `PubLoggerService` are consumed by
 * `PublicationBuildJob` (modules/pub/use-cases/) without `PubModule`
 * importing this module explicitly — mirrors the pattern used by
 * `PersistenceModule` and `AuthModule` in `AppModule`.
 *
 * RULE-04: modules/ does not import infrastructure/. ✓
 * RULE-08: no console.log — providers use NestJS Logger. ✓
 */
@Global()
@Module({
  providers: [
    CorrelationContextService,
    PubLoggerService,
    {
      provide: APP_INTERCEPTOR,
      useClass: CorrelationInterceptor,
    },
  ],
  exports: [CorrelationContextService, PubLoggerService],
})
export class PubObservabilityModule {}
