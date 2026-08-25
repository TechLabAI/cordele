import type { Prisma, Proj as ProjModel } from '@prisma/client';

import { ProjEntity, ProjStatus } from '../../domain/proj.entity';

/**
 * Translates between the PROJ Prisma model and the domain entity.
 *
 * This is the only file allowed to know both shapes. Keeping it explicit
 * (instead of spreading the Prisma row into the entity) means a schema
 * rename shows up here as a compile error rather than as a silent
 * `undefined` deep in the domain.
 */
export class ProjMapper {
  static toDomain(model: ProjModel): ProjEntity {
    return new ProjEntity({
      id: model.id,
      name: model.name,
      description: model.description ?? undefined,
      status: model.status as ProjStatus,
      empresaId: model.empresaId,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    });
  }

  static toDomainList(models: ProjModel[]): ProjEntity[] {
    return models.map((model) => ProjMapper.toDomain(model));
  }

  static toCreateInput(entity: ProjEntity): Prisma.ProjUncheckedCreateInput {
    return {
      id: entity.id,
      name: entity.name,
      description: entity.description ?? null,
      status: entity.status,
      empresaId: entity.empresaId,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  static toUpdateInput(entity: ProjEntity): Prisma.ProjUncheckedUpdateInput {
    return {
      name: entity.name,
      description: entity.description ?? null,
      status: entity.status,
      updatedAt: entity.updatedAt,
    };
  }
}
