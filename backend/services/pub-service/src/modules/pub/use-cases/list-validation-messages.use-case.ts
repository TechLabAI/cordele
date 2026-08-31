import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';

import { ValidationMessageEntity } from '../../../domain/pub/validation-message.entity';
import { type ValidationMessageRepositoryPort } from '../../../domain/pub/ports/validation-message-repository.port';
import { type AuthenticatedUser } from '../../../domain/auth/authenticated-user';
import {
  PUBLICACAO_REPOSITORY_PORT,
  VALIDATION_MESSAGE_REPOSITORY_PORT,
} from '../pub.tokens';
import { type PublicacaoRepositoryPort } from '../ports/publicacao-repository.port';

export interface ListValidationMessagesInput {
  readonly projetoId: string;
  readonly publicacaoId: string;
  readonly severity?: string;
}

/**
 * ListValidationMessagesUseCase — detailed validation-message list
 * (api-contract §4.6, PUB-016).
 *
 * Cross-tenant guard: validates that `publicacaoId` belongs to
 * `projetoId` **and** the active empresa by calling
 * `PublicacaoRepositoryPort.findById` first — identical pattern used by
 * `GetPublicationStatusUseCase` (PUB-005). Returns 404 when the
 * combination does not exist, never revealing cross-tenant existence.
 *
 * RULE-07: requires the empresa context before touching any repository.
 */
@Injectable()
export class ListValidationMessagesUseCase {
  constructor(
    @Inject(PUBLICACAO_REPOSITORY_PORT)
    private readonly publicacaoRepository: PublicacaoRepositoryPort,
    @Inject(VALIDATION_MESSAGE_REPOSITORY_PORT)
    private readonly validationMessageRepository: ValidationMessageRepositoryPort,
  ) {}

  async execute(
    input: ListValidationMessagesInput,
    user: AuthenticatedUser,
  ): Promise<ValidationMessageEntity[]> {
    if (!user?.empresaId) {
      throw new ForbiddenException('Token carries no empresa claim');
    }

    // Cross-tenant guard: returns null when publicacaoId does not exist
    // in the given project or the active empresa (schema-per-tenant).
    const publicacao = await this.publicacaoRepository.findById(
      input.projetoId,
      input.publicacaoId,
    );
    if (!publicacao) {
      throw new NotFoundException('urn:cordele:pub:publicacao-not-found');
    }

    return this.validationMessageRepository.findByPublicacaoAndSeverity(
      input.publicacaoId,
      input.severity,
    );
  }
}
