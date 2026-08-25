## [FE-COMP-010] Error mapping COMP — AppError → URN → feedback de UI

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
Todos os URNs de erro do `comp-service` (SPEC-07 §1) são corretamente mapeados para
feedback de UI: error state, empty state, banner, inline ou toast. O `correlationId` do
interceptor `ErrorNormalize` é sempre exibido junto ao erro para suporte.

**Context / Problem statement:**
- SPEC-07 §1 define a tabela completa de URN → HTTP → canal de UI.
- O mapeamento depende do `ErrorNormalize` interceptor de `@cordele/shared/access-http-base`
  (INT-FE-COMP-001); as facades apenas lêem `AppError.code` e definem o estado correto.
- 9 URNs para mapear: validation (400), unauthorized (401), forbidden (403),
  projeto-not-found (404), manuscript-missing (409), cover-too-large (413),
  unsupported-cover-format (415), override-ref-not-found (422), structural-edit-deferred (422).
- `compStatusGuard` (FE-COMP-020) trata o caso de projeto não em_composicao antes da API.

**Approach (execution path):**
1. Criar `libs/comp/data-access/src/lib/comp-error.mapper.ts` com a função
   `mapCompError(err: AppError): CompUiError` usando `switch` sobre `err.code`.
2. Garantir que MetadataFacade e LayoutFacade chamam `mapCompError` ao receber erros das
   APIs e definem o estado de signal correto (cover.error, status='error', toast, etc.).
3. Garantir que `correlationId` é propagado nos sinais de erro expostos ao template.
4. Adicionar teste unitário para cada mapeamento de URN.

**Non-goals:**
- Não implementa o interceptor `ErrorNormalize` (responsabilidade de `@cordele/shared`).
- Não exibe componentes de UI (FE-COMP-024).
- `illegal-status` **não existe** no api-contract; não mapear.

**Layer(s):**
frontend / libs/comp/data-access

**Bounded context:**
comp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-07-error-handling.md` (§1, §2, §3, §4)

**Architecture alignment:**
- Tag Nx: `scope:comp`, `type:data-access`
- Sem lógica de UI no data-access (só mapeamento de estado)

**Implementation checklist (by file):**

**Lib: libs/comp/data-access**
- 🔲 `libs/comp/data-access/src/lib/comp-error.mapper.ts`
- 🔲 Facades (FE-COMP-008, FE-COMP-009) atualizadas para usar `mapCompError`

**Tests**
- 🔲 `nx test comp-data-access` PASS — 9 URNs mapeados corretamente
- 🔲 `nx lint comp-data-access` PASS

**Milestone:**
Wave 2 / P2 Data access

**Labels:**
type:feature
layer:frontend
scope:comp
priority:P2

**Acceptance criteria:**
- `npx nx test comp-data-access` PASS
- Todos os 9 URNs de SPEC-07 têm mapeamento testado
- `correlationId` presente nos sinais de erro
- Nenhum mapeamento de `illegal-status` (não existe no contrato)

**Dependencies:**
- FE-COMP-008 (MetadataFacade), FE-COMP-009 (LayoutFacade)
- INT-FE-COMP-001 (ErrorNormalize interceptor ativo)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Consome `AppError` normalizado pelo interceptor

**Testing / Evidence required:**
- Teste unitário: 9 cenários, um por URN; verificar canal de UI correto

**Risks / Notes:**
- `urn:cordele:comp:structural-edit-deferred` é defensivo (unreachable em construção normal); manter o mapeamento para toast mas documentar que é defensive path.
