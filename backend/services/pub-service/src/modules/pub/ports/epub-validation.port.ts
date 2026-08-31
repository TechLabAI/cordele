import { EpubcheckStatus } from '../../../domain/pub/epubcheck-status.enum';
import { ValidationSeverity } from '../../../domain/pub/validation-severity.enum';

export interface ValidationReportMessage {
  readonly severity: ValidationSeverity;
  readonly code: string;
  readonly message: string;
  readonly location?: string;
}

/** epubcheck's parsed report — `verdict` is derived from message severities (D-Q). */
export interface ValidationReport {
  readonly verdict: EpubcheckStatus.VALIDO | EpubcheckStatus.AVISOS | EpubcheckStatus.ERROS_CRITICOS;
  readonly messages: readonly ValidationReportMessage[];
}

/**
 * Outbound port: epubcheck validation, the one external tool PUB integrates
 * with (integration-contracts.md §3.1, ADR-003).
 *
 * epubcheck's verdict is authoritative for `publicado` vs `com_erros`; the
 * domain knows only a verdict, never a Java process. If epubcheck cannot
 * run, the caller must record `com_erros` — an unvalidated artifact is
 * never published (doc 01 core promise).
 *
 * Adapter (`EpubcheckValidationAdapter`, PUB-010) binds in P4, running
 * epubcheck as a child process. P2 use cases are tested against Jest mocks
 * of this interface.
 */
export interface EpubValidationPort {
  validate(epubBytes: Buffer): Promise<ValidationReport>;
}

/** DI injection token for EpubValidationPort. Re-exported by pub.tokens.ts. */
export const EpubValidationPort = Symbol('EpubValidationPort');
