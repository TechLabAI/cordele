import { Module } from '@nestjs/common';

import { PersistenceModule } from '../../infrastructure/persistence/persistence.module';
import { ProjDomainService } from '../../domain/proj.domain-service';
import { ProjRepositoryPort } from '../../domain/proj.repository.interface';
import { PrismaProjRepository } from '../../infrastructure/persistence/prisma-proj.repository';
import { ProjController } from './proj.controller';
import { ProjService } from './proj.service';

/**
 * PROJ — PROJ.
 *
 * Bounded context module. The repository port is bound to its Prisma adapter
 * here, which is the only place in the module that knows persistence exists.
 */
@Module({
  imports: [
    PersistenceModule,
  ],
  controllers: [ProjController],
  providers: [
    ProjService,
    // D-603: registered by factory because the domain service carries no Nest
    // decorator — ADR-001-hexagonal-node rule 7 keeps `src/domain/` free of
    // `@nestjs/*`. The wiring belongs here, in the application layer, not there.
    {
      provide: ProjDomainService,
      useFactory: () => new ProjDomainService(),
    },
    { provide: ProjRepositoryPort, useClass: PrismaProjRepository },
  ],
  exports: [ProjService],
})
export class ProjModule {}
