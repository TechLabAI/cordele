import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

/** Lowercase header name used for distributed request tracing. */
export const CORRELATION_ID_HEADER = 'x-correlation-id';

/**
 * NestJS middleware that ensures every HTTP request carries an `X-Correlation-Id`
 * header, echoed in the response, and stored for downstream consumers.
 *
 * Behaviour:
 *  - If the inbound request already contains the header, the same value is
 *    echoed back in the response (allows callers to correlate across services).
 *  - When the header is absent, a new UUID v4 is generated via `crypto.randomUUID()`
 *    (Node ≥ 14.17 — no external dependency required).
 *  - The correlation id is stored in `request.correlationId` so downstream
 *    handlers (`ProblemJsonFilter`, `RequestLoggerMiddleware`) can access it.
 *
 * ALS propagation (COMP-018):
 *  - `EmpresaContextMiddleware` (runs immediately after this middleware) forwards
 *    `req.correlationId` into the `AsyncLocalStorage` context, making it
 *    available to every provider via `EmpresaContextService.get()?.correlationId`
 *    for the full lifetime of the request — no explicit parameter passing needed.
 *
 * MUST be registered before `EmpresaContextMiddleware` and any exception filter
 * to guarantee `traceId` availability in error responses (COMP-018).
 *
 * RULE-08: no console.log — uses Nest Logger.
 *
 * @see src/infrastructure/auth/empresa-context.middleware.ts
 * @see src/infrastructure/comp/filters/problem-json.filter.ts
 * @see src/infrastructure/comp/middleware/request-logger.middleware.ts
 */
@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CorrelationMiddleware.name);

  use(
    req: Request & { correlationId?: string },
    res: Response,
    next: NextFunction,
  ): void {
    const incoming = req.headers[CORRELATION_ID_HEADER] as string | undefined;
    const correlationId = incoming ?? crypto.randomUUID();

    // Store on request so ProblemJsonFilter and RequestLoggerMiddleware can read it.
    req.correlationId = correlationId;

    // Echo back so the caller can correlate request ↔ response.
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    this.logger.debug(`correlationId=${correlationId}`);
    next();
  }
}
