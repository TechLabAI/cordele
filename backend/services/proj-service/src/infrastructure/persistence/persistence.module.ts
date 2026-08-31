import { Global, Module } from '@nestjs/common';

// Domain tokens (infrastructure imports domain — permitted; RULE-05 bars modules/ only)
import { ProjetoEditorialRepository } from '../../domain/proj/projeto-editorial.repository';

import { DatabaseModule } from './database.module';
import { TenantPrismaFactory } from './tenant-prisma.factory';
import { PrismaProjetoEditorialRepository } from './proj/projeto-editorial.repository';

/**
 * Global persistence module for proj-service.
 *
 * Decorated with @Global() so ProjModule and any future feature module can
 * inject the repository tokens without importing this module directly
 * (RULE-04: modules/ must not import infrastructure/ directly;
 *  RULE-05: infrastructure/ must not import modules/).
 *
 * Token resolution:
 *   ProjetoEditorialRepository (Symbol)  → PrismaProjetoEditorialRepository
 *
 * P3: replaces the useValue stubs from ProjModule with the real Prisma adapters.
 * ProjModule no longer declares these providers — it inherits them from global scope.
 */
@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    TenantPrismaFactory,

    // P3 main adapter: ProjetoEditorial aggregate persistence
    PrismaProjetoEditorialRepository,
    {
      provide: ProjetoEditorialRepository,
      useClass: PrismaProjetoEditorialRepository,
    },
  ],
  exports: [
    DatabaseModule,
    TenantPrismaFactory,
    ProjetoEditorialRepository,
  ],
})
export class PersistenceModule {}
