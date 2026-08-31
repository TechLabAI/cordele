import { Module } from '@nestjs/common';

import { PubHealthIndicator } from './pub-health.indicator';

/**
 * PubHealthModule — exports `PubHealthIndicator` so `HealthModule` can wire
 * the three PUB readiness checks into the global `/health` endpoint
 * (PUB-018, P7, SPEC-07).
 *
 * Placed in `infrastructure/pub/health/` so it can freely import other infra
 * components (`PrismaService`, `ConfigService`) without violating RULE-04/05.
 *
 * `PrismaService` is provided globally by `PersistenceModule` (`@Global()`
 * registered in `AppModule`), so no explicit import of `PersistenceModule`
 * is needed here.
 */
@Module({
  providers: [PubHealthIndicator],
  exports: [PubHealthIndicator],
})
export class PubHealthModule {}
