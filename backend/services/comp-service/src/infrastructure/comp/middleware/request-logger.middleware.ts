import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { EmpresaContextService } from '../../auth/empresa-context.service';

/** Shape of the structured log entry emitted on each response finish. */
interface RequestLogEntry {
  correlationId: string;
  empresa: string;
  projetoId: string | undefined;
  route: string;
  method: string;
  statusCode: number;
  durationMs: number;
}

/**
 * NestJS middleware that emits a structured JSON log entry for every HTTP
 * request handled by the COMP service.
 *
 * The entry is written when the response is fully sent (`res.on('finish')`).
 * Fields:
 *  - `correlationId`  — from `req.correlationId` (set by `CorrelationMiddleware`)
 *  - `empresa`        — from `EmpresaContextService.get()?.empresaId`
 *  - `projetoId`      — extracted from the URL segment (`:projetoId`)
 *  - `route`          — `req.route?.path` if available, else `req.path`
 *  - `method`         — HTTP verb
 *  - `statusCode`     — final response status code
 *  - `durationMs`     — wall-clock time from middleware entry to response finish
 *
 * Uses the NestJS `Logger` — same pattern as every other class in COMP.
 * RULE-08: no console.log.
 *
 * Registration order (in `AppModule.configure`):
 *   1. CorrelationMiddleware  → sets req.correlationId
 *   2. EmpresaContextMiddleware → populates ALS with {userId, empresaId}
 *   3. RequestLoggerMiddleware  → reads both of the above
 *
 * @see src/infrastructure/comp/middleware/correlation.middleware.ts
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RequestLoggerMiddleware.name);

  constructor(private readonly empresaContextService: EmpresaContextService) {}

  use(
    req: Request & { correlationId?: string },
    res: Response,
    next: NextFunction,
  ): void {
    const startMs = Date.now();

    res.on('finish', () => {
      const empresaCtx = this.empresaContextService.get();
      const projetoId = this.extractProjetoId(req.path);

      const entry: RequestLogEntry = {
        correlationId: req.correlationId ?? 'unknown',
        empresa: empresaCtx?.empresaId ?? 'unknown',
        projetoId,
        // req.route is populated by Express after routing; fall back to raw path.
        route: (req as Request & { route?: { path: string } }).route?.path ?? req.path,
        method: req.method,
        statusCode: res.statusCode,
        durationMs: Date.now() - startMs,
      };

      this.logger.log(JSON.stringify(entry));
    });

    next();
  }

  /**
   * Extracts `:projetoId` from COMP route paths of the form
   * `/api/comp/projetos/<uuid>/...`.
   *
   * Returns `undefined` for routes that do not include a `projetoId` segment.
   */
  private extractProjetoId(path: string): string | undefined {
    // Match the UUID segment after /projetos/
    const match = /\/projetos\/([^/]+)/.exec(path);
    return match?.[1];
  }
}
