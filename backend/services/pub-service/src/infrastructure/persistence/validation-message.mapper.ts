import type { ValidationMessage as ValidationMessageModel } from '../prisma-client';

import { ValidationMessageEntity } from '../../domain/pub/validation-message.entity';
import { ValidationSeverity } from '../../domain/pub/validation-severity.enum';

/**
 * Translates between the `ValidationMessage` Prisma model and
 * `ValidationMessageEntity`.
 *
 * This is the ONLY file allowed to know both the Prisma row shape and the
 * domain entity shape (RULE-01/02: domain/ never imports @prisma/client).
 * Explicit field mapping ensures schema renames surface here as compile
 * errors, not silent `undefined` values in domain logic.
 */
export class ValidationMessageMapper {
  /**
   * Maps a Prisma `ValidationMessage` row to the domain entity.
   *
   * The `severity` column is stored as a plain string in the DB; it is cast
   * to `ValidationSeverity` here (the DB constraint `chk_validation_message_severity`
   * guarantees the value is always valid — data-model.md §2.2).
   */
  static toDomain(model: ValidationMessageModel): ValidationMessageEntity {
    return new ValidationMessageEntity({
      id: model.id,
      publicacaoId: model.publicacaoId,
      severity: model.severity as ValidationSeverity,
      code: model.code,
      message: model.message,
      location: model.location ?? undefined,
      ordem: model.ordem,
      criadoEm: model.criadoEm,
    });
  }

  /** Convenience helper: maps a list of rows. */
  static toDomainList(models: ValidationMessageModel[]): ValidationMessageEntity[] {
    return models.map((m) => ValidationMessageMapper.toDomain(m));
  }
}
