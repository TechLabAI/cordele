import type { Prisma, Comp as CompModel } from '@prisma/client';

import { CompEntity, CompStatus } from '../../domain/comp.entity';

/**
 * Translates between the COMP Prisma model and the domain entity.
 *
 * This is the only file allowed to know both shapes. Keeping it explicit
 * (instead of spreading the Prisma row into the entity) means a schema
 * rename shows up here as a compile error rather than as a silent
 * `undefined` deep in the domain.
 */
export class CompMapper {
  static toDomain(model: CompModel): CompEntity {
    return new CompEntity({
      id: model.id,
      name: model.name,
      description: model.description ?? undefined,
      status: model.status as CompStatus,
      empresaId: model.empresaId,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    });
  }

  static toDomainList(models: CompModel[]): CompEntity[] {
    return models.map((model) => CompMapper.toDomain(model));
  }

  static toCreateInput(entity: CompEntity): Prisma.CompUncheckedCreateInput {
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

  static toUpdateInput(entity: CompEntity): Prisma.CompUncheckedUpdateInput {
    return {
      name: entity.name,
      description: entity.description ?? null,
      status: entity.status,
      updatedAt: entity.updatedAt,
    };
  }
}
