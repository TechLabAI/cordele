import { randomUUID } from 'node:crypto';

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Observable } from 'rxjs';

import { CorrelationContextService } from './correlation-context.service';

/**
 * CorrelationInterceptor — PUB-017 (P7, SPEC-07).
 *
 * Ensures every response from `PubController` carries a `X-Correlation-Id`
 * header, and propagates the ID into `CorrelationContextService` (AsyncLocalStorage)
 * so downstream providers (PubLoggerService, build diagnostics) can read it
 * without additional coupling.
 *
 * ### Behaviour
 * 1. Reads `X-Correlation-Id` from the inbound request header.
 * 2. If absent, generates a fresh UUID v4.
 * 3. Sets `X-Correlation-Id` on the response **before the handler executes**.
 * 4. Runs the handler inside an `AsyncLocalStorage` context keyed by the ID
 *    (best-effort: ALS propagation covers synchronous callchains; async hops
 *    outside NestJS scope may lose the store).
 *
 * Registered as `APP_INTERCEPTOR` in `PubObservabilityModule` so it covers
 * every route without `PubController` importing from `infrastructure/` (RULE-04).
 *
 * RULE-04: modules/ does not import infrastructure/. ✓
 */
@Injectable()
export class CorrelationInterceptor implements NestInterceptor {
  constructor(
    private readonly correlationContextService: CorrelationContextService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const correlationId =
      (req.headers['x-correlation-id'] as string | undefined) ?? randomUUID();

    // Set the response header immediately — criterion: present in ALL responses.
    res.setHeader('X-Correlation-Id', correlationId);

    // Propagate into ALS so PubLoggerService and build-metrics can read it
    // without needing the request object injected.
    return new Observable((subscriber) => {
      this.correlationContextService.run({ correlationId }, () => {
        next.handle().subscribe({
          next: (value) => subscriber.next(value),
          error: (err: unknown) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
