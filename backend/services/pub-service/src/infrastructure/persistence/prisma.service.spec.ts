import { INestApplication } from '@nestjs/common';

import { PrismaService } from './prisma.service';

/**
 * Unit tests for `PrismaService` (PUB-007).
 *
 * `PrismaService` extends `PrismaClient` and manages the connection lifecycle
 * via the NestJS `OnModuleInit` / `OnModuleDestroy` hooks. The tests mock
 * the three `PrismaClient` methods that the service delegates to — `$connect`,
 * `$disconnect`, and `$on` — so no live Postgres connection is required.
 *
 * Behaviour verified:
 *   - `onModuleInit()` calls `$connect()` exactly once.
 *   - `onModuleDestroy()` calls `$disconnect()` exactly once.
 *   - `enableShutdownHooks(app)` registers a `beforeExit` process listener
 *     and the listener calls `app.close()`.
 */
describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(() => {
    service = new PrismaService();

    // Mock the PrismaClient methods that PrismaService delegates to.
    // These are inherited from PrismaClient so they exist on the prototype;
    // we replace them on the instance so tests remain isolated.
    jest.spyOn(service, '$connect').mockResolvedValue(undefined);
    jest.spyOn(service, '$disconnect').mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    // Remove any beforeExit listeners added during tests.
    process.removeAllListeners('beforeExit');
  });

  describe('onModuleInit()', () => {
    it('calls $connect() exactly once', async () => {
      await service.onModuleInit();

      expect(service.$connect).toHaveBeenCalledTimes(1);
    });

    it('does not call $disconnect during init', async () => {
      await service.onModuleInit();

      expect(service.$disconnect).not.toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy()', () => {
    it('calls $disconnect() exactly once', async () => {
      await service.onModuleDestroy();

      expect(service.$disconnect).toHaveBeenCalledTimes(1);
    });

    it('does not call $connect during destroy', async () => {
      await service.onModuleDestroy();

      expect(service.$connect).not.toHaveBeenCalled();
    });
  });

  describe('enableShutdownHooks(app)', () => {
    it('registers a process beforeExit listener', async () => {
      const app = { close: jest.fn().mockResolvedValue(undefined) } as unknown as INestApplication;

      const listenersBefore = process.listenerCount('beforeExit');
      await service.enableShutdownHooks(app);

      expect(process.listenerCount('beforeExit')).toBe(listenersBefore + 1);
    });

    it('the registered listener calls app.close()', async () => {
      const app = { close: jest.fn().mockResolvedValue(undefined) } as unknown as INestApplication;

      await service.enableShutdownHooks(app);

      // Trigger the listener manually (simulates OS beforeExit signal).
      process.emit('beforeExit', 0);

      // app.close() is called inside a void-wrapped async handler; allow the
      // microtask queue to flush before asserting.
      await Promise.resolve();

      expect(app.close).toHaveBeenCalledTimes(1);
    });
  });
});
