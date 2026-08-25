import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';

import { ProjEntity } from '../../domain/proj.entity';
import { ProjDomainService } from '../../domain/proj.domain-service';
import {
  ProjRepositoryPort,
  type ProjPage,
  type PageRequest,
} from '../../domain/proj.repository.interface';
import { type UsuarioContext } from '../../domain/shared/usuario-context.interface';
import { CreateProjDto } from './dto/create-proj.dto';
import { UpdateProjDto } from './dto/update-proj.dto';

/**
 * Application service for PROJ (PROJ).
 *
 * Orchestrates use cases: it loads aggregates through the repository port,
 * asks the domain service to decide, persists the outcome and publishes the
 * resulting integration events. It depends on ports only — never on Prisma.
 */
@Injectable()
export class ProjService {
  private readonly logger = new Logger(ProjService.name);

  constructor(
    @Inject(ProjRepositoryPort)
    private readonly repository: ProjRepositoryPort,
    private readonly domainService: ProjDomainService,
  ) {}

  async create(dto: CreateProjDto, user: UsuarioContext): Promise<ProjEntity> {
    const entity = this.domainService.createFrom({
      name: dto.name,
      description: dto.description,
      status: dto.status,
      empresaId: user.empresaId,
    });

    const saved = await this.repository.save(entity, user.empresaId);
    this.logger.log(`PROJ created: ${saved.id}`);
    return saved;
  }

  async findAll(user: UsuarioContext, page: PageRequest): Promise<ProjPage> {
    return this.repository.findAll(page, user.empresaId);
  }

  async findOne(id: string, user: UsuarioContext): Promise<ProjEntity> {
    const found = await this.repository.findById(id, user.empresaId);
    if (!found) {
      throw new NotFoundException(`PROJ ${id} not found`);
    }
    return found;
  }

  async update(
    id: string,
    dto: UpdateProjDto,
    user: UsuarioContext,
  ): Promise<ProjEntity> {
    const current = await this.findOne(id, user);
    const next = this.domainService.applyChanges(current, dto);
    const saved = await this.repository.save(next, user.empresaId);
    return saved;
  }

  async remove(id: string, user: UsuarioContext): Promise<void> {
    await this.findOne(id, user);
    await this.repository.deleteById(id, user.empresaId);
    this.logger.log(`PROJ deleted: ${id}`);
  }
}
