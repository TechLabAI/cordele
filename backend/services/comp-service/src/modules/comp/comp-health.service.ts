import { Inject, Injectable, Logger } from '@nestjs/common';
import { join } from 'path';
import { writeFile, unlink } from 'fs/promises';

import type { DatabaseHealthPort } from './ports/database-health.port';
import { COMP_DATABASE_HEALTH_PORT } from './ports/database-health.port';

/**
 * Result shape returned by `CompHealthService.check()`.
 *
 * `status` summary:
 *   - `'ok'`       — DB reachable AND storage writable.
 *   - `'degraded'` — DB ok; storage probe failed (cover uploads unavailable,
 *                    metadata/layout reads still healthy).
 *   - `'fail'`     — DB unreachable; service effectively down for writes.
 *
 * Intentionally avoids `@nestjs/terminus` so the shape is a plain TS contract
 * with no framework coupling (COMP-019 rewrite — simpler API).
 */
export interface HealthCheckResult {
  status: 'ok' | 'degraded' | 'fail';
  checks: {
    db: 'ok' | 'fail';
    storage: 'ok' | 'degraded';
  };
}

/**
 * Readiness health service for the COMP bounded context (COMP-019 refactor).
 *
 * Replaces the terminus-based `CompHealthIndicator` with a simpler service
 * that returns a plain `HealthCheckResult` without framework-specific types.
 *
 * Checks performed by `check()`:
 *   1. **DB** — delegates to `DatabaseHealthPort.pingDatabase()` (RULE-04 compliant).
 *      Failure → `status: 'fail'` (critical).
 *   2. **Storage** — write + delete probe in `COMP_STORAGE_DIR`.
 *      Failure → `status: 'degraded'` (non-critical; metadata/layout still ok).
 *
 * RULE-04: injects `DatabaseHealthPort` via token — no direct infrastructure import.
 * RULE-08: no console.log — uses NestJS Logger.
 */
@Injectable()
export class CompHealthService {
  private readonly logger = new Logger(CompHealthService.name);
  private readonly storageDir: string;

  constructor(
    @Inject(COMP_DATABASE_HEALTH_PORT)
    private readonly dbHealth: DatabaseHealthPort,
  ) {
    this.storageDir = process.env['COMP_STORAGE_DIR'] ?? 'storage/comp';
  }

  /** Run all health probes and return a composite result. */
  async check(): Promise<HealthCheckResult> {
    const db = await this.checkDb();
    const storage = await this.checkStorage();

    const status: 'ok' | 'degraded' | 'fail' =
      db === 'fail' ? 'fail' : storage === 'degraded' ? 'degraded' : 'ok';

    return { status, checks: { db, storage } };
  }

  // -------------------------------------------------------------------------
  // Private probes
  // -------------------------------------------------------------------------

  private async checkDb(): Promise<'ok' | 'fail'> {
    const ok = await this.dbHealth.pingDatabase();
    if (!ok) {
      this.logger.warn('DB health probe failed');
    }
    return ok ? 'ok' : 'fail';
  }

  private async checkStorage(): Promise<'ok' | 'degraded'> {
    const probeFile = join(this.storageDir, `.healthcheck-${process.pid}`);
    try {
      await writeFile(probeFile, 'healthcheck');
      await unlink(probeFile);
      return 'ok';
    } catch (err) {
      this.logger.warn(
        `Storage health probe failed: dir=${this.storageDir} err=${err instanceof Error ? err.message : String(err)}`,
      );
      return 'degraded';
    }
  }
}
