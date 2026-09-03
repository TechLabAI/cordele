import { Controller, Get, Header, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../auth/jwt-auth.guard';
import { CompMetricsService } from './comp-metrics.service';

/**
 * Prometheus-compatible metrics scrape endpoint for the COMP bounded context
 * (COMP-019 / observability gap).
 *
 * Route: GET /api/v1/comp/metrics
 *
 * Response: Prometheus text exposition format (text/plain; version=0.0.4).
 * Each counter line follows the canonical `metric{labels} value` pattern.
 * Labels are omitted for counters that carry no label dimensions.
 *
 * Auth posture: `@Public()` — same as `/api/v1/comp/health`.
 * Rationale: the health check is unauthenticated (infrastructure scraping must
 * work without a bearer token); metrics are in the same ops tier and must be
 * equally accessible to a Prometheus scraper running inside the cluster, which
 * does not hold a JWT.  Neither endpoint exposes user data.
 *
 * Registration: `MetricsModule` → imported by `AppModule` (composition root).
 * `CompMetricsService` is provided globally by `CompInfraBindingsModule`
 * (@Global) — no explicit import needed in `MetricsModule`.
 *
 * RULE-04: this controller lives in infrastructure/ and does NOT import modules/.
 * RULE-08: no console.log — uses Nest Logger (none needed here; counts are safe).
 */
@ApiTags('ops')
@Controller({ path: 'comp/metrics', version: '1' })
export class MetricsController {
  constructor(private readonly metricsService: CompMetricsService) {}

  /**
   * Scrape all COMP counters in Prometheus text format.
   *
   * Returns one line per counter dimension:
   *   `comp_metadata_upsert_total 3`
   *   `comp_cover_rejection_total{reason="413"} 2`
   *
   * An empty counter store produces a single comment line so that the scraper
   * receives a valid (non-empty) text/plain body.
   *
   * Content-Type is set explicitly to `text/plain; version=0.0.4; charset=utf-8`
   * so Prometheus client libraries and scraping agents parse the body correctly.
   */
  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  @ApiOkResponse({
    description: 'Prometheus text exposition of COMP counters.',
    content: { 'text/plain': {} },
  })
  scrape(): string {
    const snapshot = this.metricsService.getSnapshot();
    return MetricsController.toPrometheusText(snapshot);
  }

  /**
   * Convert a snapshot map to Prometheus text exposition format.
   *
   * The keys of `snapshot` already follow the Prometheus composite format:
   *   - unlabelled: `comp_metadata_upsert_total`
   *   - labelled:   `comp_cover_rejection_total{reason="413"}`
   *
   * This is the same format produced by `CompMetricsService.getSnapshot()`,
   * so no parsing of keys is required — they are emitted verbatim.
   *
   * Kept as a static helper so it can be tested without a full NestJS app.
   */
  static toPrometheusText(snapshot: Record<string, number>): string {
    const entries = Object.entries(snapshot);

    if (entries.length === 0) {
      return '# no COMP metrics recorded yet\n';
    }

    return entries.map(([key, value]) => `${key} ${value}`).join('\n') + '\n';
  }
}
