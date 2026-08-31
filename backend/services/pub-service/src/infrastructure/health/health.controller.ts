import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
} from '@nestjs/terminus';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { PubHealthIndicator } from '../pub/health/pub-health.indicator';
import { Public } from '../auth/jwt-auth.guard';

/**
 * HealthController — `/health` readiness and `/health/live` liveness probes.
 *
 * P7 (PUB-018): the readiness probe now runs the three PUB-specific checks
 * from `PubHealthIndicator`:
 *  - `pub_database`  — Prisma `SELECT 1`
 *  - `pub_storage`   — write probe to `PUB_STORAGE_ROOT`
 *  - `pub_epubcheck` — JAR existence + `java -version`
 *
 * If `EPUBCHECK_JAR_PATH` is absent the overall readiness status is `error`
 * and `pub_epubcheck.status` is `"down"` — satisfying ADR-003 (never publish
 * unvalidated ePub) and SPEC-07.
 *
 * RULE-05: infrastructure/ does not import modules/. ✓
 *   `PubHealthIndicator` lives in `infrastructure/pub/health/`.
 */
@ApiTags('ops')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly pubHealthIndicator: PubHealthIndicator,
  ) {}

  /** Readiness: the app plus every dependency it cannot serve traffic without. */
  @Get()
  @Public()
  @HealthCheck()
  @ApiOperation({ summary: 'Readiness probe — DB, storage, and epubcheck availability' })
  @ApiOkResponse({ description: 'All checks UP → 200; any DOWN → 503.' })
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.pubHealthIndicator.checkDatabase(),
      () => this.pubHealthIndicator.checkStorage(),
      () => this.pubHealthIndicator.checkEpubcheck(),
    ]);
  }

  /** Liveness: process is up. Deliberately dependency-free. */
  @Get('live')
  @Public()
  @ApiOperation({ summary: 'Liveness probe — process up, no dependency checks' })
  live(): { status: string } {
    return { status: 'ok' };
  }
}
