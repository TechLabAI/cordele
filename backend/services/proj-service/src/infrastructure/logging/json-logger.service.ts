/**
 * JsonLoggerService — structured JSON logger for proj-service (PROJ-017).
 *
 * Implements NestJS LoggerService so that `app.useLogger(new JsonLoggerService())`
 * replaces the default console formatter with newline-delimited JSON entries.
 *
 * Every log entry includes the required PROJ-017 fields:
 *   - `level`         : severity string (info / warn / error / debug / verbose)
 *   - `message`       : log message string (stubs include `port=<PortName>` and
 *                       `degraded:true` when in degraded mode)
 *   - `module`        : static identifier 'proj'
 *   - `context`       : NestJS logger context (e.g. 'ManuscriptSummaryStub')
 *   - `timestamp`     : ISO-8601 UTC
 *
 * The `correlationId` field is written into the log message by callers that
 * have access to the async correlation context (e.g. a WARN emitted by a port
 * stub that receives `empresaId` but not `correlationId` via the port interface
 * — full propagation requires a shared AsyncLocalStorage store, deferred to a
 * future iteration).
 *
 * RULE-05: infrastructure/ must not import modules/.
 * RULE-08: no console.log — all output via process.stdout / process.stderr.
 */

import { LoggerService } from '@nestjs/common';

export class JsonLoggerService implements LoggerService {
  log(message: unknown, context?: string): void {
    this.write('info', message, context);
  }

  error(message: unknown, trace?: string, context?: string): void {
    this.write('error', message, context, trace);
  }

  warn(message: unknown, context?: string): void {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string): void {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string): void {
    this.write('verbose', message, context);
  }

  private write(
    level: string,
    message: unknown,
    context?: string,
    trace?: string,
  ): void {
    const entry: Record<string, unknown> = {
      level,
      message: typeof message === 'object' ? message : String(message),
      module: 'proj',
      timestamp: new Date().toISOString(),
    };
    if (context) entry['context'] = context;
    if (trace) entry['trace'] = trace;

    const line = JSON.stringify(entry) + '\n';
    if (level === 'error') {
      process.stderr.write(line);
    } else {
      process.stdout.write(line);
    }
  }
}
