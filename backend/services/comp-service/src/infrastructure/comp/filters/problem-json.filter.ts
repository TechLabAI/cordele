import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { DomainException } from '../../../domain/shared/domain-exception';

const CORRELATION_HEADER = 'x-correlation-id' as const;

/**
 * RFC 7807 (Problem Details for HTTP APIs) exception filter for COMP.
 *
 * Converts domain and HTTP exceptions into `application/problem+json` responses.
 * The `traceId` field is populated from `X-Correlation-Id`, which must have been
 * set by `CorrelationMiddleware` before this filter runs.
 *
 * Exception mapping:
 *  - `DomainException`        → 400 (or the status carried by the exception)
 *  - `NotFoundException`      → 404
 *  - `UnauthorizedException`  → 401
 *  - `ForbiddenException`     → 403
 *  - Any other `HttpException`→ the exception's own status code
 *  - Unknown / unhandled      → 500 (logged as error)
 *
 * Response body shape (RFC 7807):
 * ```json
 * {
 *   "type":    "urn:cordele:comp:<code>",
 *   "title":   "<ERROR_CODE>",
 *   "status":  400,
 *   "traceId": "<uuid>"
 * }
 * ```
 *
 * Registered via `APP_FILTER` in `CompModule` so it applies globally to all
 * COMP routes.
 *
 * RULE-08: no console.log — uses Nest Logger.
 *
 * @see src/infrastructure/comp/middleware/correlation.middleware.ts
 * @see docs/architecture/backend/issues/COMP-018.md
 */
@Catch()
export class ProblemJsonFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemJsonFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request & { correlationId?: string }>();
    const res = ctx.getResponse<Response>();

    // traceId comes from the request; CorrelationMiddleware sets it.
    const traceId: string =
      req.correlationId ??
      (req.headers[CORRELATION_HEADER] as string | undefined) ??
      'unknown';

    let status: number;
    let type: string;
    let title: string;

    if (exception instanceof DomainException) {
      status = exception.status;
      type = `urn:cordele:comp:${exception.code.toLowerCase().replace(/_/g, '-')}`;
      title = exception.code;
    } else if (
      exception instanceof NotFoundException ||
      exception instanceof UnauthorizedException ||
      exception instanceof ForbiddenException
    ) {
      // Explicit mapping for the most common HTTP exceptions so the filter
      // is self-documenting (COMP-018 requirement).
      status = exception.getStatus();
      type = `urn:ietf:rfc:9110:${status}`;
      title = exception.name;
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      type = `urn:ietf:rfc:9110:${status}`;
      title = exception.name;
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      type = 'urn:ietf:rfc:9110:500';
      title = 'InternalServerError';
      this.logger.error(
        'Unhandled exception',
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    res
      .status(status)
      .setHeader('Content-Type', 'application/problem+json')
      .json({ type, title, status, traceId });
  }
}
