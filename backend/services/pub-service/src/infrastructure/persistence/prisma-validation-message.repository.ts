import { Injectable } from '@nestjs/common';

import { ValidationMessageEntity } from '../../domain/pub/validation-message.entity';
import type { ValidationMessageRepositoryPort } from '../../domain/pub/ports/validation-message-repository.port';
import { PrismaEmpresaService } from './prisma-empresa.service';
import { ValidationMessageMapper } from './validation-message.mapper';

/**
 * Prisma-backed adapter for `ValidationMessageRepositoryPort` (PUB-016).
 *
 * Tenant isolation follows ADR-003 (D-619): each query runs through a
 * `PrismaClient` whose `datasourceUrl` targets `emp_<slug>` — the empresa schema
 * resolved from `EmpresaContextService` (AsyncLocalStorage). `SET search_path` at
 * query level is silently ignored by the Prisma Client and was NEVER a valid
 * isolation mechanism here; `PrismaEmpresaService` is the correct adapter.
 *
 * RULE-01/02: zero `@nestjs/*` decorators on domain types, zero `@prisma/client`
 * imports in domain/. This file lives in infrastructure/ — it is the bridge.
 * RULE-05: infrastructure/ does not import modules/ (only domain/ ports are imported).
 * RULE-07: all data access is scoped by empresa via `PrismaEmpresaService`.
 */
@Injectable()
export class PrismaValidationMessageRepository implements ValidationMessageRepositoryPort {
  constructor(private readonly empresaService: PrismaEmpresaService) {}

  /**
   * Returns `ValidationMessage` rows for the given publication, optionally
   * filtered by severity, ordered by `ordem ASC`.
   *
   * The index `idx_validation_message_pub_sev` (on `publicacao_id, severity`)
   * covers both the filtered and unfiltered queries efficiently.
   *
   * @param publicacaoId - id of the owning publication
   * @param severity     - optional filter; when omitted all severities are returned
   */
  async findByPublicacaoAndSeverity(
    publicacaoId: string,
    severity?: string,
  ): Promise<ValidationMessageEntity[]> {
    return this.empresaService.withCurrentTenant(async (client) => {
      const models = await client.validationMessage.findMany({
        where: {
          publicacaoId,
          ...(severity !== undefined ? { severity } : {}),
        },
        orderBy: { ordem: 'asc' },
      });
      return ValidationMessageMapper.toDomainList(models);
    });
  }
}
