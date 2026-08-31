import { Injectable, Logger } from '@nestjs/common';

import type { ConfiguracaoLayout } from '../../../domain/comp/configuracao-layout.aggregate';
import type { LayoutOverride } from '../../../domain/comp/layout-override.entity';
import type { ConfiguracaoLayoutRepositoryPort } from '../../../modules/comp/ports/configuracao-layout-repository.port';
import { ConfiguracaoLayoutMapper } from './configuracao-layout.mapper';
import { PrismaEmpresaService } from '../../persistence/prisma-empresa.service';

/**
 * Prisma-backed adapter for `ConfiguracaoLayoutRepositoryPort`.
 *
 * All queries execute against the tenant schema resolved by `PrismaEmpresaService`
 * (AsyncLocalStorage populated by EmpresaContextMiddleware, or
 * `PrismaEmpresaService.runWithSlug` in tests).
 *
 * `upsert` atomically replaces both the layout row and all its overrides in a single
 * `$transaction` — preventing partial states that could corrupt the layout.
 *
 * `replaceOverrides` is kept as a public utility method (used by integration tests
 * and PrismaCompositionErasureAdapter indirectly; not part of the interface).
 *
 * RULE-01/02: no @prisma/client or @nestjs imports in domain.
 * RULE-07: empresa context is required for every query.
 */
@Injectable()
export class PrismaConfiguracaoLayoutRepository implements ConfiguracaoLayoutRepositoryPort {
  private readonly logger = new Logger(PrismaConfiguracaoLayoutRepository.name);

  constructor(private readonly empresaService: PrismaEmpresaService) {}

  /**
   * Returns the ConfiguracaoLayout for the given project (with overrides), or null.
   *
   * Schema is resolved from the current empresa context (AsyncLocalStorage).
   */
  async findByProjetoId(projetoId: string): Promise<ConfiguracaoLayout | null> {
    this.logger.debug(`findByProjetoId projetoId=${projetoId}`);

    const slug = PrismaEmpresaService.getCurrentSlug();
    if (!slug) {
      throw new Error(
        'PrismaConfiguracaoLayoutRepository: empresa context not set. ' +
        'Ensure EmpresaContextMiddleware is active or call runWithSlug in tests.',
      );
    }

    const row = await this.empresaService.withSlug(slug, (client) =>
      client.configuracaoLayout.findUnique({
        where: { projetoId },
        include: { overrides: { orderBy: { ordem: 'asc' } } },
      }),
    );

    if (!row) {
      this.logger.debug(`findByProjetoId no row projetoId=${projetoId}`);
      return null;
    }
    return ConfiguracaoLayoutMapper.toDomain(row, slug);
  }

  /**
   * Idempotent upsert keyed on `projetoId`.
   *
   * Atomically:
   *   1. Upserts the configuracao_layout row (typography + margin fields).
   *   2. Deletes all existing layout_override rows for this project.
   *   3. Inserts the new override set from entity.overrides.
   *
   * Returns the persisted aggregate (DB-assigned id + atualizadoEm + all overrides).
   *
   * Uses `entity.empresaSlug` for tenant routing; falls back to AsyncLocalStorage when
   * empresaSlug is empty (defensive: covers createDefault() without slug).
   */
  async upsert(entity: ConfiguracaoLayout): Promise<ConfiguracaoLayout> {
    this.logger.debug(
      `upsert projetoId=${entity.projetoId} empresa=${entity.empresaSlug} materialized=${entity.materialized}`,
    );

    const slug = entity.empresaSlug || PrismaEmpresaService.getCurrentSlug();
    if (!slug) {
      throw new Error(
        'PrismaConfiguracaoLayoutRepository: empresa context not set. ' +
        'Ensure EmpresaContextMiddleware is active or call runWithSlug in tests.',
      );
    }

    const createInput = ConfiguracaoLayoutMapper.toUpsertCreateInput(entity);
    const updateInput = ConfiguracaoLayoutMapper.toUpsertUpdateInput(entity);
    const overridesArray = [...entity.overrides];

    const row = await this.empresaService.withSlug(slug, async (client) => {
      return client.$transaction(async (tx) => {
        // 1. Upsert the layout row.
        const upserted = await tx.configuracaoLayout.upsert({
          where: { projetoId: entity.projetoId },
          create: createInput,
          update: updateInput,
        });

        // 2. Atomically replace the override set (delete-all + bulk-insert).
        await tx.layoutOverride.deleteMany({
          where: { configuracaoLayoutId: upserted.id },
        });

        if (overridesArray.length > 0) {
          await tx.layoutOverride.createMany({
            data: overridesArray.map((o) =>
              ConfiguracaoLayoutMapper.overrideToCreateInput(o, upserted.id),
            ),
          });
        }

        // 3. Return the updated row with the fresh overrides.
        return tx.configuracaoLayout.findUniqueOrThrow({
          where: { projetoId: entity.projetoId },
          include: { overrides: { orderBy: { ordem: 'asc' } } },
        });
      });
    });

    this.logger.debug(`upsert done id=${row.id} projetoId=${row.projetoId}`);
    return ConfiguracaoLayoutMapper.toDomain(row, slug);
  }

  /**
   * Atomically replaces all `layout_override` rows for the given project.
   *
   * Utility method kept for integration tests and the composition erasure adapter.
   * The normal write path uses `upsert` (which handles overrides inline).
   *
   * Returns the updated `ConfiguracaoLayout` with the persisted overrides.
   */
  async replaceOverrides(projetoId: string, overrides: LayoutOverride[]): Promise<ConfiguracaoLayout> {
    this.logger.debug(
      `replaceOverrides projetoId=${projetoId} count=${overrides.length}`,
    );

    const slug = PrismaEmpresaService.getCurrentSlug();
    if (!slug) {
      throw new Error(
        'PrismaConfiguracaoLayoutRepository: empresa context not set. ' +
        'Ensure EmpresaContextMiddleware is active or call runWithSlug in tests.',
      );
    }

    const updated = await this.empresaService.withSlug(slug, async (client) => {
      // 1. Locate the configuracao_layout row (must exist — upsert was called first).
      const existing = await client.configuracaoLayout.findUnique({ where: { projetoId } });
      if (!existing) {
        throw new Error(
          `ConfiguracaoLayout not found for projetoId=${projetoId}. ` +
          'Call upsert before replaceOverrides.',
        );
      }

      // 2. Atomically delete-and-insert the override set.
      return client.$transaction(async (tx) => {
        await tx.layoutOverride.deleteMany({
          where: { configuracaoLayoutId: existing.id },
        });

        if (overrides.length > 0) {
          await tx.layoutOverride.createMany({
            data: overrides.map((o) =>
              ConfiguracaoLayoutMapper.overrideToCreateInput(o, existing.id),
            ),
          });
        }

        // 3. Return the updated row with the fresh overrides.
        return tx.configuracaoLayout.findUniqueOrThrow({
          where: { projetoId },
          include: { overrides: { orderBy: { ordem: 'asc' } } },
        });
      });
    });

    this.logger.debug(`replaceOverrides done projetoId=${projetoId}`);
    return ConfiguracaoLayoutMapper.toDomain(updated, slug);
  }

  /**
   * Deletes the ConfiguracaoLayout row (overrides cascade via FK ON DELETE CASCADE).
   *
   * Idempotent: silences NOT_FOUND. Schema is resolved from AsyncLocalStorage.
   * Called by PrismaCompositionErasureAdapter as part of the LGPD purge cascade.
   */
  async delete(projetoId: string): Promise<void> {
    this.logger.debug(`delete projetoId=${projetoId}`);

    const slug = PrismaEmpresaService.getCurrentSlug();
    if (!slug) {
      throw new Error(
        'PrismaConfiguracaoLayoutRepository: empresa context not set. ' +
        'Ensure EmpresaContextMiddleware is active or call runWithSlug in tests.',
      );
    }

    await this.empresaService.withSlug(slug, async (client) => {
      await client.configuracaoLayout.deleteMany({ where: { projetoId } });
    });

    this.logger.debug(`delete done projetoId=${projetoId}`);
  }
}
