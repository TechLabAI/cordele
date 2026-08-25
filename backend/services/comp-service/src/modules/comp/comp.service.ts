import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { CompEntity } from '../../domain/comp.entity';
import { CompDomainService } from '../../domain/comp.domain-service';
import {
  CompRepositoryPort,
  type CompPage,
  type PageRequest,
} from '../../domain/comp.repository.interface';
import { type AuthenticatedUser } from '../../infrastructure/auth/jwt-auth.guard';
import { CreateCompDto } from './dto/create-comp.dto';
import { UpdateCompDto } from './dto/update-comp.dto';

/**
 * Application service for COMP (COMP).
 *
 * Orchestrates use cases: it loads aggregates through the repository port,
 * asks the domain service to decide, persists the outcome and publishes the
 * resulting integration events. It depends on ports only — never on Prisma.
 */
@Injectable()
export class CompService {
  private readonly logger = new Logger(CompService.name);

  constructor(
    @Inject(CompRepositoryPort)
    private readonly repository: CompRepositoryPort,
    private readonly domainService: CompDomainService,
  ) {}

  async create(dto: CreateCompDto, user: AuthenticatedUser): Promise<CompEntity> {
    const entity = this.domainService.createFrom({
      name: dto.name,
      description: dto.description,
      status: dto.status,
      empresaId: user.empresaId,
    });

    const saved = await this.repository.save(entity, user.empresaId);
    this.logger.log(`COMP created: ${saved.id}`);
    return saved;
  }

  async findAll(user: AuthenticatedUser, page: PageRequest): Promise<CompPage> {
    return this.repository.findAll(page, user.empresaId);
  }

  async findOne(id: string, user: AuthenticatedUser): Promise<CompEntity> {
    const found = await this.repository.findById(id, user.empresaId);
    if (!found) {
      throw new NotFoundException(`COMP ${id} not found`);
    }
    return found;
  }

  async update(
    id: string,
    dto: UpdateCompDto,
    user: AuthenticatedUser,
  ): Promise<CompEntity> {
    const current = await this.findOne(id, user);
    const next = this.domainService.applyChanges(current, dto);
    const saved = await this.repository.save(next, user.empresaId);
    return saved;
  }

  async remove(id: string, user: AuthenticatedUser): Promise<void> {
    await this.findOne(id, user);
    await this.repository.deleteById(id, user.empresaId);
    this.logger.log(`COMP deleted: ${id}`);
  }
}
