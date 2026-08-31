import { DomainException } from '../../shared/domain-exception';

/**
 * Reusable value object for mandatory non-blank text fields (`titulo`, `autor`).
 *
 * A text field is considered blank if it is undefined, null, empty, or contains
 * only whitespace. The validator trims before checking so `'  '` is rejected.
 *
 * Pure TypeScript — no @nestjs/* or @prisma/client imports (RULE-01/02).
 */
export class NonBlankText {
  /**
   * Validates that `value` is non-blank after trim.
   * Returns the original (untrimmed) value on success.
   * Throws DomainException(422) when blank.
   *
   * @param value    The string to validate.
   * @param field    Machine-readable field name used in the error code and message.
   */
  static validate(value: string | undefined | null, field: string): string {
    if (!value?.trim()) {
      throw new DomainException(
        `${field.toUpperCase()}_OBRIGATORIO`,
        422,
        `${field} cannot be blank`,
      );
    }
    // Type-safe: at this point value is a non-empty, non-null string.
    return value as string;
  }
}
