import { Injectable, Logger } from '@nestjs/common';

import type { MetadadosEntity } from '../../../domain/comp/metadados.aggregate';
import type { MetadadosRepository } from '../../../modules/comp/ports/metadados-repository.port';
import { MetadadosMapper } from './metadados.mapper';
import { PrismaEmpresaService } from '../../persistence/prisma-empresa.service';

/**
 * Prisma-backed adapter for `MetadadosRepository` outbound port.
 *
 * Tenant routing is handled by `PrismaEmpresaService`: every query executes
 * against the schema set in the current request context (AsyncLocalStorage,
 * populated by EmpresaContextMiddleware, or by `PrismaEmpresaService.runWithSlug`
 * in tests).
 *
 * RULE-01/02: no @prisma/client or @nestjs imports in domain — this adapter is the bridge.
 * RULE-07: empresa context is required; `withCurrentTenant` throws if not set.
 *
 * Note: `upsert` uses the entity's `empresaSlug` directly (set by the use case from
 * the request context), providing a double-check at the data level. For `findByProjetoId`
 * and `delete`, the slug is read from AsyncLocalStorage via `withCurrentTenant`.
 */
@Injectable()
export class PrismaMetadadosRepository implements MetadadosRepository {
  private readonly logger = new Logger(PrismaMetadadosRepository.name);

  constructor(private readonly empresaService: PrismaEmpresaService) {}

  /**
   * Returns the Metadados aggregate for the given project, or null when not found.
   *
   * Schema is resolved from the current empresa context (AsyncLocalStorage).
   * The caller (GetMetadadosViewUseCase) applies the lazy-default (D-M) logic.
   */
  async findByProjetoId(projetoId: string): Promise<MetadadosEntity | null> {
    this.logger.debug(`findByProjetoId projetoId=${projetoId}`);

    const slug = PrismaEmpresaService.getCurrentSlug();
    if (!slug) {
      throw new Error(
        'PrismaMetadadosRepository: empresa context not set. Call runWithSlug or ensure middleware is active.',
      );
    }

    const row = await this.empresaService.withSlug(slug, (client) =>
      client.metadados.findUnique({ where: { projetoId } }),
    );

    if (!row) {
      this.logger.debug(`findByProjetoId no row projetoId=${projetoId}`);
      return null;
    }
    return MetadadosMapper.toDomain(row, slug);
  }

  /**
   * Idempotent upsert keyed on `projetoId`.
   *
   * Creates the row on first call; subsequent calls overwrite mutable fields.
   * Returns the persisted aggregate with DB-assigned values (id, atualizadoEm).
   *
   * Uses `entity.empresaSlug` for tenant routing (use case sets it from the
   * request context before calling the repo — provides a safety double-check).
   */
  async upsert(entity: MetadadosEntity): Promise<MetadadosEntity> {
    this.logger.debug(
      `upsert projetoId=${entity.projetoId} empresa=${entity.empresaSlug} materialized=${entity.materialized}`,
    );

    const createInput = MetadadosMapper.toUpsertCreateInput(entity);
    const updateInput = MetadadosMapper.toUpsertUpdateInput(entity);

    const row = await this.empresaService.withSlug(entity.empresaSlug, (client) =>
      client.metadados.upsert({
        where: { projetoId: entity.projetoId },
        create: createInput,
        update: updateInput,
      }),
    );

    this.logger.debug(`upsert done id=${row.id} projetoId=${row.projetoId}`);
    return MetadadosMapper.toDomain(row, entity.empresaSlug);
  }

  /**
   * Batch fetch for multiple projects — ONE `findMany` query (no N+1).
   *
   * Returns only found projects as domain aggregates. Missing projetoIds are
   * absent from the result; callers treat absence as `materialized=false` (D-M).
   *
   * Schema is resolved from the current empresa context (AsyncLocalStorage).
   * Called by ProjectMetadataUseCase (COMP-017).
   */
  async findManyByProjetoIds(ids: string[]): Promise<MetadadosEntity[]> {
    if (ids.length === 0) {
      return [];
    }

    this.logger.debug(`findManyByProjetoIds count=${ids.length}`);

    const slug = PrismaEmpresaService.getCurrentSlug();
    if (!slug) {
      throw new Error(
        'PrismaMetadadosRepository: empresa context not set. Call runWithSlug or ensure middleware is active.',
      );
    }

    const rows = await this.empresaService.withSlug(slug, (client) =>
      client.metadados.findMany({
        where: { projetoId: { in: ids } },
      }),
    );

    this.logger.debug(
      `findManyByProjetoIds found=${rows.length} of requested=${ids.length}`,
    );

    return rows.map((row) => MetadadosMapper.toDomain(row, slug));
  }

  /**
   * Deletes the Metadados row for the given project. Idempotent: silences NOT_FOUND.
   *
   * Schema is resolved from the current empresa context (AsyncLocalStorage).
   * Called by CompositionErasureUseCase as part of the LGPD purge cascade.
   */
  async delete(projetoId: string): Promise<void> {
    this.logger.debug(`delete projetoId=${projetoId}`);

    const slug = PrismaEmpresaService.getCurrentSlug();
    if (!slug) {
      throw new Error(
        'PrismaMetadadosRepository: empresa context not set. Call runWithSlug or ensure middleware is active.',
      );
    }

    await this.empresaService.withSlug(slug, async (client) => {
      await client.metadados.deleteMany({ where: { projetoId } });
    });

    this.logger.debug(`delete done projetoId=${projetoId}`);
  }
}
