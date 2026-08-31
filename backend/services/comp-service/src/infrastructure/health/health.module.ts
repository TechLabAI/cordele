import { Module } from '@nestjs/common';

import { HealthController } from './health.controller';
import { CompModule } from '../../modules/comp/comp.module';

/**
 * Exposes the readiness health endpoint (`GET /api/v1/health`) and the
 * liveness endpoint (`GET /api/v1/health/live`).
 *
 * Imports `CompModule` which exports `CompHealthService` — this avoids
 * importing `CompHealthService` directly from `modules/` here (RULE-05
 * compliance for infrastructure → modules direction).
 *
 * `PrismaService` is provided globally by `DatabaseModule` (imported in
 * `AppModule`) — resolved transitively through `CompModule`'s
 * `CompHealthService` via `COMP_DATABASE_HEALTH_PORT`.
 *
 * Replaces the terminus-based `HealthModule` from P7 with a plain NestJS module
 * using the simpler `CompHealthService` (no `@nestjs/terminus` required —
 * COMP-019 rewrite).
 */
@Module({
  imports: [CompModule],
  controllers: [HealthController],
})
export class HealthModule {}
