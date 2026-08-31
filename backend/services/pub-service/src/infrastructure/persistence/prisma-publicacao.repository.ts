import { Injectable, Logger } from '@nestjs/common';

import { PublicacaoEntity } from '../../domain/pub/publicacao.entity';
import { PublicacaoStatus } from '../../domain/pub/publicacao-status.enum';
import type { PublicacaoRepositoryPort } from '../../domain/pub/ports/publicacao-repository.port';
import { PrismaService } from './prisma.service';
import { PublicacaoMapper } from './publicacao.mapper';

/**
 * Prisma-backed adapter for `PublicacaoRepositoryPort` (PUB-008, D-545).
 *
 * All tables live in the tenant schema resolved from `EmpresaContext` before
 * this adapter is called (RULE-07 — the application service enforces the
 * context guard). The adapter receives an already-tenant-scoped `PrismaService`
 * connection and never embeds `empresaId` as a column discriminator (the
 * schema-per-tenant strategy handles isolation at the schema level,
 * ADR-003-multi-tenancy.md).
 *
 * RULE-01/02: zero `@nestjs/*` decorators on domain types, zero `@prisma/client`
 * imports in domain/. This file lives in infrastructure/ — it is the bridge.
 * RULE-05: infrastructure/ does not import modules/ (only modules/ ports, which
 * are interface definitions, are imported).
 */
@Injectable()
export class PrismaPublicacaoRepository implements PublicacaoRepositoryPort {
  private readonly logger = new Logger(PrismaPublicacaoRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Returns the project's in-flight (`gerando`|`validando`) Publicacao, if
   * any. The partial unique index `uq_publicacao_projeto_inflight` guarantees
   * at most one row matches (D-R), so `findFirst` is equivalent to `findUnique`
   * here.
   */
  async findInFlight(projetoId: string): Promise<PublicacaoEntity | null> {
    const model = await this.prisma.publicacao.findFirst({
      where: {
        projetoId,
        status: { in: [PublicacaoStatus.GERANDO, PublicacaoStatus.VALIDANDO] },
      },
    });
    return model ? PublicacaoMapper.toDomain(model) : null;
  }

  /**
   * Returns the next monotonic `sequencia` for the project.
   *
   * Computed application-side as MAX(sequencia) + 1 (data-model.md §2.1).
   * The DB-level `uq_publicacao_projeto_seq` UNIQUE constraint is the final
   * safety net if two concurrent calls race; the `uq_publicacao_projeto_inflight`
   * partial index already prevents concurrent in-flight builds (D-R), making
   * that race practically impossible in the normal path.
   */
  async nextSequencia(projetoId: string): Promise<number> {
    const result = await this.prisma.publicacao.aggregate({
      where: { projetoId },
      _max: { sequencia: true },
    });
    return (result._max.sequencia ?? 0) + 1;
  }

  /**
   * Persists the aggregate by id — upsert semantics (create on first save;
   * update on subsequent saves for the in-flight row transitioning through
   * the build-machine states).
   *
   * Terminal rows (`publicado`|`com_erros`) are never passed to `save` again
   * (data-model.md §2.1, invariant); the upsert is therefore safe in practice.
   */
  async save(publicacao: PublicacaoEntity): Promise<PublicacaoEntity> {
    const model = await this.prisma.publicacao.upsert({
      where: { id: publicacao.id },
      create: PublicacaoMapper.toCreateInput(publicacao),
      update: PublicacaoMapper.toUpdateInput(publicacao),
    });
    this.logger.debug(`publicacao saved: id=${model.id} status=${model.status}`);
    return PublicacaoMapper.toDomain(model);
  }

  /**
   * Finds a `Publicacao` by its id, scoped to the given project.
   *
   * Returns `null` when the id does not exist or does not belong to the
   * specified `projetoId` (prevents cross-project reads).
   */
  async findById(projetoId: string, publicacaoId: string): Promise<PublicacaoEntity | null> {
    const model = await this.prisma.publicacao.findFirst({
      where: { id: publicacaoId, projetoId },
    });
    return model ? PublicacaoMapper.toDomain(model) : null;
  }

  /**
   * Returns the full history for a project, newest first (api-contract §4.3).
   *
   * Ordered by `sequencia DESC` so the most recent attempt is first.
   */
  async listByProjeto(projetoId: string): Promise<PublicacaoEntity[]> {
    const models = await this.prisma.publicacao.findMany({
      where: { projetoId },
      orderBy: { sequencia: 'desc' },
    });
    return PublicacaoMapper.toDomainList(models);
  }

  /**
   * Returns the latest (highest `sequencia`) publication for each projetoId
   * in a SINGLE batched query (integration-contracts §1.1, no N+1).
   *
   * Algorithm:
   *  1. Issue ONE `findMany` filtered by `projetoId IN (...)`, ordered DESC by
   *     `sequencia`.
   *  2. Group in memory: the first row encountered per projetoId is the latest
   *     (O(n) pass; the ORDER BY guarantees this).
   *
   * Empty input → empty Map (no DB round-trip).
   */
  async findLatestByProjetoIds(
    projetoIds: string[],
  ): Promise<Map<string, PublicacaoEntity>> {
    if (projetoIds.length === 0) {
      return new Map();
    }

    const models = await this.prisma.publicacao.findMany({
      where: { projetoId: { in: projetoIds } },
      orderBy: { sequencia: 'desc' },
    });

    const result = new Map<string, PublicacaoEntity>();
    for (const model of models) {
      if (!result.has(model.projetoId)) {
        result.set(model.projetoId, PublicacaoMapper.toDomain(model));
      }
    }
    return result;
  }

  /**
   * Finds a single Publicacao by its own id without a projetoId guard.
   *
   * Tenant isolation is enforced at the schema level (search_path), so
   * `findUnique` is already scoped to the active tenant schema.
   * Returns null when the id does not exist.
   */
  async findByPublicacaoId(publicacaoId: string): Promise<PublicacaoEntity | null> {
    const model = await this.prisma.publicacao.findUnique({
      where: { id: publicacaoId },
    });
    return model ? PublicacaoMapper.toDomain(model) : null;
  }

  /**
   * Deletes all publication rows for a project (idempotent — 0 deleted rows
   * is not an error). Prisma cascades `validation_message` rows via FK.
   *
   * Called by PublicationErasurePort.erase() (PUB-015) before file artifacts
   * are deleted from storage.
   */
  async deleteAllByProjeto(projetoId: string): Promise<void> {
    await this.prisma.publicacao.deleteMany({ where: { projetoId } });
    this.logger.debug(`deleteAllByProjeto: cleared publications for projetoId=${projetoId}`);
  }

  /**
   * Returns all publications stuck in a non-terminal state for longer than
   * `olderThanMinutes` minutes (PUB-020).
   *
   * Operational diagnostic method — used by the reconciliation script only;
   * never exposed via REST. Tenant isolation is enforced at the schema level
   * (search_path), consistent with all other repository methods (ADR-003).
   */
  async findStaleInFlight(olderThanMinutes: number): Promise<PublicacaoEntity[]> {
    const cutoff = new Date(Date.now() - olderThanMinutes * 60_000);
    const models = await this.prisma.publicacao.findMany({
      where: {
        status: { in: [PublicacaoStatus.GERANDO, PublicacaoStatus.VALIDANDO] },
        iniciadaEm: { lt: cutoff },
      },
      orderBy: { iniciadaEm: 'asc' },
    });
    return PublicacaoMapper.toDomainList(models);
  }
}
