import { Global, Module } from '@nestjs/common';

import { PrismaService } from './prisma.service';
import { PrismaEmpresaService } from './prisma-empresa.service';

/**
 * Owns the process-wide database connection resources.
 *
 * Provides two database clients:
 *   - `PrismaService` — single global PrismaClient for schema-agnostic operations
 *     (health checks, raw SQL in tests, etc.).
 *   - `PrismaEmpresaService` — per-schema PrismaClient factory for tenant-isolated
 *     data access (ADR-003, D-619). Repositories inject this instead of `PrismaService`.
 *
 * `@Global()` because the connection is genuinely a singleton resource; feature
 * modules still import `PersistenceModule` to express the dependency explicitly.
 *
 * `PrismaEmpresaService` depends on `EmpresaContextService` (exported globally by
 * `AuthModule`), which NestJS resolves automatically from the global scope.
 */
@Global()
@Module({
  providers: [PrismaService, PrismaEmpresaService],
  exports: [PrismaService, PrismaEmpresaService],
})
export class DatabaseModule {}
