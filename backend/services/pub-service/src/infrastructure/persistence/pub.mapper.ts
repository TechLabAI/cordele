import type { Prisma, Pub as PubModel } from '@prisma/client';

import { PubEntity, PubStatus } from '../../domain/pub.entity';

/**
 * Translates between the PUB Prisma model and the domain entity.
 *
 * This is the only file allowed to know both shapes. Keeping it explicit
 * (instead of spreading the Prisma row into the entity) means a schema
 * rename shows up here as a compile error rather than as a silent
 * `undefined` deep in the domain.
 */
export class PubMapper {
  static toDomain(model: PubModel): PubEntity {
    return new PubEntity({
      id: model.id,
      name: model.name,
      description: model.description ?? undefined,
      status: model.status as PubStatus,
      empresaId: model.empresaId,
      createdAt: model.createdAt,
      updatedAt: model.updatedAt,
    });
  }

  static toDomainList(models: PubModel[]): PubEntity[] {
    return models.map((model) => PubMapper.toDomain(model));
  }

  static toCreateInput(entity: PubEntity): Prisma.PubUncheckedCreateInput {
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

  static toUpdateInput(entity: PubEntity): Prisma.PubUncheckedUpdateInput {
    return {
      name: entity.name,
      description: entity.description ?? null,
      status: entity.status,
      updatedAt: entity.updatedAt,
    };
  }
}
