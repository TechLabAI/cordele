import { ValidationSeverity } from '../../../domain/pub/validation-severity.enum';
import { EpubcheckStatus } from '../../../domain/pub/epubcheck-status.enum';
import type { ValidationReport, ValidationReportMessage } from '../../../modules/pub/ports/epub-validation.port';

/**
 * Parses the epubcheck JSON report into a `ValidationReport` (PUB-010, P4).
 *
 * epubcheck severity vocabulary (--json output):
 *   FATAL  → error   (never seen in practice from epubcheck; treated as ERROR)
 *   ERROR  → error
 *   WARNING → warning
 *   INFO, USAGE → info
 *
 * Verdict derivation (D-Q, ADR-003):
 *   any error   → ERROS_CRITICOS (com_erros, never published)
 *   only warnings → AVISOS       (published with warning summary)
 *   no messages   → VALIDO       (published)
 */

/** Minimal shape of one message in epubcheck's JSON `--messages` array. */
interface EpubcheckMessage {
  severity?: string;
  message?: string;
  ID?: string;
  locations?: Array<{ path?: string; line?: number; column?: number }>;
}

/** Minimal shape of the top-level epubcheck JSON report. */
interface EpubcheckReport {
  messages?: EpubcheckMessage[];
}

/** Maps epubcheck severity strings to domain ValidationSeverity enum. */
function mapSeverity(epubcheckSeverity: string | undefined): ValidationSeverity {
  switch ((epubcheckSeverity ?? '').toUpperCase()) {
    case 'FATAL':
    case 'ERROR':
      return ValidationSeverity.ERROR;
    case 'WARNING':
      return ValidationSeverity.WARNING;
    default:
      return ValidationSeverity.INFO;
  }
}

/**
 * Derives the epubcheck verdict from the list of mapped messages.
 * Only domain severity values are used — no epubcheck vocabulary leaks into
 * the verdict decision (integration-contracts.md §3.1).
 */
function deriveVerdict(
  messages: readonly ValidationReportMessage[],
): EpubcheckStatus.VALIDO | EpubcheckStatus.AVISOS | EpubcheckStatus.ERROS_CRITICOS {
  const hasErrors = messages.some((m) => m.severity === ValidationSeverity.ERROR);
  if (hasErrors) return EpubcheckStatus.ERROS_CRITICOS;
  const hasWarnings = messages.some((m) => m.severity === ValidationSeverity.WARNING);
  if (hasWarnings) return EpubcheckStatus.AVISOS;
  return EpubcheckStatus.VALIDO;
}

/**
 * Parses raw epubcheck JSON output into a `ValidationReport`.
 *
 * @param jsonOutput  Raw stdout/file content from `epubcheck --json <file>`.
 * @param parseError  If set, returns a synthetic error report without parsing JSON.
 * @returns           Structured `ValidationReport` with domain vocabulary.
 */
export function parseEpubcheckReport(jsonOutput: string, parseError?: string): ValidationReport {
  if (parseError) {
    const msg: ValidationReportMessage = {
      severity: ValidationSeverity.ERROR,
      code: 'CONFIG-001',
      message: parseError,
    };
    return { verdict: EpubcheckStatus.ERROS_CRITICOS, messages: [msg] };
  }

  let report: EpubcheckReport;
  try {
    report = JSON.parse(jsonOutput) as EpubcheckReport;
  } catch {
    const msg: ValidationReportMessage = {
      severity: ValidationSeverity.ERROR,
      code: 'PARSE-001',
      message: `Failed to parse epubcheck JSON output: ${jsonOutput.slice(0, 120)}`,
    };
    return { verdict: EpubcheckStatus.ERROS_CRITICOS, messages: [msg] };
  }

  const messages: ValidationReportMessage[] = (report.messages ?? []).map((m) => {
    const location = m.locations?.[0];
    const locationStr = location
      ? `${location.path ?? ''}:${location.line ?? 0}:${location.column ?? 0}`
      : undefined;
    return {
      severity: mapSeverity(m.severity),
      code: m.ID ?? 'UNKNOWN',
      message: m.message ?? '',
      ...(locationStr ? { location: locationStr } : {}),
    };
  });

  return { verdict: deriveVerdict(messages), messages };
}
