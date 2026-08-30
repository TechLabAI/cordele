import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { HealthCheckError } from '@nestjs/terminus';

import { Public } from '../comp/auth/jwt-auth.guard';
import { CompHealthIndicator } from './comp-health.indicator';

interface HealthResponse {
  status: 'ok' | 'degraded' | 'fail';
  details?: Record<string, unknown>;
}

/**
 * Readiness health endpoint for the COMP bounded context (COMP-019 / P7).
 *
 * ```
 * GET /api/v1/health
 *   200 { status: 'ok' }        — DB and storage both reachable.
 *   200 { status: 'degraded' }  — DB ok; storage directory inaccessible.
 *   503 problem+json            — DB unreachable (critical failure).
 *
 * GET /api/v1/health/live
 *   200 { status: 'ok' }        — process is alive (no external dependencies).
 * ```
 *
 * `@Public()` bypasses `JwtAuthGuard` on all health routes.
 *
 * RULE-08: no console.log — uses Nest Logger indirectly via `CompHealthIndicator`.
 */
@ApiTags('ops')
@Controller('health')
export class HealthController {
  constructor(private readonly indicator: CompHealthIndicator) {}

  /**
   * Readiness check.
   *
   * 1. Database check (critical) — failure throws `ServiceUnavailableException`
   *    which `CompExceptionFilter` serialises as RFC 7807 with status 503.
   * 2. Storage check (non-critical) — failure returns 200 with `status: 'degraded'`.
   */
  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Service is healthy or degraded.' })
  @ApiServiceUnavailableResponse({ description: 'Database unreachable.' })
  async check(): Promise<HealthResponse> {
    // 1. Critical: DB must be reachable.
    try {
      await this.indicator.checkDatabase('database');
    } catch (err) {
      if (err instanceof HealthCheckError) {
        throw new ServiceUnavailableException('database unreachable');
      }
      throw err;
    }

    // 2. Non-critical: storage availability.
    const storageResult = await this.indicator.checkStorage('storage');
    const storageUp =
      (storageResult['storage'] as { status?: string } | undefined)?.status === 'up';

    if (!storageUp) {
      return { status: 'degraded', details: { storage: 'inaccessible' } };
    }

    return { status: 'ok' };
  }

  /** Liveness: process is alive — deliberately dependency-free. */
  @Get('live')
  @Public()
  @HttpCode(HttpStatus.OK)
  live(): { status: string } {
    return { status: 'ok' };
  }
}
