import { INestApplication, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { MetricsController } from './metrics.controller';
import { CompMetricsService, COMP_METRICS } from './comp-metrics.service';

/**
 * Unit tests for MetricsController (COMP-019 — Prometheus scrape endpoint).
 *
 * Verifies:
 *  1. `GET /api/v1/comp/metrics` returns HTTP 200 with Content-Type text/plain.
 *  2. The response body contains recorded counters in Prometheus text format.
 *  3. An empty counter store produces a comment line (valid non-empty body).
 *  4. Labeled counters are included verbatim (e.g. `comp_cover_rejection_total{reason="413"} 2`).
 *
 * `CompMetricsService` is used as a real instance (no mocking) so that the
 * serialisation round-trip — increment → getSnapshot → toPrometheusText — is
 * tested end-to-end.
 *
 * RULE-08: no console.log. ✓
 */

// ---------------------------------------------------------------------------
// Static formatter tests (no HTTP overhead)
// ---------------------------------------------------------------------------

describe('MetricsController.toPrometheusText (static)', () => {
  it('returns comment line for an empty snapshot', () => {
    const text = MetricsController.toPrometheusText({});
    expect(text).toContain('# no COMP metrics recorded yet');
    expect(text.endsWith('\n')).toBe(true);
  });

  it('formats an unlabelled counter correctly', () => {
    const text = MetricsController.toPrometheusText({
      comp_metadata_upsert_total: 5,
    });
    expect(text).toContain('comp_metadata_upsert_total 5');
    expect(text.endsWith('\n')).toBe(true);
  });

  it('formats a labelled counter correctly', () => {
    const text = MetricsController.toPrometheusText({
      'comp_cover_rejection_total{reason="413"}': 2,
    });
    expect(text).toContain('comp_cover_rejection_total{reason="413"} 2');
  });

  it('formats multiple counters, one per line', () => {
    const text = MetricsController.toPrometheusText({
      comp_metadata_upsert_total: 1,
      'comp_cover_rejection_total{reason="413"}': 3,
      comp_layout_upsert_total: 0,
    });

    const lines = text.trim().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines).toContain('comp_metadata_upsert_total 1');
    expect(lines).toContain('comp_cover_rejection_total{reason="413"} 3');
    expect(lines).toContain('comp_layout_upsert_total 0');
  });
});

// ---------------------------------------------------------------------------
// HTTP integration tests
// ---------------------------------------------------------------------------

async function buildApp(metricsService: CompMetricsService): Promise<INestApplication> {
  const module: TestingModule = await Test.createTestingModule({
    controllers: [MetricsController],
    providers: [{ provide: CompMetricsService, useValue: metricsService }],
  }).compile();

  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  await app.init();
  return app;
}

describe('MetricsController GET /api/v1/comp/metrics', () => {
  let app: INestApplication;
  let metricsService: CompMetricsService;

  beforeEach(() => {
    metricsService = new CompMetricsService();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  // -------------------------------------------------------------------------
  // Scenario 1 — empty counter store
  // -------------------------------------------------------------------------

  describe('when no counters have been recorded', () => {
    it('responds 200 with a non-empty text/plain body', async () => {
      app = await buildApp(metricsService);

      const res = await request(app.getHttpServer()).get('/api/v1/comp/metrics');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/plain/);
      expect(res.text.length).toBeGreaterThan(0);
      expect(res.text).toContain('# no COMP metrics recorded yet');
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 2 — unlabelled counter
  // -------------------------------------------------------------------------

  describe('when an unlabelled counter has been incremented', () => {
    it('includes the counter name and value in the response body', async () => {
      metricsService.increment(COMP_METRICS.METADATA_UPSERT_TOTAL);
      metricsService.increment(COMP_METRICS.METADATA_UPSERT_TOTAL);
      metricsService.increment(COMP_METRICS.METADATA_UPSERT_TOTAL);

      app = await buildApp(metricsService);

      const res = await request(app.getHttpServer()).get('/api/v1/comp/metrics');

      expect(res.status).toBe(200);
      expect(res.text).toContain(`${COMP_METRICS.METADATA_UPSERT_TOTAL} 3`);
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 3 — labelled counter
  // -------------------------------------------------------------------------

  describe('when a labelled counter has been incremented', () => {
    it('includes the metric with labels and value verbatim', async () => {
      metricsService.increment(COMP_METRICS.COVER_REJECTION_TOTAL, { reason: '413' });
      metricsService.increment(COMP_METRICS.COVER_REJECTION_TOTAL, { reason: '413' });
      metricsService.increment(COMP_METRICS.COVER_REJECTION_TOTAL, { reason: '415' });

      app = await buildApp(metricsService);

      const res = await request(app.getHttpServer()).get('/api/v1/comp/metrics');

      expect(res.status).toBe(200);
      expect(res.text).toContain(`${COMP_METRICS.COVER_REJECTION_TOTAL}{reason="413"} 2`);
      expect(res.text).toContain(`${COMP_METRICS.COVER_REJECTION_TOTAL}{reason="415"} 1`);
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 4 — all 7 canonical COMP metrics
  // -------------------------------------------------------------------------

  describe('when all 7 canonical COMP metrics have been incremented', () => {
    it('responds with a line for each counter', async () => {
      metricsService.increment(COMP_METRICS.METADATA_UPSERT_TOTAL);
      metricsService.increment(COMP_METRICS.COVER_UPLOAD_TOTAL);
      metricsService.increment(COMP_METRICS.COVER_REJECTION_TOTAL, { reason: '413' });
      metricsService.increment(COMP_METRICS.LAYOUT_UPSERT_TOTAL);
      metricsService.increment(COMP_METRICS.LAYOUT_REJECTION_TOTAL, { reason: '422' });
      metricsService.increment(COMP_METRICS.PREVIEW_CONTEXT_TOTAL);
      metricsService.increment(COMP_METRICS.PREVIEW_STALE_OVERRIDES_TOTAL);

      app = await buildApp(metricsService);

      const res = await request(app.getHttpServer()).get('/api/v1/comp/metrics');

      expect(res.status).toBe(200);

      const lines = res.text.trim().split('\n');
      // 7 increments, each a different key → 7 lines.
      expect(lines).toHaveLength(7);

      expect(res.text).toContain(`${COMP_METRICS.METADATA_UPSERT_TOTAL} 1`);
      expect(res.text).toContain(`${COMP_METRICS.COVER_UPLOAD_TOTAL} 1`);
      expect(res.text).toContain(`${COMP_METRICS.COVER_REJECTION_TOTAL}{reason="413"} 1`);
      expect(res.text).toContain(`${COMP_METRICS.LAYOUT_UPSERT_TOTAL} 1`);
      expect(res.text).toContain(`${COMP_METRICS.LAYOUT_REJECTION_TOTAL}{reason="422"} 1`);
      expect(res.text).toContain(`${COMP_METRICS.PREVIEW_CONTEXT_TOTAL} 1`);
      expect(res.text).toContain(`${COMP_METRICS.PREVIEW_STALE_OVERRIDES_TOTAL} 1`);
    });
  });
});
