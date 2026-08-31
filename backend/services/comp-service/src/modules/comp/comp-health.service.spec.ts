import { Test, TestingModule } from '@nestjs/testing';
import type { DatabaseHealthPort } from './ports/database-health.port';
import { COMP_DATABASE_HEALTH_PORT } from './ports/database-health.port';
import { CompHealthService } from './comp-health.service';

/**
 * Unit spec for CompHealthService (COMP-019 — health status coverage).
 *
 * All external dependencies are mocked:
 *   - `DatabaseHealthPort.pingDatabase()` — DI token double
 *   - `fs/promises` `writeFile` + `unlink` — jest.mock intercepting the disk probe
 *
 * Scenarios:
 *   1. DB ok + storage ok            → status:'ok',       checks:{db:'ok', storage:'ok'}
 *   2. DB ok + storage probe throws  → status:'degraded', checks:{db:'ok', storage:'degraded'}
 *   3. DB ping returns false          → status:'fail',     checks:{db:'fail', storage:'ok'}
 *
 * RULE-04: no PrismaService or DiskFileStorageAdapter imported here.
 * RULE-08: no console.log.
 */

// ---------------------------------------------------------------------------
// Mock fs/promises so the disk probe never touches the real filesystem.
// The mock factory must be declared BEFORE the import so Jest hoists it.
// ---------------------------------------------------------------------------
jest.mock('fs/promises', () => ({
  writeFile: jest.fn(),
  unlink: jest.fn(),
}));

// Import after the mock declaration so the module under test receives the stub.
import * as fsPromises from 'fs/promises';

const mockWriteFile = fsPromises.writeFile as jest.MockedFunction<typeof fsPromises.writeFile>;
const mockUnlink = fsPromises.unlink as jest.MockedFunction<typeof fsPromises.unlink>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDbHealthPort(pingResult: boolean | Error): jest.Mocked<DatabaseHealthPort> {
  const port: jest.Mocked<DatabaseHealthPort> = {
    pingDatabase: jest.fn(),
  };

  if (pingResult instanceof Error) {
    port.pingDatabase.mockRejectedValue(pingResult);
  } else {
    port.pingDatabase.mockResolvedValue(pingResult);
  }

  return port;
}

async function buildService(dbPort: jest.Mocked<DatabaseHealthPort>): Promise<CompHealthService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      CompHealthService,
      { provide: COMP_DATABASE_HEALTH_PORT, useValue: dbPort },
    ],
  }).compile();

  return module.get(CompHealthService);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CompHealthService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Default: storage probe succeeds (writeFile + unlink resolve).
    mockWriteFile.mockResolvedValue(undefined);
    mockUnlink.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // Scenario 1 — DB ok + storage ok → status:'ok'
  // -------------------------------------------------------------------------
  describe('when DB is reachable and storage is writable', () => {
    it('returns status ok with all checks ok', async () => {
      const dbPort = makeDbHealthPort(true);
      const service = await buildService(dbPort);

      const result = await service.check();

      expect(result).toEqual({
        status: 'ok',
        checks: { db: 'ok', storage: 'ok' },
      });
    });

    it('invokes pingDatabase once', async () => {
      const dbPort = makeDbHealthPort(true);
      const service = await buildService(dbPort);

      await service.check();

      expect(dbPort.pingDatabase).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 2 — DB ok + storage probe throws → status:'degraded'
  // -------------------------------------------------------------------------
  describe('when DB is reachable but storage write probe throws', () => {
    it('returns status degraded with storage check degraded and db ok', async () => {
      const dbPort = makeDbHealthPort(true);
      const service = await buildService(dbPort);

      // Simulate storage directory not writable.
      mockWriteFile.mockRejectedValue(new Error('EACCES: permission denied'));

      const result = await service.check();

      expect(result).toEqual({
        status: 'degraded',
        checks: { db: 'ok', storage: 'degraded' },
      });
    });

    it('returns status degraded when unlink throws after a successful write', async () => {
      const dbPort = makeDbHealthPort(true);
      const service = await buildService(dbPort);

      // Write succeeds but cleanup fails.
      mockWriteFile.mockResolvedValue(undefined);
      mockUnlink.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const result = await service.check();

      expect(result).toEqual({
        status: 'degraded',
        checks: { db: 'ok', storage: 'degraded' },
      });
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 3 — DB ping returns false → status:'fail'
  // -------------------------------------------------------------------------
  describe('when DB ping returns false', () => {
    it('returns status fail with db check fail', async () => {
      const dbPort = makeDbHealthPort(false);
      const service = await buildService(dbPort);

      const result = await service.check();

      expect(result).toEqual({
        status: 'fail',
        checks: { db: 'fail', storage: 'ok' },
      });
    });
  });

  // -------------------------------------------------------------------------
  // Scenario 3-b — DB ping throws → status:'fail'
  // -------------------------------------------------------------------------
  describe('when DB ping throws an error', () => {
    it('propagates the exception (check() rejects)', async () => {
      const dbPort = makeDbHealthPort(new Error('Connection refused'));
      const service = await buildService(dbPort);

      await expect(service.check()).rejects.toThrow('Connection refused');
    });
  });
});
