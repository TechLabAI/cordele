import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';

import { PubHealthModule } from '../pub/health/pub-health.module';
import { HealthController } from './health.controller';

/**
 * HealthModule — provides the `/health` (readiness) and `/health/live`
 * (liveness) endpoints for pub-service.
 *
 * P7 (PUB-018): imports `PubHealthModule` to add the three PUB readiness
 * checks (DB, storage, epubcheck) to the readiness endpoint.
 */
@Module({
  imports: [TerminusModule, PubHealthModule],
  controllers: [HealthController],
})
export class HealthModule {}
