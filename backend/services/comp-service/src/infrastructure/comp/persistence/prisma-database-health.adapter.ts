import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../persistence/prisma.service';
import type { DatabaseHealthPort } from '../../../modules/comp/ports/database-health.port';

/**
 * Prisma-backed implementation of `DatabaseHealthPort` (COMP-019).
 *
 * Executes a `SELECT 1` via `PrismaService.$queryRaw` to verify database
 * connectivity. Returns `true` on success and `false` on any error.
 *
 * `PrismaService` is the correct tool here because this is a schema-agnostic
 * connectivity check (no tenant routing needed — any schema is fine for a ping).
 *
 * Registered in `AppModule` under `COMP_DATABASE_HEALTH_PORT` so
 * `CompHealthService` (modules/) can use the port without importing
 * `infrastructure/` directly (RULE-04 compliance).
 *
 * RULE-08: no console.log — uses Nest Logger.
 */
@Injectable()
export class PrismaDatabaseHealthAdapter implements DatabaseHealthPort {
  private readonly logger = new Logger(PrismaDatabaseHealthAdapter.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Ping the database with `SELECT 1`. Returns `true` on success. */
  async pingDatabase(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch (err) {
      this.logger.warn(
        `DB health probe failed: ${err instanceof Error ? err.message : String(err)}`,
      );
      return false;
    }
  }
}
