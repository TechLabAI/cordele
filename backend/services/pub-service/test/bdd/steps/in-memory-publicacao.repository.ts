/**
 * InMemoryPublicacaoRepository — purely in-memory implementation of
 * `PublicacaoRepositoryPort` for BDD step definitions (P8 / PUB-019).
 *
 * Tenant isolation is NOT enforced here (no schema-per-empresa filter). Tests
 * that exercise multi-empresa isolation do so by controlling what is seeded
 * into the repository, not by filtering on the ALS context.
 */
import { PublicacaoEntity } from 'src/domain/pub/publicacao.entity';
import { PublicacaoStatus } from 'src/domain/pub/publicacao-status.enum';
import { type PublicacaoRepositoryPort } from 'src/domain/pub/ports/publicacao-repository.port';

export class InMemoryPublicacaoRepository implements PublicacaoRepositoryPort {
  private readonly rows: Map<string, PublicacaoEntity> = new Map();

  /** Resets the repository to an empty state (convenience for afterEach). */
  clear(): void {
    this.rows.clear();
  }

  async findInFlight(projetoId: string): Promise<PublicacaoEntity | null> {
    for (const pub of this.rows.values()) {
      if (
        pub.projetoId === projetoId &&
        (pub.status === PublicacaoStatus.GERANDO || pub.status === PublicacaoStatus.VALIDANDO)
      ) {
        return pub;
      }
    }
    return null;
  }

  async nextSequencia(projetoId: string): Promise<number> {
    let count = 0;
    for (const pub of this.rows.values()) {
      if (pub.projetoId === projetoId) count++;
    }
    return count + 1;
  }

  async save(publicacao: PublicacaoEntity): Promise<PublicacaoEntity> {
    this.rows.set(publicacao.id, publicacao);
    return publicacao;
  }

  async findById(projetoId: string, publicacaoId: string): Promise<PublicacaoEntity | null> {
    const pub = this.rows.get(publicacaoId);
    return pub && pub.projetoId === projetoId ? pub : null;
  }

  async listByProjeto(projetoId: string): Promise<PublicacaoEntity[]> {
    const result: PublicacaoEntity[] = [];
    for (const pub of this.rows.values()) {
      if (pub.projetoId === projetoId) result.push(pub);
    }
    // Newest first — highest sequencia first (api-contract §4.3).
    return result.sort((a, b) => b.sequencia - a.sequencia);
  }

  async findLatestByProjetoIds(projetoIds: string[]): Promise<Map<string, PublicacaoEntity>> {
    const result = new Map<string, PublicacaoEntity>();
    for (const projetoId of projetoIds) {
      const sorted = await this.listByProjeto(projetoId);
      if (sorted.length > 0) {
        result.set(projetoId, sorted[0]);
      }
    }
    return result;
  }

  async findByPublicacaoId(publicacaoId: string): Promise<PublicacaoEntity | null> {
    return this.rows.get(publicacaoId) ?? null;
  }

  async deleteAllByProjeto(projetoId: string): Promise<void> {
    for (const [id, pub] of this.rows) {
      if (pub.projetoId === projetoId) this.rows.delete(id);
    }
  }

  /**
   * Returns publications stuck in a non-terminal state for longer than
   * `olderThanMinutes` minutes. In-memory implementation for BDD tests.
   * Mirrors the Prisma adapter semantics (PUB-020).
   */
  async findStaleInFlight(olderThanMinutes: number): Promise<PublicacaoEntity[]> {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
    const result: PublicacaoEntity[] = [];
    for (const pub of this.rows.values()) {
      if (
        (pub.status === PublicacaoStatus.GERANDO || pub.status === PublicacaoStatus.VALIDANDO) &&
        pub.iniciadaEm < cutoff
      ) {
        result.push(pub);
      }
    }
    return result.sort((a, b) => a.iniciadaEm.getTime() - b.iniciadaEm.getTime());
  }
}
