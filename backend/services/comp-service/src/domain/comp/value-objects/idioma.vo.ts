import { DomainException } from '../../shared/domain-exception';

/**
 * Value object for the `idioma` (language) field of the Metadados aggregate.
 *
 * Restricts the set of valid IETF language subtags to the four supported
 * by Cordelê (SPEC-02, data-model §2.1). Throws DomainException on any
 * other value so validation is never duplicated in adapters or controllers.
 *
 * Pure TypeScript — no @nestjs/* or @prisma/client imports (RULE-01/02).
 */
export type Idioma = 'pt' | 'en' | 'es' | 'fr';

export const IDIOMAS_VALIDOS: ReadonlyArray<Idioma> = ['pt', 'en', 'es', 'fr'];
export const IDIOMA_PADRAO: Idioma = 'pt';

export class IdiomaVO {
  /**
   * Validates that `value` is one of the supported language codes.
   * Returns the validated value as the `Idioma` type.
   * Throws DomainException(422) for any unknown code.
   */
  static validate(value: string): Idioma {
    if (!(IDIOMAS_VALIDOS as ReadonlyArray<string>).includes(value)) {
      throw new DomainException(
        'IDIOMA_INVALIDO',
        422,
        `Idioma must be one of ${IDIOMAS_VALIDOS.join(', ')}`,
      );
    }
    return value as Idioma;
  }
}
