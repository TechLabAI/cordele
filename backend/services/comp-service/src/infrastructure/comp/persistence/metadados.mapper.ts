import type { Metadados as MetadadosModel } from '../../prisma-client';

import { MetadadosEntity, type Idioma } from '../../../domain/comp/metadados.aggregate';

/**
 * Translates between the Prisma `Metadados` model and the domain `Metadados` aggregate.
 *
 * `MetadadosEntity` is a backward-compatible alias for `Metadados` exported by the aggregate.
 * This is the only file in infrastructure/comp/persistence that knows both shapes.
 *
 * RULE-01: Metadados aggregate does not import @prisma/client — the mapper is the bridge.
 */
export class MetadadosMapper {
  /**
   * Maps a Prisma `Metadados` row to the domain aggregate.
   *
   * @param model       Prisma row from the tenant schema
   * @param empresaSlug Slug of the owning tenant (resolved by PrismaEmpresaService)
   */
  static toDomain(model: MetadadosModel, empresaSlug: string): MetadadosEntity {
    return new MetadadosEntity({
      id: model.id,
      projetoId: model.projetoId,
      titulo: model.titulo,
      autor: model.autor,
      idioma: model.idioma as Idioma,
      isbn: model.isbn ?? null,
      categoria: model.categoria ?? null,
      capaUrl: model.capaUrl ?? null,
      editoraNome: model.editoraNome ?? null,
      atualizadoEm: model.atualizadoEm,
      empresaSlug,
      // Read from DB column (added in migration 20260830000001_metadados_materialized).
      // false = lazy-default (cover-only row, no PUT /metadados yet); true = metadata saved (D-M).
      materialized: model.materialized,
    });
  }

  /**
   * Returns the `create` input for the upsert call.
   *
   * The DB generates a UUID when `id` is empty (the entity carries `id=''` for
   * non-materialized defaults; for upserts after first persistence, the id is set).
   */
  static toUpsertCreateInput(entity: MetadadosEntity): Omit<MetadadosModel, 'id' | 'atualizadoEm'> & {
    id?: string;
    atualizadoEm?: Date;
  } {
    return {
      ...(entity.id ? { id: entity.id } : {}),
      projetoId: entity.projetoId,
      titulo: entity.titulo,
      autor: entity.autor,
      idioma: entity.idioma,
      isbn: entity.isbn ?? null,
      categoria: entity.categoria ?? null,
      capaUrl: entity.capaUrl ?? null,
      editoraNome: entity.editoraNome ?? null,
      materialized: entity.materialized,
      atualizadoEm: entity.atualizadoEm,
    };
  }

  /**
   * Mutable fields for the update arm of an upsert.
   * `id` and `projetoId` are immutable (used in the `where` clause).
   */
  static toUpsertUpdateInput(entity: MetadadosEntity): Partial<Omit<MetadadosModel, 'id' | 'projetoId'>> {
    return {
      titulo: entity.titulo,
      autor: entity.autor,
      idioma: entity.idioma,
      isbn: entity.isbn ?? null,
      categoria: entity.categoria ?? null,
      capaUrl: entity.capaUrl ?? null,
      editoraNome: entity.editoraNome ?? null,
      materialized: entity.materialized,
      atualizadoEm: entity.atualizadoEm,
    };
  }
}
