/**
 * Thrown by `EpubValidationPort.validate()` when epubcheck cannot be executed
 * (missing JRE, missing JAR path, or process spawn failure).
 *
 * Handlers MUST record `PublicacaoStatus.COM_ERROS` — an unvalidated artifact
 * is never published (ADR-003, api-contract §7.2 core promise).
 *
 * Pure domain error: zero `@nestjs/*` and zero `@prisma/client` (RULE-01/02).
 */
export class EpubcheckUnavailableError extends Error {
  constructor(reason: string) {
    super(`Epubcheck cannot execute: ${reason}`);
    this.name = 'EpubcheckUnavailableError';
  }
}
