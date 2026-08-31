import { Injectable } from '@nestjs/common';

import { ValidationMessageEntity } from '../../domain/pub/validation-message.entity';
import type { ValidationMessageRepositoryPort } from '../../domain/pub/ports/validation-message-repository.port';
import { PrismaService } from './prisma.service';
import { ValidationMessageMapper } from './validation-message.mapper';

/**
 * Prisma-backed adapter for `ValidationMessageRepositoryPort` (PUB-016).
 *
 * All tables live in the tenant schema resolved from `EmpresaContext` before
 * this adapter is called (RULE-07 — the application service enforces the
 * context guard). The adapter receives an already-tenant-scoped `PrismaService`
 * connection and never embeds `empresaId` as a column discriminator (the
 * schema-per-tenant strategy handles isolation at the schema level,
 * ADR-003-multi-tenancy.md).
 *
 * RULE-01/02: zero `@nestjs/*` decorators on domain types, zero `@prisma/client`
 * imports in domain/. This file lives in infrastructure/ — it is the bridge.
 * RULE-05: infrastructure/ does not import modules/ (only domain/ ports are imported).
 */
@Injectable()
export class PrismaValidationMessageRepository implements ValidationMessageRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

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
    const models = await this.prisma.validationMessage.findMany({
      where: {
        publicacaoId,
        ...(severity !== undefined ? { severity } : {}),
      },
      orderBy: { ordem: 'asc' },
    });
    return ValidationMessageMapper.toDomainList(models);
  }
}
