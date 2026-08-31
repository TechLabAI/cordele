import * as fs from 'node:fs';
import * as childProcess from 'node:child_process';

import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { HealthCheckError } from '@nestjs/terminus';

import { PrismaService } from '../../persistence/prisma.service';
import { PubHealthIndicator } from './pub-health.indicator';

// `existsSync`/`execFile` are non-configurable properties on Node's `fs` and
// `child_process` modules in newer Node versions, so `jest.spyOn(mod, 'fn')`
// fails with "Cannot redefine property". Replace them with jest.fn() up front.
jest.mock('node:fs', () => ({
  ...jest.requireActual('node:fs'),
  existsSync: jest.fn(),
}));

jest.mock('node:child_process', () => ({
  ...jest.requireActual('node:child_process'),
  execFile: jest.fn(),
}));

const existsSyncMock = fs.existsSync as jest.Mock;
const execFileMock = childProcess.execFile as unknown as jest.Mock;

// ─── Mocks ───────────────────────────────────────────────────────────────────

const mockPrisma = {
  $queryRaw: jest.fn(),
};

const mockConfig = {
  get: jest.fn(),
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function buildModule(
  envOverrides: Record<string, string | undefined> = {},
): Promise<TestingModule> {
  mockConfig.get.mockImplementation((key: string) => envOverrides[key]);

  return Test.createTestingModule({
    providers: [
      PubHealthIndicator,
      { provide: PrismaService, useValue: mockPrisma },
      { provide: ConfigService, useValue: mockConfig },
    ],
  }).compile();
}

// ─── Test suite ───────────────────────────────────────────────────────────────

describe('PubHealthIndicator', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── checkDatabase ──────────────────────────────────────────────────────────

  describe('checkDatabase()', () => {
    it('returns UP when Prisma query succeeds', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
      const module = await buildModule();
      const indicator = module.get(PubHealthIndicator);

      const result = await indicator.checkDatabase();

      expect(result).toMatchObject({ pub_database: { status: 'up' } });
    });

    it('throws HealthCheckError (DOWN) when Prisma query fails', async () => {
      mockPrisma.$queryRaw.mockRejectedValueOnce(new Error('Connection refused'));
      const module = await buildModule();
      const indicator = module.get(PubHealthIndicator);

      await expect(indicator.checkDatabase()).rejects.toBeInstanceOf(HealthCheckError);
    });
  });

  // ── checkStorage ───────────────────────────────────────────────────────────

  describe('checkStorage()', () => {
    it('returns DOWN with reason when PUB_STORAGE_ROOT is not configured', async () => {
      const module = await buildModule({ PUB_STORAGE_ROOT: undefined });
      const indicator = module.get(PubHealthIndicator);

      await expect(indicator.checkStorage()).rejects.toMatchObject({
        causes: expect.objectContaining({
          pub_storage: expect.objectContaining({
            status: 'down',
            reason: 'PUB_STORAGE_ROOT not configured',
          }),
        }),
      });
    });

    it('returns UP when write probe succeeds', async () => {
      const writeFileMock = jest
        .spyOn(fs.promises, 'writeFile')
        .mockResolvedValueOnce(undefined);
      const unlinkMock = jest
        .spyOn(fs.promises, 'unlink')
        .mockResolvedValueOnce(undefined);

      const module = await buildModule({ PUB_STORAGE_ROOT: '/tmp/pub-test' });
      const indicator = module.get(PubHealthIndicator);

      const result = await indicator.checkStorage();

      expect(result).toMatchObject({ pub_storage: { status: 'up' } });
      writeFileMock.mockRestore();
      unlinkMock.mockRestore();
    });

    it('returns DOWN when write probe fails (disk error)', async () => {
      const writeFileMock = jest
        .spyOn(fs.promises, 'writeFile')
        .mockRejectedValueOnce(new Error('EACCES: permission denied'));

      const module = await buildModule({ PUB_STORAGE_ROOT: '/read-only/dir' });
      const indicator = module.get(PubHealthIndicator);

      await expect(indicator.checkStorage()).rejects.toBeInstanceOf(HealthCheckError);
      writeFileMock.mockRestore();
    });
  });

  // ── checkEpubcheck ─────────────────────────────────────────────────────────

  describe('checkEpubcheck()', () => {
    it('returns DOWN with reason "EPUBCHECK_JAR_PATH not configured" when env var is absent', async () => {
      const module = await buildModule({ EPUBCHECK_JAR_PATH: undefined });
      const indicator = module.get(PubHealthIndicator);

      await expect(indicator.checkEpubcheck()).rejects.toMatchObject({
        causes: expect.objectContaining({
          pub_epubcheck: expect.objectContaining({
            status: 'down',
            reason: 'EPUBCHECK_JAR_PATH not configured',
          }),
        }),
      });
    });

    it('returns DOWN when JAR file does not exist on disk', async () => {
      existsSyncMock.mockReturnValueOnce(false);

      const module = await buildModule({
        EPUBCHECK_JAR_PATH: '/nonexistent/epubcheck.jar',
      });
      const indicator = module.get(PubHealthIndicator);

      await expect(indicator.checkEpubcheck()).rejects.toBeInstanceOf(HealthCheckError);
    });

    it('returns DOWN when java -version fails (JRE not on PATH)', async () => {
      existsSyncMock.mockReturnValueOnce(true);

      // Simulate execFile callback with an error (non-zero exit or not found)
      execFileMock.mockImplementationOnce(
        (_cmd: string, _args: string[], _opts: unknown, callback: (error: Error | null) => void) => {
          callback(new Error('spawn java ENOENT'));
          return {};
        },
      );

      const module = await buildModule({
        EPUBCHECK_JAR_PATH: '/path/to/epubcheck.jar',
      });
      const indicator = module.get(PubHealthIndicator);

      await expect(indicator.checkEpubcheck()).rejects.toBeInstanceOf(HealthCheckError);
    });

    it('returns UP when JAR exists and java -version exits 0', async () => {
      existsSyncMock.mockReturnValueOnce(true);

      execFileMock.mockImplementationOnce(
        (_cmd: string, _args: string[], _opts: unknown, callback: (error: null) => void) => {
          callback(null);
          return {};
        },
      );

      const module = await buildModule({
        EPUBCHECK_JAR_PATH: '/path/to/epubcheck.jar',
      });
      const indicator = module.get(PubHealthIndicator);

      const result = await indicator.checkEpubcheck();

      expect(result).toMatchObject({ pub_epubcheck: { status: 'up' } });
    });
  });
});
