import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';

/**
 * Context stored per request (and per async job) via `AsyncLocalStorage`.
 *
 * Populated by `EmpresaContextMiddleware` for HTTP requests, and explicitly
 * re-bound by `GeneratePublicationUseCase` for the async `PublicationBuildJob`
 * (INT-PUB-006: context is captured synchronously before the fire-and-forget
 * dispatch, then restored inside the job via `runAs`).
 */
export interface EmpresaRequestContext {
  readonly userId: string;
  readonly empresaId: string;
}

/**
 * EmpresaContextService — wrapper de `AsyncLocalStorage` para propagação do
 * contexto de empresa no escopo de cada requisição HTTP e job assíncrono.
 *
 * Registrado como `@Global()` via `AuthModule`; pode ser injetado em qualquer
 * provider (repositórios, mappers factories) sem imports adicionais.
 *
 * Uso (middleware — popula o contexto do request):
 * ```ts
 * empresaContextService.run({ userId, empresaId }, () => next());
 * ```
 *
 * Uso (job assíncrono — restaura o contexto capturado antes do despacho):
 * ```ts
 * const empresaId = user.empresaId; // capturado ANTES do Promise.resolve()
 * Promise.resolve().then(() =>
 *   empresaContextService.runAs(empresaId, () => buildJob.run(input))
 * );
 * ```
 *
 * Uso (repositório / use-case — lê):
 * ```ts
 * const ctx = empresaContextService.get();
 * ```
 *
 * @see docs/architecture/shared/multi-empresa.md
 */
@Injectable()
export class EmpresaContextService {
  private readonly als = new AsyncLocalStorage<EmpresaRequestContext>();

  /**
   * Executa `fn` dentro de um contexto de empresa completo.
   *
   * Usado pelo middleware para envolver toda a cadeia de handlers numa mesma
   * instância de `AsyncLocalStorage`, garantindo propagação automática pelo
   * event-loop (promises, timers, callbacks).
   */
  run<T>(context: EmpresaRequestContext, fn: () => T): T {
    return this.als.run(context, fn);
  }

  /**
   * Executa `fn` dentro de um contexto de empresa identificado apenas pelo
   * `empresaId`.
   *
   * Usado pelo `GeneratePublicationUseCase` para restaurar o contexto dentro
   * do job assíncrono (INT-PUB-006). O `userId` é omitido pois o job não
   * executa operações que requerem identidade do usuário — apenas as do
   * schema de empresa.
   *
   * Risco mitigado: `AsyncLocalStorage` perde contexto ao sair da callstack
   * síncrona. Capturar o `empresaId` ANTES do `Promise.resolve()` e chamar
   * `runAs` dentro do callback garante que toda operação interna do job
   * (inclusive sub-promises) vê o contexto correto.
   */
  runAs<T>(empresaId: string, fn: () => T): T {
    return this.als.run({ userId: '', empresaId }, fn);
  }

  /**
   * Retorna o contexto de empresa ativo.
   *
   * Retorna `undefined` se chamado fora de um contexto (ex.: em testes
   * unitários sem o middleware). Callers que requerem o contexto devem lançar
   * explicitamente.
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
