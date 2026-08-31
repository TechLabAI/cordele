import { AsyncLocalStorage } from 'async_hooks';
import { Injectable } from '@nestjs/common';

/**
 * Stores the correlation ID for the current request or async job.
 *
 * Populated by `CorrelationInterceptor` at the start of each HTTP request and
 * made available to any provider running inside the same async context.
 *
 * RULE-01/02 compliant: no Prisma, no NestJS decorators in domain/ — this
 * service lives in modules/ and uses only NestJS DI and Node.js built-ins.
 */
export interface CorrelationContext {
  readonly correlationId: string;
}

@Injectable()
export class CorrelationContextService {
  private readonly als = new AsyncLocalStorage<CorrelationContext>();

  /**
   * Executes `fn` within a correlation context.
   * Called by `CorrelationInterceptor` for every HTTP request.
   */
  run<T>(context: CorrelationContext, fn: () => T): T {
    return this.als.run(context, fn);
  }

  /**
   * Returns the active correlation context, or `undefined` when called outside
   * a request (e.g. unit tests without the interceptor).
   */
  get(): CorrelationContext | undefined {
    return this.als.getStore();
  }

  /**
   * Returns the active correlation ID, or a placeholder when outside a request
   * context (e.g. async jobs dispatched before the interceptor scope ends).
   */
  getCorrelationId(): string {
    return this.als.getStore()?.correlationId ?? 'no-correlation-id';
  }
}
