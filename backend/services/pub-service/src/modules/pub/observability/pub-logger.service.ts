import { Injectable, Logger } from '@nestjs/common';

import { CorrelationContextService } from './correlation-context.service';

/**
 * PubLoggerService — structured JSON logger for the PUB bounded context
 * (PUB-017, P7, SPEC-07).
 *
 * Wraps the NestJS `Logger` and enriches every log entry with:
 * - `correlationId` — from `CorrelationContextService` (AsyncLocalStorage)
 * - `empresa`       — passed explicitly (available in use-case scope)
 * - `publicacaoId`  — passed explicitly when known
 *
 * Designed to emit structured JSON lines that are machine-parseable by the
 * Cordelê observability stack (Elasticsearch / D-423).
 *
 * ### Usage (build job instrumentation)
 * ```ts
 * const start = Date.now();
 * // ... do work ...
 * this.pubLogger.buildPhase('gerando', Date.now() - start, { publicacaoId, projetoId });
 * ```
 *
 * RULE-04: modules/ does not import infrastructure/. ✓
 * RULE-08: no console.log — uses NestJS Logger. ✓
 */
@Injectable()
export class PubLoggerService {
  private readonly logger = new Logger(PubLoggerService.name);

  constructor(
    private readonly correlationContextService: CorrelationContextService,
  ) {}

  // ──────────────────────────────────────────────────────────────────────
  // Public API
  // ──────────────────────────────────────────────────────────────────────

  /**
   * Logs the start of a build phase with contextual fields.
   */
  buildPhaseStart(
    phase: BuildPhase,
    ctx: BuildContext,
  ): void {
    const correlationId = this.correlationContextService.getCorrelationId();
    this.logger.log(
      JSON.stringify({
        event: 'build_phase_start',
        phase,
        correlationId,
        ...ctx,
      }),
    );
  }

  /**
   * Logs the end of a build phase with duration and outcome.
   */
  buildPhaseEnd(
    phase: BuildPhase,
    durationMs: number,
    result: BuildPhaseResult,
    ctx: BuildContext,
  ): void {
    const correlationId = this.correlationContextService.getCorrelationId();
    this.logger.log(
      JSON.stringify({
        event: 'build_phase_end',
        phase,
        durationMs,
        result,
        correlationId,
        ...ctx,
      }),
    );
  }

  /**
   * Emits a structured log at `warn` level.
   */
  warn(message: string, ctx?: BuildContext): void {
    const correlationId = this.correlationContextService.getCorrelationId();
    this.logger.warn(
      JSON.stringify({ message, correlationId, ...ctx }),
    );
  }

  /**
   * Emits a structured log at `error` level.
   */
  error(message: string, err?: unknown, ctx?: BuildContext): void {
    const correlationId = this.correlationContextService.getCorrelationId();
    this.logger.error(
      JSON.stringify({
        message,
        correlationId,
        error: err instanceof Error ? err.message : String(err ?? ''),
        ...ctx,
      }),
    );
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Supporting types
// ──────────────────────────────────────────────────────────────────────────────

/** Named phases of the publication build pipeline (api-contract §7.2). */
export type BuildPhase = 'assemble' | 'validating' | 'storing' | 'notifying';

/** Outcome of a completed build phase. */
export type BuildPhaseResult = 'success' | 'failure' | 'skipped';

/** Contextual identifiers available at build time. */
export interface BuildContext {
  readonly publicacaoId?: string;
  readonly projetoId?: string;
  readonly empresa?: string;
  readonly sequencia?: number;
  readonly epubcheckStatus?: string;
  readonly totalErros?: number;
  readonly totalAvisos?: number;
}
