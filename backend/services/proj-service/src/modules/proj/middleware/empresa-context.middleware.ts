import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

/**
 * Middleware responsible for populating the EmpresaContext AsyncLocalStorage
 * store before the request reaches any handler.
 *
 * P1 stub — the actual JWT-claim extraction and store population are wired in
 * P5 (PROJ-014: security phase). In P1 the middleware is registered in the
 * module consumer so the wiring structure is stable; the store is a no-op
 * passthrough until authentication infrastructure is ready.
 *
 * RULE-04 compliance: this middleware lives in src/modules/proj/middleware/ —
 * it does NOT import src/infrastructure/ directly. In P5 the real
 * EmpresaContextHolder (infrastructure) will be injected via the DI token
 * EMPRESA_CONTEXT_TOKEN declared in proj.tokens.ts.
 */
@Injectable()
export class EmpresaContextMiddleware implements NestMiddleware {
  use(_req: Request, _res: Response, next: NextFunction): void {
    // P1 stub: no-op passthrough.
    // P5 will read `req.user.empresaId` (from the parsed JWT) and call
    // EmpresaContextHolder.run({ empresaId }, next) so every downstream
    // repository call receives the correct Postgres schema path.
    next();
  }
}
