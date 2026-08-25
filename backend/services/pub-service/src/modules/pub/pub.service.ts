import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { PubEntity } from '../../domain/pub.entity';
import { PubDomainService } from '../../domain/pub.domain-service';
import {
  PubRepositoryPort,
  type PubPage,
  type PageRequest,
} from '../../domain/pub.repository.interface';
import { type AuthenticatedUser } from '../../infrastructure/auth/jwt-auth.guard';
import { CreatePubDto } from './dto/create-pub.dto';
import { UpdatePubDto } from './dto/update-pub.dto';

/**
 * Application service for PUB (PUB).
 *
 * Orchestrates use cases: it loads aggregates through the repository port,
 * asks the domain service to decide, persists the outcome and publishes the
 * resulting integration events. It depends on ports only — never on Prisma.
 */
@Injectable()
export class PubService {
  private readonly logger = new Logger(PubService.name);

  constructor(
    @Inject(PubRepositoryPort)
    private readonly repository: PubRepositoryPort,
    private readonly domainService: PubDomainService,
  ) {}

  async create(dto: CreatePubDto, user: AuthenticatedUser): Promise<PubEntity> {
    const entity = this.domainService.createFrom({
      name: dto.name,
      description: dto.description,
      status: dto.status,
      empresaId: user.empresaId,
    });

    const saved = await this.repository.save(entity, user.empresaId);
    this.logger.log(`PUB created: ${saved.id}`);
    return saved;
  }

  async findAll(user: AuthenticatedUser, page: PageRequest): Promise<PubPage> {
    return this.repository.findAll(page, user.empresaId);
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<PubEntity> {
    const found = await this.repository.findById(id, user.empresaId);
    if (!found) {
      throw new NotFoundException(`PUB ${id} not found`);
    }
    return found;
  }

  async update(
    id: string,
    dto: UpdatePubDto,
    user: AuthenticatedUser,
  ): Promise<PubEntity> {
    const current = await this.findOne(id, user);
    const next = this.domainService.applyChanges(current, dto);
    const saved = await this.repository.save(next, user.empresaId);
    return saved;
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    await this.findOne(id, user);
    await this.repository.deleteById(id, user.empresaId);
    this.logger.log(`PUB deleted: ${id}`);
  }
}
