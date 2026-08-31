import { ValidationMessageEntity } from '../validation-message.entity';

/**
 * Outbound port: read access to `validation_message` rows (domain-level).
 *
 * Defined in `domain/` so both `infrastructure/` (Prisma adapter) and
 * `modules/` (use cases) can import it without RULE-05 violations.
 *
 * RULE-01/02: zero `@nestjs/*` or `@prisma/client` imports in domain/.
 *
 * Real Prisma adapter bound in PUB-016 (PersistenceModule).
 */
export interface ValidationMessageRepositoryPort {
  /**
   * Returns `ValidationMessage` rows for the given publication, optionally
   * filtered by severity, ordered by `ordem ASC`.
   *
   * Tenant isolation is enforced at the schema level via `search_path`
   * (ADR-003); the caller's `EmpresaContext` must be active before calling
   * (RULE-07 enforced by the application-layer use case).
   *
   * @param publicacaoId - id of the owning publication
   * @param severity     - optional filter (`error | warning | info`); when
   *                       omitted all severities are returned
   */
  findByPublicacaoAndSeverity(
    publicacaoId: string,
    severity?: string,
  ): Promise<ValidationMessageEntity[]>;
}

/** DI injection token for ValidationMessageRepositoryPort. */
export const ValidationMessageRepositoryPort = Symbol('ValidationMessageRepositoryPort');
