/**
 * Unit tests for HealthController (PROJ-017).
 *
 * Verified behaviours:
 *  1. GET /health delegates to HealthCheckService and returns the result (200).
 *  2. GET /health/live returns { status: 'ok' } — dependency-free liveness probe.
 */

import { HealthCheckResult, HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';

import { HealthController } from './health.controller';
import { PrismaService } from '../persistence/prisma.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHealthResult(status: 'up' | 'down' = 'up'): HealthCheckResult {
  return {
    status: status === 'up' ? 'ok' : 'error',
    info: { database: { status } },
    error: {},
    details: { database: { status } },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HealthController', () => {
  let healthCheckService: jest.Mocked<HealthCheckService>;
  let prismaIndicator: jest.Mocked<PrismaHealthIndicator>;
  let prismaService: jest.Mocked<PrismaService>;
  let controller: HealthController;

  beforeEach(() => {
    healthCheckService = {
      check: jest.fn(),
    } as unknown as jest.Mocked<HealthCheckService>;

    prismaIndicator = {
      pingCheck: jest.fn(),
    } as unknown as jest.Mocked<PrismaHealthIndicator>;

    // PrismaService is only forwarded to the indicator — no methods needed
    prismaService = {} as jest.Mocked<PrismaService>;

    controller = new HealthController(
      healthCheckService,
      prismaIndicator,
      prismaService,
    );
  });

  describe('check() — readiness probe', () => {
    it('returns 200 (HealthCheckResult) when DB is accessible', async () => {
      const result = makeHealthResult('up');
      healthCheckService.check.mockResolvedValue(result);

      const response = await controller.check();

      expect(response).toBe(result);
      expect(healthCheckService.check).toHaveBeenCalledTimes(1);
      // The callback array is passed to health.check — one indicator entry.
      const [indicators] = healthCheckService.check.mock.calls[0] as [Array<() => unknown>];
      expect(indicators).toHaveLength(1);
    });

    it('delegates the prisma ping-check indicator inside the callback', async () => {
      const pingResult = makeHealthResult('up');
      prismaIndicator.pingCheck.mockResolvedValue({ database: { status: 'up' } } as never);
      // Capture and invoke the indicator callback to verify it calls prismaIndicator
      healthCheckService.check.mockImplementation(async (indicators) => {
        await indicators[0]!();
        return pingResult;
      });

      await controller.check();

      expect(prismaIndicator.pingCheck).toHaveBeenCalledWith('database', prismaService);
    });
  });

  describe('live() — liveness probe', () => {
    it('returns { status: "ok" } without any dependency calls', () => {
      const result = controller.live();

      expect(result).toEqual({ status: 'ok' });
      // Liveness must be dependency-free
      expect(healthCheckService.check).not.toHaveBeenCalled();
      expect(prismaIndicator.pingCheck).not.toHaveBeenCalled();
    });
  });
});
