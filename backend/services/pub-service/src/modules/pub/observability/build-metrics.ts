import { execFile } from 'node:child_process';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';

const logger = new Logger('BuildMetrics');

/**
 * Payload emitted for a completed publication build phase (PUB-017, SPEC-07).
 */
export interface BuildPhasePayload {
  /** Human-readable phase name (e.g. 'assemble', 'validating'). */
  readonly phase: string;
  /** Duration of this phase in milliseconds. */
  readonly durationMs: number;
  /** Outcome verdict for this phase. */
  readonly result: 'success' | 'failure' | 'skipped';
  /** Publication aggregate ID. */
  readonly publicacaoId: string;
  /** Project ID. */
  readonly projetoId: string;
  /** Sequential build number for idempotency. */
  readonly sequencia?: number;
  /** epubcheck verdict (present when phase is 'validating'). */
  readonly epubcheckStatus?: string;
  /** Number of epubcheck errors. */
  readonly totalErros?: number;
  /** Number of epubcheck warnings. */
  readonly totalAvisos?: number;
}

/**
 * recordBuildPhase — best-effort pipeline event emitter (D-423, PUB-017).
 *
 * Logs the build phase as a structured JSON line (machine-parseable) and
 * fires the `pipeline_events.py emit` script to record the event in the
 * Elasticsearch activity sink.
 *
 * ### Guarantees
 * - **Never throws** — all errors are absorbed; a failure here MUST NOT
 *   propagate to the build job or alter its outcome.
 * - The structured log line is always emitted, even if the Python call fails.
 * - D-423: "available:false (ES down) never blocks — the call is best-effort."
 *
 * RULE-08: no console.log — uses Nest Logger. ✓
 */
export function recordBuildPhase(payload: BuildPhasePayload): void {
  // 1. Always emit a structured log line first — zero-dependency path.
  const structured = JSON.stringify({
    event: 'pub_build_phase',
    ...payload,
    ts: new Date().toISOString(),
  });
  logger.debug(structured);

  // 2. Best-effort pipeline event via pipeline_events.py (D-423).
  //    Resolve the script path relative to the monorepo root (3 levels up from
  //    backend/services/pub-service/).
  try {
    const scriptPath = join(
      __dirname,
      '..', '..', '..', '..', '..', '..', // up to monorepo root
      'scripts', 'pipeline_events.py',
    );

    const details = JSON.stringify({
      phase: payload.phase,
      durationMs: payload.durationMs,
      result: payload.result,
      publicacaoId: payload.publicacaoId,
      projetoId: payload.projetoId,
      ...(payload.sequencia !== undefined ? { sequencia: payload.sequencia } : {}),
      ...(payload.epubcheckStatus !== undefined ? { epubcheckStatus: payload.epubcheckStatus } : {}),
      ...(payload.totalErros !== undefined ? { totalErros: payload.totalErros } : {}),
      ...(payload.totalAvisos !== undefined ? { totalAvisos: payload.totalAvisos } : {}),
    });

    execFile(
      'python',
      [
        scriptPath,
        'emit',
        '--category', 'BUILD-PHASE',
        '--actor', 'PublicationBuildJob',
        '--module', 'PUB',
        '--stage', 'build',
        '--status', payload.result === 'success' ? 'completed' : 'failed',
        '--message', `PUB build phase ${payload.phase}: ${payload.result} in ${payload.durationMs}ms`,
        '--details', details,
        '--duration-ms', String(payload.durationMs),
      ],
      { timeout: 5_000 },
      (error) => {
        if (error) {
          // Best-effort — absorb all errors silently.
          logger.debug(`pipeline_events.py emit skipped: ${error.message}`);
        }
      },
    );
  } catch (err) {
    // Absorb synchronous errors from execFile setup (e.g. python not on PATH).
    logger.debug(`recordBuildPhase best-effort call failed: ${String(err)}`);
  }
}
