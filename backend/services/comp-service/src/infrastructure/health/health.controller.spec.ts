import { INestApplication, VersioningType } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { HealthController } from './health.controller';
import { CompHealthService } from '../../modules/comp/comp-health.service';
import type { HealthCheckResult } from '../../modules/comp/comp-health.service';

/**
 * Unit spec for HealthController (COMP-019 — HTTP status coverage).
 *
 * Verifies that the controller translates the three `CompHealthService.check()`
 * outcomes into the correct HTTP status codes and response shapes:
 *
 *   1. status:'ok'       → HTTP 200  { status:'ok',       checks:{db:'ok', storage:'ok'} }
 *   2. status:'degraded' → HTTP 200  { status:'degraded', checks:{db:'ok', storage:'degraded'} }
 *   3. status:'fail'     → HTTP 503  (ServiceUnavailableException)
 *
 * `CompHealthService` is replaced by a jest spy — no DB, no disk, no Nest DI wiring.
 * Routes are `@Public()` so no guard registration is required.
 *
 * RULE-08: no console.log. ✓
 */

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

async function buildApp(
  checkResult: HealthCheckResult | Error,
): Promise<INestApplication> {
  const mockHealthService = {
    check: jest.fn().mockImplementation(async () => {
      if (checkResult instanceof Error) {
        throw checkResult;
      }
      return checkResult;
    }),
  };

  const module: TestingModule = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [
      { provide: CompHealthService, useValue: mockHealthService },
    ],
  }).compile();

  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  await app.init();
  return app;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HealthController GET /api/v1/comp/health', () => {
  let app: INestApplication;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  // -------------------------------------------------------------------------
  // Scenario 1 — DB ok + storage ok → HTTP 200 ok
  // -------------------------------------------------------------------------
  describe('when DB and storage are healthy', () => {
    it('responds 200 with status ok', async () => {
      const result: HealthCheckResult = {
        status: 'ok',
        checks: { db: 'ok', storage: 'ok' },
      };
      app = await buildApp(result);

      const res = await request(app.getHttpServer()).get('/api/v1/comp/health');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(result);
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 2 — storage unavailable → HTTP 200 degraded
  // -------------------------------------------------------------------------
  describe('when storage is unavailable (degraded)', () => {
    it('responds 200 with status degraded (NOT 503)', async () => {
      const result: HealthCheckResult = {
        status: 'degraded',
        checks: { db: 'ok', storage: 'degraded' },
      };
      app = await buildApp(result);

      const res = await request(app.getHttpServer()).get('/api/v1/comp/health');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(result);
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 3 — DB unavailable → HTTP 503
  // -------------------------------------------------------------------------
  describe('when DB is unavailable (fail)', () => {
    it('responds 503 Service Unavailable', async () => {
      const result: HealthCheckResult = {
        status: 'fail',
        checks: { db: 'fail', storage: 'ok' },
      };
      app = await buildApp(result);

      const res = await request(app.getHttpServer()).get('/api/v1/comp/health');

      expect(res.status).toBe(503);
    });
  });
});

// ---------------------------------------------------------------------------
// Liveness endpoint — always 200, no deps
// ---------------------------------------------------------------------------
describe('HealthController GET /api/v1/comp/health/live', () => {
  let app: INestApplication;

  afterEach(async () => {
    if (app) {
      await app.close();
    }
  });

  it('responds 200 with status ok regardless of CompHealthService outcome', async () => {
    app = await buildApp({ status: 'fail', checks: { db: 'fail', storage: 'ok' } });

    const res = await request(app.getHttpServer()).get('/api/v1/comp/health/live');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
