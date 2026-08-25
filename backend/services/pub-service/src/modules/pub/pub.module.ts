import { Module } from '@nestjs/common';

import { PersistenceModule } from '../../infrastructure/persistence/persistence.module';
import { PubDomainService } from '../../domain/pub.domain-service';
import { PubRepositoryPort } from '../../domain/pub.repository.interface';
import { PrismaPubRepository } from '../../infrastructure/persistence/prisma-pub.repository';
import { PubController } from './pub.controller';
import { PubService } from './pub.service';

/**
 * PUB — PUB.
 *
 * Bounded context module. The repository port is bound to its Prisma adapter
 * here, which is the only place in the module that knows persistence exists.
 */
@Module({
  imports: [
    PersistenceModule,
  ],
  controllers: [PubController],
  providers: [
    PubService,
    // D-603: registered by factory because the domain service carries no Nest
    // decorator — ADR-001-hexagonal-node rule 7 keeps `src/domain/` free of
    // `@nestjs/*`. The wiring belongs here, in the application layer, not there.
    {
      provide: PubDomainService,
      useFactory: () => new PubDomainService(),
    },
    { provide: PubRepositoryPort, useClass: PrismaPubRepository },
  ],
  exports: [PubService],
})
export class PubModule {}
