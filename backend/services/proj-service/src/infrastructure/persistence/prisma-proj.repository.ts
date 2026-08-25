import { Injectable, Logger } from '@nestjs/common';

import { ProjEntity } from '../../domain/proj.entity';
import type {
  ProjPage,
  ProjRepositoryPort,
  PageRequest,
} from '../../domain/proj.repository.interface';
import { PrismaService } from './prisma.service';
import { ProjMapper } from './proj.mapper';

/**
 * Prisma-backed adapter for the PROJ repository port (D-545).
 *
 * `PrismaService` is injected — never instantiate `PrismaClient` here, or the
 * process ends up with one connection pool per module.
 */
@Injectable()
export class PrismaProjRepository implements ProjRepositoryPort {
  private readonly logger = new Logger(PrismaProjRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async save(
    entity: ProjEntity,
    empresaId: string,
  ): Promise<ProjEntity> {
    if (entity.empresaId !== empresaId) {
      throw new Error('PROJ: cross-empresa write rejected');
    }
    const model = await this.prisma.proj.upsert({
      where: { id: entity.id },
      create: ProjMapper.toCreateInput(entity),
      update: ProjMapper.toUpdateInput(entity),
    });
    return ProjMapper.toDomain(model);
  }

  async findById(
    id: string,
    empresaId: string,
  ): Promise<ProjEntity | null> {
    const model = await this.prisma.proj.findFirst({
      where: { id, empresaId },
    });
    return model ? ProjMapper.toDomain(model) : null;
  }

  async findAll(
    page: PageRequest,
    empresaId: string,
  ): Promise<ProjPage> {
    const size = Math.min(Math.max(page.size, 1), 200);
    const skip = Math.max(page.page - 1, 0) * size;
    const where = { empresaId };

    const [models, total] = await this.prisma.$transaction([
      this.prisma.proj.findMany({
        where,
        skip,
        take: size,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.proj.count({ where }),
    ]);

    return { items: ProjMapper.toDomainList(models), total };
  }

  async deleteById(
    id: string,
    empresaId: string,
  ): Promise<void> {
    await this.prisma.proj.deleteMany({
      where: { id, empresaId },
    });
    this.logger.debug(`PROJ row deleted: ${id}`);
  }
}
