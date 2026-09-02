/**
 * EmpresaContextRunnerPort — port para restaurar o contexto de empresa dentro
 * de jobs assíncronos (INT-PUB-006).
 *
 * Abstrai `EmpresaContextService.runAs()` (infrastructure/auth) de forma que
 * `GeneratePublicationUseCase` (modules/) possa utilizá-lo sem importar
 * diretamente de `infrastructure/` (RULE-04).
 *
 * A implementação concreta (`EmpresaContextService`) é injetada via
 * `EMPRESA_CONTEXT_RUNNER_PORT` no `AppModule` usando `useExisting`.
 *
 * Uso (no fire-and-forget de GeneratePublicationUseCase):
 * ```ts
 * const empresaId = user.empresaId; // capturado ANTES do Promise.resolve()
 * Promise.resolve()
 *   .then(() =>
 *     this.empresaContextRunner.runAs(empresaId, () =>
 *       this.buildJob.run({ publicacaoId, projetoId, empresaId })
 *     )
 *   );
 * ```
 *
 * Risco mitigado (INT-PUB-006): `AsyncLocalStorage` perde contexto ao sair da
 * callstack síncrona. A captura ANTES do `Promise.resolve()` + o `runAs` dentro
 * do callback garante que todo código interno ao job (inclusive sub-promises)
 * enxerga o contexto da empresa correta.
 *
 * Critério de aceite: dois jobs paralelos de empresas distintas nunca
 * compartilham `EmpresaContext` porque cada um cria uma entrada separada no
 * `AsyncLocalStorage` via `runAs`.
 *
 * @see docs/architecture/shared/multi-empresa.md
 * @see pub.tokens.ts (EMPRESA_CONTEXT_RUNNER_PORT)
 */
export interface EmpresaContextRunnerPort {
  /**
   * Executa `fn` dentro de um contexto de empresa identificado por `empresaId`.
   *
   * Retorna o valor produzido por `fn` (pode ser uma Promise).
   *
   * `bearerToken` (INT-PUB-002): quando informado, é armazenado no ALS para
   * que adapters HTTP de saída (CompCompositionMetadataAdapter, etc.) possam
   * recuperá-lo via `EmpresaContextService.getBearerToken()` sem mudança de
   * assinatura das portas. Parâmetro opcional — chamadas existentes sem o
   * terceiro argumento continuam funcionando (bearer = undefined no ALS).
   */
  runAs<T>(empresaId: string, fn: () => T, bearerToken?: string): T;
}
