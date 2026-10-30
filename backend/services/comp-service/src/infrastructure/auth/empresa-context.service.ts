import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

/**
 * Context stored per request via `AsyncLocalStorage`.
 *
 * Populated by `EmpresaContextMiddleware` before any guard or handler runs.
 * Every repository call is scoped by `empresaId` (RULE-07).
 *
 * `correlationId` is set by `CorrelationMiddleware` (runs before
 * `EmpresaContextMiddleware`) and forwarded into the ALS so that any provider
 * that injects `EmpresaContextService` can include it in structured logs
 * without receiving it as an explicit parameter.
 */
export interface EmpresaRequestContext {
  readonly userId: string;
  readonly empresaId: string;
  /** Distributed tracing id forwarded from `X-Correlation-Id` (COMP-018). */
  readonly correlationId?: string;
}

/**
 * EmpresaContextService — wrapper de `AsyncLocalStorage` para propagação do
 * contexto de empresa no escopo de cada requisição HTTP.
 *
 * Registrado como `@Global()` via `AuthModule`; pode ser injetado em qualquer
 * provider (repositórios, use-cases) sem imports adicionais.
 *
 * Uso:
 * ```ts
 * // No middleware (popula):
 * empresaContextService.run({ userId, empresaId }, () => next());
 *
 * // No repositório / use-case (lê):
 * const ctx = empresaContextService.require();
 * ```
 *
 * @see docs/architecture/shared/multi-empresa.md
 * @see docs/architecture/backend/plans/plan-COMP.md §P5
 */
@Injectable()
export class EmpresaContextService {
  private readonly als = new AsyncLocalStorage<EmpresaRequestContext>();

  /**
   * Executa `fn` dentro de um contexto de empresa.
   *
   * Usado pelo middleware para envolver toda a cadeia de handlers numa mesma
   * instância de `AsyncLocalStorage`, garantindo propagação automática pelo
   * event-loop (promises, timers, callbacks).
   */
  run<T>(context: EmpresaRequestContext, fn: () => T): T {
    return this.als.run(context, fn);
  }

  /**
   * Retorna o contexto de empresa ativo.
   *
   * Retorna `undefined` se chamado fora de um contexto (ex.: em testes
   * unitários sem o middleware). Callers que requerem o contexto devem usar
   * `require()`.
   */
  get(): EmpresaRequestContext | undefined {
    return this.als.getStore();
  }

  /**
   * Retorna o contexto de empresa ativo ou lança `Error` se ausente.
   *
   * Use em repositórios e use-cases onde o contexto é obrigatório (RULE-07).
   */
  require(): EmpresaRequestContext {
    const ctx = this.als.getStore();
    if (!ctx) {
      throw new Error(
        'EmpresaContext not set — request context is missing. ' +
          'Ensure EmpresaContextMiddleware is applied for this route.',
      );
    }
    return ctx;
  }
}
