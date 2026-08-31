import { AsyncLocalStorage } from 'async_hooks';

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Tenant routing service for COMP — one PrismaClient per schema (D-619).
 *
 * Implements schema-per-tenant by building a dedicated `PrismaClient` for each
 * empresa schema (`emp_<slug>`), caching it by schema name. This bypasses the
 * Prisma `search_path` limitation: Prisma qualifies every query with the schema
 * embedded in `DATABASE_URL` at connection time, so `SET search_path` changes
 * at query level are silently ignored by the generated client. A per-schema
 * client with its own `datasourceUrl` is the correct approach (D-619).
 *
 * Security: slug is validated with `[a-z][a-z0-9_]{1,30}` before interpolation.
 * An invalid slug causes an immediate Error (never reaches Postgres).
 *
 * RULE-07: no COMP data access bypasses this service.
 *
 * Usage (repositories):
 * ```ts
 * await this.empresaService.withCurrentTenant(async (client) => {
 *   return client.metadados.findUnique({ where: { projetoId } });
 * });
 * ```
 */
@Injectable()
export class PrismaEmpresaService implements OnModuleDestroy {
  private readonly logger = new Logger(PrismaEmpresaService.name);

  /**
   * AsyncLocalStorage for the current empresa slug.
   *
   * Populated by EmpresaContextMiddleware (P5) from the JWT claim `empresa_id`.
   * In unit/integration tests, call `PrismaEmpresaService.runWithSlug(slug, fn)`
   * to scope a test block to a specific tenant.
   */
  private static readonly store = new AsyncLocalStorage<string>();

  /** Cached per-schema Prisma clients. Keys are full schema names (`emp_aetos`). */
  private readonly clientsBySchema = new Map<string, PrismaClient>();

  // ---------------------------------------------------------------------------
  // Static context API (used by middleware in P5 and tests)
  // ---------------------------------------------------------------------------

  /**
   * Runs `fn` with `slug` set as the current empresa context.
   *
   * Validates slug before entering the context to fail fast on misconfiguration.
   */
  static runWithSlug<T>(slug: string, fn: () => T): T {
    PrismaEmpresaService.validateSlug(slug);
    return PrismaEmpresaService.store.run(slug, fn);
  }

  /** Returns the current empresa slug, or undefined when outside a request context. */
  static getCurrentSlug(): string | undefined {
    return PrismaEmpresaService.store.getStore();
  }

  // ---------------------------------------------------------------------------
  // Instance API (used by repositories)
  // ---------------------------------------------------------------------------

  /**
   * Executes `fn` with a Prisma client scoped to the current empresa schema.
   *
   * Reads the slug from the AsyncLocalStorage set by the middleware (P5).
   * Throws when called outside a request context (slug not set).
   *
   * The callback receives a `PrismaClient` directly (not a transaction proxy) so
   * repositories can open their own `$transaction` when atomicity is needed
   * (RULE-03: transactions opened in the application service or in the adapter
   * when atomicity is local to the adapter — e.g., `replaceOverrides`).
   */
  async withCurrentTenant<T>(fn: (client: PrismaClient) => Promise<T>): Promise<T> {
    const slug = PrismaEmpresaService.getCurrentSlug();
    if (!slug) {
      throw new Error(
        'PrismaEmpresaService: empresa context is not set. ' +
        'Ensure EmpresaContextMiddleware is active (P5) or call runWithSlug in tests.',
      );
    }
    return this.withSlug(slug, fn);
  }

  /**
   * Executes `fn` with a Prisma client scoped to the given slug.
   *
   * Used internally and for test helpers that bypass the AsyncLocalStorage.
   */
  async withSlug<T>(slug: string, fn: (client: PrismaClient) => Promise<T>): Promise<T> {
    PrismaEmpresaService.validateSlug(slug);
    const schema = `emp_${slug}`;
    const client = this.clientForSchema(schema);
    return fn(client);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Returns the cached PrismaClient for the schema, creating it on first access. */
  private clientForSchema(schema: string): PrismaClient {
    let client = this.clientsBySchema.get(schema);
    if (!client) {
      this.logger.log(`Opening PrismaClient for schema ${schema}`);
      client = new PrismaClient({ datasourceUrl: this.buildSchemaUrl(schema) });
      this.clientsBySchema.set(schema, client);
    }
    return client;
  }

  /**
   * Rewrites `DATABASE_URL` with `?schema=<schema>` to target the tenant schema.
   *
   * Prisma reads `datasourceUrl` at client construction — the schema param is
   * wired into every query at the client level, not per-query.
   */
  private buildSchemaUrl(schema: string): string {
    const base = process.env['DATABASE_URL'];
    if (!base) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    const url = new URL(base);
    url.searchParams.set('schema', schema);
    return url.toString();
  }

  /**
   * Validates the empresa slug before interpolating into a schema name.
   *
   * Pattern: `[a-z][a-z0-9_]{1,30}` — starts with a letter, then lowercase
   * alphanumeric + underscore, total 2–31 chars.
   */
  private static validateSlug(slug: string): void {
    if (!/^[a-z][a-z0-9_]{1,30}$/.test(slug)) {
      throw new Error(
        `PrismaEmpresaService: invalid empresa slug "${slug}". ` +
        'Slug must match [a-z][a-z0-9_]{1,30}.',
      );
    }
  }

  /** Closes every cached per-schema connection pool on Nest module shutdown. */
  async onModuleDestroy(): Promise<void> {
    await Promise.all(
      Array.from(this.clientsBySchema.values()).map((client) => client.$disconnect()),
    );
    this.logger.log('All tenant PrismaClients disconnected');
  }
}
