import { Injectable, Logger } from '@nestjs/common';

import { PubEntity } from '../../domain/pub.entity';
import type {
  PubPage,
  PubRepositoryPort,
  PageRequest,
} from '../../domain/pub.repository.interface';
import { PrismaService } from './prisma.service';
import { PubMapper } from './pub.mapper';

/**
 * Prisma-backed adapter for the PUB repository port (D-545).
 *
 * `PrismaService` is injected — never instantiate `PrismaClient` here, or the
 * process ends up with one connection pool per module.
 */
@Injectable()
export class PrismaPubRepository implements PubRepositoryPort {
  private readonly logger = new Logger(PrismaPubRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async save(
    entity: PubEntity,
    empresaId: string,
  ): Promise<PubEntity> {
    if (entity.empresaId !== empresaId) {
      throw new Error('PUB: cross-empresa write rejected');
    }
    const model = await this.prisma.pub.upsert({
      where: { id: entity.id },
      create: PubMapper.toCreateInput(entity),
      update: PubMapper.toUpdateInput(entity),
    });
    return PubMapper.toDomain(model);
  }

  async findById(
    id: string,
    empresaId: string,
  ): Promise<PubEntity | null> {
    const model = await this.prisma.pub.findFirst({
      where: { id, empresaId },
    });
    return model ? PubMapper.toDomain(model) : null;
  }

  async findAll(
    page: PageRequest,
    empresaId: string,
  ): Promise<PubPage> {
    const size = Math.min(Math.max(page.size, 1), 200);
    const skip = Math.max(page.page - 1, 0) * size;
    const where = { empresaId };

    const [models, total] = await this.prisma.$transaction([
      this.prisma.pub.findMany({
        where,
        skip,
        take: size,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.pub.count({ where }),
    ]);

    return { items: PubMapper.toDomainList(models), total };
  }

  async deleteById(
    id: string,
    empresaId: string,
  ): Promise<void> {
    await this.prisma.pub.deleteMany({
      where: { id, empresaId },
    });
    this.logger.debug(`PUB row deleted: ${id}`);
  }
}
