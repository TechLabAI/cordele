import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { writeFile, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HealthCheckError, HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';

import { PrismaService } from '../../persistence/prisma.service';

const execFileAsync = promisify(execFile);

/**
 * PubHealthIndicator — readiness checks for the PUB bounded context
 * (PUB-018, P7, SPEC-07).
 *
 * Exposes three independent checks consumed by `HealthController`:
 *
 * | Key            | What is checked                                            |
 * |----------------|------------------------------------------------------------|
 * | `pub_database` | `PrismaService.$queryRaw SELECT 1` — DB connectivity        |
 * | `pub_storage`  | Write probe to `PUB_STORAGE_ROOT` — disk accessible        |
 * | `pub_epubcheck`| JAR exists at `EPUBCHECK_JAR_PATH` + `java -version` OK   |
 *
 * ### Acceptance criteria (PUB-018)
 * - `EPUBCHECK_JAR_PATH` not set → `pub_epubcheck.status = "down"` with
 *   `reason: "EPUBCHECK_JAR_PATH not configured"`.
 * - DB unreachable → `pub_database.status = "down"`.
 * - All present → every key is `"up"`.
 * - Responds in < 500 ms: JAR presence is checked via `existsSync` only;
 *   `java -version` has a 3 s timeout — no actual epubcheck run.
 *
 * Placed in `infrastructure/` because it accesses `PrismaService` (another
 * infra component) and performs disk I/O and process spawning — all infra
 * concerns. RULE-05: infrastructure/ does not import modules/. ✓
 *
 * RULE-08: no console.log — uses NestJS Logger. ✓
 */
@Injectable()
export class PubHealthIndicator extends HealthIndicator {
  private readonly logger = new Logger(PubHealthIndicator.name);
  private readonly storageRoot: string | undefined;
  private readonly jarPath: string | undefined;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    super();
    this.storageRoot = this.config.get<string>('PUB_STORAGE_ROOT');
    this.jarPath = this.config.get<string>('EPUBCHECK_JAR_PATH');
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Public check methods — called by HealthController
  // ──────────────────────────────────────────────────────────────────────────

  /**
   * Verifies database connectivity via a lightweight `SELECT 1` query.
   *
   * @throws HealthCheckError when the DB is unreachable.
   */
  async checkDatabase(): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return this.getStatus('pub_database', true);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`pub_database DOWN: ${reason}`);
      throw new HealthCheckError(
        'pub_database DOWN',
        this.getStatus('pub_database', false, { reason }),
      );
    }
  }

  /**
   * Verifies that the storage root is writable by writing and deleting a
   * probe file.
   *
   * @throws HealthCheckError when `PUB_STORAGE_ROOT` is absent or unwritable.
   */
  async checkStorage(): Promise<HealthIndicatorResult> {
    if (!this.storageRoot) {
      this.logger.warn('pub_storage DOWN: PUB_STORAGE_ROOT not configured');
      throw new HealthCheckError(
        'pub_storage DOWN',
        this.getStatus('pub_storage', false, {
          reason: 'PUB_STORAGE_ROOT not configured',
        }),
      );
    }

    const probe = join(this.storageRoot, `.health-probe-${Date.now()}`);
    try {
      await writeFile(probe, 'ok');
      await unlink(probe);
      return this.getStatus('pub_storage', true);
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      this.logger.warn(`pub_storage DOWN: ${reason}`);
      throw new HealthCheckError(
        'pub_storage DOWN',
        this.getStatus('pub_storage', false, { reason }),
      );
    }
  }

  /**
   * Verifies that epubcheck is operational:
   * 1. `EPUBCHECK_JAR_PATH` is configured.
   * 2. The JAR file exists on disk.
   * 3. `java -version` exits 0 (JRE on PATH).
   *
   * Does NOT execute epubcheck itself — only checks prerequisites, so
   * response stays within the 500 ms budget.
   *
   * @throws HealthCheckError when any prerequisite is missing.
   */
  async checkEpubcheck(): Promise<HealthIndicatorResult> {
    if (!this.jarPath) {
      this.logger.warn('pub_epubcheck DOWN: EPUBCHECK_JAR_PATH not configured');
      throw new HealthCheckError(
        'pub_epubcheck DOWN',
        this.getStatus('pub_epubcheck', false, {
          reason: 'EPUBCHECK_JAR_PATH not configured',
        }),
      );
    }

    if (!existsSync(this.jarPath)) {
      const reason = `EPUBCHECK_JAR_PATH not found at ${this.jarPath}`;
      this.logger.warn(`pub_epubcheck DOWN: ${reason}`);
      throw new HealthCheckError(
        'pub_epubcheck DOWN',
        this.getStatus('pub_epubcheck', false, { reason }),
      );
    }

    try {
      await execFileAsync('java', ['-version'], { timeout: 3_000 });
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (err) {
      const reason = 'java not available on PATH or JRE check timed out';
      this.logger.warn(`pub_epubcheck DOWN: ${reason}`);
      throw new HealthCheckError(
        'pub_epubcheck DOWN',
        this.getStatus('pub_epubcheck', false, { reason }),
      );
    }

    return this.getStatus('pub_epubcheck', true, {
      jarPath: this.jarPath,
    });
  }
}
