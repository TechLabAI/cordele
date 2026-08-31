import type { ConfiguracaoLayout } from '../../../domain/comp/configuracao-layout.aggregate';

/**
 * Outbound port for ConfiguracaoLayout persistence.
 *
 * Pure TypeScript interface — no @nestjs/* or @prisma/client imports (RULE-01/02).
 * Every operation is scoped to the tenant schema via EmpresaContext (RULE-07);
 * the concrete Prisma adapter reads the schema from EmpresaContext.slug.
 *
 * The injection token is declared in comp.tokens.ts (COMP_LAYOUT_REPO)
 * and bound in CompModule.
 */
export interface ConfiguracaoLayoutRepositoryPort {
  /**
   * Returns the ConfiguracaoLayout for the given project, or null when no row exists.
   * The caller (GetLayoutViewUseCase) is responsible for the lazy-default (D-M) logic.
   */
  findByProjetoId(id: string): Promise<ConfiguracaoLayout | null>;

  /**
   * Idempotent upsert: creates or replaces the layout row + atomically replaces the
   * override set for entity.projetoId.
   *
   * Concrete implementations must atomically persist both the layout fields and
   * the complete override set in a single transaction to prevent partial states
   * (RULE-03: transaction coordinated by the use case caller).
   *
   * Returns the persisted aggregate (DB-assigned id + atualizadoEm).
   */
  upsert(layout: ConfiguracaoLayout): Promise<ConfiguracaoLayout>;
}
