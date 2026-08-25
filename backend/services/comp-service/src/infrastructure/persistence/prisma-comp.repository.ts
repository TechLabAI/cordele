import { Injectable, Logger } from '@nestjs/common';

import { CompEntity } from '../../domain/comp.entity';
import type {
  CompPage,
  CompRepositoryPort,
  PageRequest,
} from '../../domain/comp.repository.interface';
import { PrismaService } from './prisma.service';
import { CompMapper } from './comp.mapper';

/**
 * Prisma-backed adapter for the COMP repository port (D-545).
 *
 * `PrismaService` is injected — never instantiate `PrismaClient` here, or the
 * process ends up with one connection pool per module.
 */
@Injectable()
export class PrismaCompRepository implements CompRepositoryPort {
  private readonly logger = new Logger(PrismaCompRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async save(
    entity: CompEntity,
    empresaId: string,
  ): Promise<CompEntity> {
    if (entity.empresaId !== empresaId) {
      throw new Error('COMP: cross-empresa write rejected');
    }
    const model = await this.prisma.comp.upsert({
      where: { id: entity.id },
      create: CompMapper.toCreateInput(entity),
      update: CompMapper.toUpdateInput(entity),
    });
    return CompMapper.toDomain(model);
  }

  async findById(
    id: string,
    empresaId: string,
  ): Promise<CompEntity | null> {
    const model = await this.prisma.comp.findFirst({
      where: { id, empresaId },
    });
    return model ? CompMapper.toDomain(model) : null;
  }

  async findAll(
    page: PageRequest,
    empresaId: string,
  ): Promise<CompPage> {
    const size = Math.min(Math.max(page.size, 1), 200);
    const skip = Math.max(page.page - 1, 0) * size;
    const where = { empresaId };

    const [models, total] = await this.prisma.$transaction([
      this.prisma.comp.findMany({
        where,
        skip,
        take: size,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.comp.count({ where }),
    ]);

    return { items: CompMapper.toDomainList(models), total };
  }

  async deleteById(
    id: string,
    empresaId: string,
  ): Promise<void> {
    await this.prisma.comp.deleteMany({
      where: { id, empresaId },
    });
    this.logger.debug(`COMP row deleted: ${id}`);
  }
}
