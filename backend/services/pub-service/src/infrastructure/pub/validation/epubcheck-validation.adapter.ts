import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { writeFile, unlink, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EpubcheckStatus } from '../../../domain/pub/epubcheck-status.enum';
import type { EpubValidationPort, ValidationReport } from '../../../modules/pub/ports/epub-validation.port';
import { parseEpubcheckReport } from './epubcheck-report.parser';

const execFileAsync = promisify(execFile);

/**
 * EpubcheckValidationAdapter — infrastructure adapter for `EpubValidationPort`
 * (PUB-010, P4, ADR-003).
 *
 * Executes epubcheck as a child process:
 *   `java -jar $EPUBCHECK_JAR_PATH --json <report.json> <epub.epub>`
 *
 * ### Failure modes → always `erros_criticos` (ADR-003: never publish unvalidated)
 * - `EPUBCHECK_JAR_PATH` not set           → CONFIG-001
 * - JRE missing / java not on PATH         → CONFIG-001
 * - Child process crash (non-zero exit)    → PROCESS-001
 * - JSON parse failure                     → PARSE-001
 *
 * ### Cleanup
 * Temp files (`.epub` + `.json`) are removed in a `finally` block even when
 * the process throws — no temp file leaks.
 *
 * RULE-05: imports only from domain/ (enums, parser) and modules/pub/ports/
 * (interface type — no implementation classes imported from modules/).
 */
@Injectable()
export class EpubcheckValidationAdapter implements EpubValidationPort {
  private readonly logger = new Logger(EpubcheckValidationAdapter.name);
  private readonly jarPath: string | undefined;

  constructor(private readonly config: ConfigService) {
    this.jarPath = this.config.get<string>('EPUBCHECK_JAR_PATH');
    if (!this.jarPath) {
      this.logger.warn(
        'EPUBCHECK_JAR_PATH is not configured — epubcheck validation will fail with com_erros (ADR-003)',
      );
    }
  }

  async validate(epubBytes: Buffer): Promise<ValidationReport> {
    if (!this.jarPath) {
      return parseEpubcheckReport('', 'EPUBCHECK_JAR_PATH is not set (CONFIG-001)');
    }

    const id = randomUUID();
    const epubPath = join(tmpdir(), `pub-${id}.epub`);
    const reportPath = join(tmpdir(), `pub-${id}.json`);

    try {
      await writeFile(epubPath, epubBytes);

      let jsonOutput = '';
      let processError: string | undefined;

      try {
        await execFileAsync('java', ['-jar', this.jarPath, '--json', reportPath, epubPath], {
          timeout: 60_000,
        });
      } catch (err) {
        // execFile rejects on non-zero exit — epubcheck exits non-zero both
        // when the ePub has errors and when configuration fails (JRE absent).
        processError = err instanceof Error ? err.message : 'epubcheck child process failed';
      }

      // Always attempt to read the JSON report — epubcheck writes it even on
      // non-zero exits (ePub validation errors). If the file is absent it means
      // the process failed before writing (JRE missing, bad JAR, etc.).
      try {
        jsonOutput = await readFile(reportPath, 'utf-8');
      } catch {
        if (processError) {
          this.logger.error(`EpubcheckValidationAdapter: child process error — ${processError}`);
          return parseEpubcheckReport('', `epubcheck process error: ${processError}`);
        }
        return parseEpubcheckReport('', 'epubcheck did not produce a JSON report (PROCESS-001)');
      }

      const report = parseEpubcheckReport(jsonOutput);
      this.logger.log(
        `epubcheck verdict=${report.verdict} errors=${report.messages.filter((m) => m.severity === 'error').length} warnings=${report.messages.filter((m) => m.severity === 'warning').length}`,
      );
      return report;
    } finally {
      await this.cleanup(epubPath);
      await this.cleanup(reportPath);
    }
  }

  private async cleanup(path: string): Promise<void> {
    try {
      await unlink(path);
    } catch {
      // Ignore ENOENT — file may not have been created yet
    }
  }
}

/** Synthetic `ValidationReport` for when epubcheck cannot run (ADR-003). */
export function buildConfigErrorReport(reason: string): ValidationReport {
  return parseEpubcheckReport('', reason);
}

/**
 * Builds a mock `ValidationReport` for use in unit tests that do not invoke
 * the real adapter. Kept here so tests and the adapter share the same
 * verdict-derivation logic (parseEpubcheckReport).
 */
export function buildMockValidReport(): ValidationReport {
  return { verdict: EpubcheckStatus.VALIDO, messages: [] };
}
