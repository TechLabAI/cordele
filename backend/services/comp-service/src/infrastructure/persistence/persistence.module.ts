import { Global, Module } from '@nestjs/common';

import { DatabaseModule } from './database.module';
import { PrismaEmpresaService } from './prisma-empresa.service';
import { PrismaMetadadosRepository } from '../comp/persistence/metadados.repository';
import { PrismaConfiguracaoLayoutRepository } from '../comp/persistence/configuracao-layout.repository';

/**
 * Persistence module for the COMP bounded context (P3).
 *
 * @Global() makes all exported providers available to any module in the process
 * without explicit import — the same pattern as IMP/PROJ. CompModule never
 * imports infrastructure/ directly (RULE-04).
 *
 * Provides:
 * - `PrismaEmpresaService`: tenant routing (one PrismaClient per schema, D-619).
 *   Validates slug before schema interpolation to prevent injection.
 * - `PrismaMetadadosRepository`: implements `MetadadosRepositoryPort`.
 * - `PrismaConfiguracaoLayoutRepository`: implements `ConfiguracaoLayoutRepositoryPort`.
 *
 * Note (COMP-017): `PrismaProjectMetadataAdapter` was removed — its functionality
 * is now provided by `ProjectMetadataUseCase` registered directly in `CompModule`.
 *
 * The port token bindings (COMP_METADADOS_REPO → PrismaMetadadosRepository etc.)
 * are declared in AppModule because the token constants live in modules/comp/comp.tokens.ts
 * and PersistenceModule must not import from modules/ (RULE-05).
 *
 * RULE-05: this module does not import from modules/.
 */
@Global()
@Module({
  imports: [DatabaseModule],
  providers: [
    PrismaEmpresaService,
    PrismaMetadadosRepository,
    PrismaConfiguracaoLayoutRepository,
  ],
  exports: [
    DatabaseModule,
    PrismaEmpresaService,
    PrismaMetadadosRepository,
    PrismaConfiguracaoLayoutRepository,
  ],
})
export class PersistenceModule {}
