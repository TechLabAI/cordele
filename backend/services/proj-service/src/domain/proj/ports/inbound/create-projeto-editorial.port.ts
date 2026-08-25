/**
 * Inbound port for creating a ProjetoEditorial.
 *
 * Published as a DI provider under `CREATE_PROJETO_USE_CASE` so IMP can inject
 * it without coupling to the use-case implementation class (ADR-001 / PROJ-006).
 *
 * Pure domain interface — zero @nestjs/* and zero @prisma/client imports
 * (RULE-01 / RULE-02).
 *
 * integration-contracts §1.1:
 *   Caller: IMP (create-and-upload flow, D-C)
 *   Input:  { titulo: string }
 *   Output: { projetoId: string }
 */
export interface CreateProjetoEditorialPort {
  /**
   * Creates a new ProjetoEditorial in status `rascunho` from the IMP flow.
   *
   * @param input - `titulo` maps to `projeto_editorial.nome`
   * @returns resolved projetoId; editoraId comes from EmpresaContext (AsyncLocalStorage)
   */
  create(input: { titulo: string }): Promise<{ projetoId: string }>;
}
