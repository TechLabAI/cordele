import { Module } from '@nestjs/common';

import { PersistenceModule } from '../../infrastructure/persistence/persistence.module';
import { CompDomainService } from '../../domain/comp.domain-service';
import { CompRepositoryPort } from '../../domain/comp.repository.interface';
import { PrismaCompRepository } from '../../infrastructure/persistence/prisma-comp.repository';
import { CompController } from './comp.controller';
import { CompService } from './comp.service';

/**
 * COMP — COMP.
 *
 * Bounded context module. The repository port is bound to its Prisma adapter
 * here, which is the only place in the module that knows persistence exists.
 */
@Module({
  imports: [
    PersistenceModule,
  ],
  controllers: [CompController],
  providers: [
    CompService,
    // D-603: registered by factory because the domain service carries no Nest
    // decorator — ADR-001-hexagonal-node rule 7 keeps `src/domain/` free of
    // `@nestjs/*`. The wiring belongs here, in the application layer, not there.
    {
      provide: CompDomainService,
      useFactory: () => new CompDomainService(),
    },
    { provide: CompRepositoryPort, useClass: PrismaCompRepository },
  ],
  exports: [CompService],
})
export class CompModule {}
