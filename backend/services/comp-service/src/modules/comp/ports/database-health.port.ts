/**
 * Port for database health probing used by the COMP bounded context (COMP-019).
 *
 * Allows `CompHealthService` (in modules/) to probe database connectivity without
 * importing `PrismaService` directly from `infrastructure/persistence/`
 * (RULE-04 compliance).
 *
 * The concrete implementation (`PrismaDatabaseHealthAdapter`) lives in
 * `infrastructure/comp/persistence/` and is bound to this token in
 * `AppModule` (composition root).
 *
 * RULE-01: no @nestjs/* or @prisma/client in this file — pure domain port.
 */

/**
 * Port for checking whether the underlying database is reachable.
 */
export interface DatabaseHealthPort {
  /**
   * Execute a lightweight ping query against the database.
   *
   * @returns `true` when the database responded successfully, `false` on failure.
   */
  pingDatabase(): Promise<boolean>;
}

/**
 * DI token for the `DatabaseHealthPort` adapter.
 * Bound in `AppModule` to `PrismaDatabaseHealthAdapter`.
 */
export const COMP_DATABASE_HEALTH_PORT = Symbol('CompDatabaseHealthPort');
