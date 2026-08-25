## [INT-FE-PUB-003] Integração cross-context COMP — getAutor (T08 subtitle metadados)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`PublicacaoApiService.getAutor(projetoId)` lê o campo `autor` de COMP `GetMetadados` para o
subtitle do cabeçalho de T08. Falha em getAutor não bloqueia o carregamento da tela (degraded gracefully).

**Context / Problem statement:**
- `contracts/backend-api-cross-link.md §1`: autor vem de COMP Metadados (cross-context).
- HistoryFacade.openHistory usa forkJoin — erro em getAutor não deve quebrar o carregamento todo.
- `backend-api-cross-link.md §6` GAP 3: mesma decisão de proxy vs direto que INT-FE-PUB-002.

**Approach (execution path):**
1. Em `getAutor()` de PublicacaoApiService: chamar endpoint COMP GetMetadados para campo autor.
2. Em HistoryFacade.openHistory: usar `combineLatest` ou `forkJoin` com `catchError` em getAutor
   (falha → autor = null, sem bloquear o restante).
3. Exibir subtitle vazio quando autor = null (não fabricar valor).

**Non-goals:**
- Não modifica contratos de COMP.

**Layer(s):**
frontend / libs/pub/data-access

**Bounded context:**
pub ↔ comp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/contracts/backend-api-cross-link.md` (§1, §6 GAP 3)

**Milestone:**
Wave 4 / P4 Hub Integrations

**Labels:**
type:integration
layer:frontend
scope:pub
priority:P4

**Acceptance criteria:**
- getAutor retorna { autor: string }
- Falha em getAutor: autor = null; T08 carrega sem subtitle; sem erro bloqueante

**Dependencies:**
- FE-PUB-007, FE-PUB-010

**Risks / Notes:**
- Confirmar endpoint COMP GetMetadados antes de codificar URL.
