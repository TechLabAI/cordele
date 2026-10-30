import { PublicacaoEntity } from '../publicacao.entity';

/**
 * Outbound port: PUB's own aggregate persistence (domain-level).
 *
 * Defined in `domain/` so infrastructure/ (PrismaPublicacaoRepository) and
 * modules/ (use cases) can both import it without RULE-05 violations:
 *   infrastructure/ may import domain/ — permitted.
 *   modules/ may import domain/ — permitted.
 *   infrastructure/ must NOT import modules/ — RULE-05.
 *
 * Real Prisma adapter bound in P3 (PUB-008). P2 use cases are tested
 * against Jest mocks of this interface.
 */
export interface PublicacaoRepositoryPort {
  /** The project's in-flight (`gerando`|`validando`) Publicacao, if any (D-R). */
  findInFlight(projetoId: string): Promise<PublicacaoEntity | null>;

  /** Next per-project sequencia — contiguous, unique (data-model.md `uq_publicacao_projeto_seq`). */
  nextSequencia(projetoId: string): Promise<number>;

  /**
   * Creates or updates the aggregate by id. In practice append-only: only
   * the in-flight row transitions gerando -> validando -> terminal; a
   * terminal row is never saved again (data-model.md §2.1).
   */
  save(publicacao: PublicacaoEntity): Promise<PublicacaoEntity>;

  /** Returns null when publicacaoId does not exist or does not belong to projetoId. */
  findById(projetoId: string, publicacaoId: string): Promise<PublicacaoEntity | null>;

  /** Full history for a project, newest first (api-contract §4.3). */
  listByProjeto(projetoId: string): Promise<PublicacaoEntity[]>;

  /**
   * Returns the latest (highest `sequencia`) publication for each projetoId in
   * a SINGLE batched query — no N+1.
   *
   * Projects with no publications are absent from the returned Map.
   *
   * Used by PublicationHistoryPort.latest() (PUB-014, integration-contracts §1.1).
   *
   * @param projetoIds - list of project UUIDs (may be empty → returns empty Map)
   */
  findLatestByProjetoIds(
    projetoIds: string[],
  ): Promise<Map<string, PublicacaoEntity>>;

  /**
   * Returns a single publication by its own id (without requiring projetoId).
   *
   * Tenant isolation is enforced at the schema level (schema-per-empresa via
   * `PrismaEmpresaService` — one PrismaClient per schema, ADR-003 D-619), so no
   * additional projetoId discriminator is needed.
   * Returns null when the id does not exist in the current tenant schema.
   *
   * Used by PublicationHistoryPort.signedDownloadUrl() (PUB-014).
   */
  findByPublicacaoId(publicacaoId: string): Promise<PublicacaoEntity | null>;

  /**
   * Deletes all publication rows for a project. Idempotent — deleting zero
   * rows (project already erased) is not an error.
   *
   * Used by PublicationErasurePort.erase() (PUB-015).
   *
   * @param projetoId - project UUID whose rows must be removed
   */
  deleteAllByProjeto(projetoId: string): Promise<void>;

  /**
   * Returns all publications stuck in a non-terminal state for longer than
   * `olderThanMinutes` minutes. Used exclusively by the reconciliation script
   * and the operational runbook — never exposed via REST.
   *
   * A publication is considered stale when:
   *   status IN ('gerando', 'validando')
   *   AND iniciadaEm < now() - interval '<olderThanMinutes> minutes'
   *
   * @param olderThanMinutes - threshold in minutes (typical: 60)
   */
  findStaleInFlight(olderThanMinutes: number): Promise<PublicacaoEntity[]>;
}

/** DI injection token for PublicacaoRepositoryPort. Re-exported by pub.tokens.ts. */
export const PublicacaoRepositoryPort = Symbol('PublicacaoRepositoryPort');
