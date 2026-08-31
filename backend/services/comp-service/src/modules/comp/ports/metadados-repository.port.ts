import type { Metadados } from '../../../domain/comp/metadados.aggregate';

/**
 * Outbound repository port for the Metadados aggregate (COMP-004).
 *
 * One instance per project (UNIQUE projeto_id in the DB).
 * Adapters: PrismaMetadadosRepository (infrastructure/persistence).
 *
 * Pure TypeScript interface — no @nestjs/* or @prisma/client imports (RULE-01/02).
 * Declared in modules/comp/ports so that all application-layer use cases can
 * import it without touching infrastructure/ directly (RULE-04).
 */
export interface MetadadosRepository {
  /**
   * Returns the persisted Metadados aggregate for the given project,
   * or null when no row exists yet (lazy-default caller applies D-M).
   */
  findByProjetoId(projetoId: string): Promise<Metadados | null>;

  /**
   * Idempotent upsert keyed on `projetoId`.
   *
   * Creates the row on first call; subsequent calls overwrite mutable fields.
   * Returns the persisted aggregate with DB-assigned values (id, atualizadoEm).
   */
  upsert(metadados: Metadados): Promise<Metadados>;

  /**
   * Batch fetch for multiple projects — ONE DB query regardless of list size (no N+1).
   *
   * Returns only found projects (array of domain aggregates). Projects with no
   * persisted row are absent from the result; callers treat absence as
   * `materialized=false` (D-M lazy default).
   *
   * Schema routing is handled by the concrete adapter via the current empresa
   * context (AsyncLocalStorage, RULE-07). Callers must be in a request context
   * where EmpresaContext is set.
   *
   * Called by ProjectMetadataUseCase (COMP-017) as the single-query batch fetch.
   */
  findManyByProjetoIds(ids: string[]): Promise<Metadados[]>;

  /**
   * Deletes the Metadados row for the given project. Idempotent: silences NOT_FOUND.
   *
   * Called by CompositionErasureUseCase as part of the LGPD purge cascade.
   */
  delete(projetoId: string): Promise<void>;
}
