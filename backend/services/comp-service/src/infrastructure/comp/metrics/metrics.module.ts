import { Module } from '@nestjs/common';

import { MetricsController } from './metrics.controller';

/**
 * Exposes the Prometheus scrape endpoint (`GET /api/v1/comp/metrics`).
 *
 * `CompMetricsService` is already registered globally by `CompInfraBindingsModule`
 * (@Global) and does not need to be imported here — NestJS resolves it from the
 * global container when `MetricsController` declares it in its constructor.
 *
 * Imported by `AppModule` (composition root) so that the scrape route is active
 * alongside the health endpoints and the main COMP API.
 *
 * RULE-04/05: infrastructure module — no imports from modules/. ✓
 */
@Module({
  controllers: [MetricsController],
})
export class MetricsModule {}
