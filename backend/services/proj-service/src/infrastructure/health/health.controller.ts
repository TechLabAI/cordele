import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckResult,
  HealthCheckService,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { ApiTags } from '@nestjs/swagger';

import { PrismaService } from '../persistence/prisma.service';
import { Public } from '../auth/jwt-auth.guard';

// Infra probes (k8s liveness/readiness) hit bare, unversioned /health paths —
// setGlobalPrefix's `exclude` (main.ts) drops the /api prefix, and this drops
// the /v1 version segment.
@ApiTags('ops')
@Controller({ path: 'health', version: VERSION_NEUTRAL })
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaIndicator: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
  ) {}

  /** Readiness: the app plus every dependency it cannot serve traffic without. */
  @Get()
  @Public()
  @HealthCheck()
  check(): Promise<HealthCheckResult> {
    return this.health.check([
      () => this.prismaIndicator.pingCheck('database', this.prisma),
    ]);
  }

  /** Liveness: process is up. Deliberately dependency-free. */
  @Get('live')
  @Public()
  live(): { status: string } {
    return { status: 'ok' };
  }
}
