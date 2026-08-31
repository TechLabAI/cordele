import { INestApplication, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Base PrismaClient for process-global operations (health, migrations check).
 *
 * **Tenant data access (P3+):** do NOT use this service directly for COMP domain
 * queries. Use `PrismaEmpresaService` instead — it creates one dedicated
 * `PrismaClient` per tenant schema (`emp_<slug>`) and routes every query to the
 * correct schema (D-619). Using `PrismaService` for tenant queries is a data
 * isolation bug: it connects to the default schema in `DATABASE_URL` and ignores
 * the `SET search_path` Prisma-level limitation.
 *
 * Allowed uses for `PrismaService`:
 * - Health endpoint (`PrismaHealthIndicator`) — schema-agnostic `$queryRaw('SELECT 1')`.
 * - Migration checks — `prisma migrate` reads the base schema for the migration table.
 *
 * Never instantiate `new PrismaClient()` in a repository — each instance opens
 * its own connection pool and will exhaust Postgres `max_connections` under load.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log('Prisma connected');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Prisma disconnected');
  }

  /** Close the pool cleanly when Nest shuts down. */
  async enableShutdownHooks(app: INestApplication): Promise<void> {
    process.on('beforeExit', () => {
      void app.close();
    });
  }
}
