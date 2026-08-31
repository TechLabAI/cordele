import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../comp/auth/jwt-auth.guard';
import { CompHealthService, type HealthCheckResult } from '../../modules/comp/comp-health.service';

/**
 * Readiness / liveness health endpoints for the COMP bounded context (COMP-019).
 *
 * Routes:
 *   GET /api/v1/comp/health          — readiness (DB + storage probes).
 *   GET /api/v1/comp/health/live     — liveness  (no external deps — process alive).
 *
 * Response contract (readiness):
 *   200 { status: 'ok' }                               — DB and storage healthy.
 *   200 { status: 'degraded', checks: { storage: 'degraded' } }
 *                                                       — storage probe failed.
 *   503                                                 — DB unreachable.
 *
 * `@Public()` bypasses `JwtAuthGuard` on all routes in this controller.
 *
 * Replaces the terminus-based `CompHealthIndicator` from the previous P7
 * implementation with a plain `CompHealthService.check()` call — no
 * `@nestjs/terminus` dependency (COMP-019 rewrite).
 *
 * Decision: the health route lives here (`health.controller.ts`) rather than
 * in `CompController` because:
 *   (a) CompController is scoped to `comp/projetos/:projetoId` — any `@Get`
 *       added there would produce `/comp/projetos/:projetoId/health`, which is
 *       a per-project path, NOT a service-level health check.
 *   (b) The user instructions specify "top-level, NOT nested under /projetos/:id".
 *   (c) A dedicated health controller already existed here from P7 serving the
 *       correct top-level URL (`/api/v1/comp/health`).
 *
 * RULE-08: no console.log. ✓
 */
@ApiTags('ops')
@Controller({ path: 'comp/health', version: '1' })
export class HealthController {
  constructor(private readonly healthService: CompHealthService) {}

  /**
   * Readiness check.
   *
   * Delegates to `CompHealthService.check()` and maps the result:
   *   - `fail`     → 503 ServiceUnavailableException (DB critical failure).
   *   - `degraded` → 200 with `{ status: 'degraded', checks }`.
   *   - `ok`       → 200 with `{ status: 'ok', checks }`.
   */
  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOkResponse({ description: 'Service is healthy or degraded.' })
  @ApiServiceUnavailableResponse({ description: 'Database unreachable.' })
  async check(): Promise<HealthCheckResult> {
    const result = await this.healthService.check();

    if (result.status === 'fail') {
      throw new ServiceUnavailableException('database unreachable');
    }

    return result;
  }

  /** Liveness: process is alive — deliberately dependency-free. */
  @Get('live')
  @Public()
  @HttpCode(HttpStatus.OK)
  live(): { status: string } {
    return { status: 'ok' };
  }
}
