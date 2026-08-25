## [FE-PROJ-010] HistoryFacade — forkJoin, reopen pessimista, 409 defensivo

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/proj/data-access` expõe `HistoryFacade` com state machine `loading|ready|error|not-found`.
O carregamento usa `forkJoin` (detail + publicações em paralelo). O reopen é **pessimista**: aguarda
200 antes de navegar; 409 exibe toast defensivo sem mudar estado. `reopenPending` desabilita os CTAs
enquanto o POST está in-flight.

**Context / Problem statement:**
- SPEC-04 §2 define a state machine de `HistoryFacade` com o fluxo de reopen pessimista.
- `forkJoin` para `getProjeto` e `listPublicacoes`: 404 em qualquer um → `not-found`.
- `reopen()` é a única escrita PROJ no MVP; não há flip optimista (ADR-PROJ-001 refinement).
- 409 `urn:cordele:proj:illegal-status-transition` é defensivo (o CTA já fica oculto para status
  inelegível); se chegar, exibe toast e reseta `reopenPending`.
- Bloqueia: FE-PROJ-014 (DownloadEHistoricoComponent consome a facade)

**Approach (execution path):**
1. Criar `libs/proj/data-access/src/lib/history.facade.ts`:
   - Sinais: `status`, `header`, `publications`, `reopenPending`, `degraded`.
   - `load(projetoId)`: `forkJoin([getProjeto(id), listPublicacoes(id)])` → 200/200 → `ready`;
     404 de qualquer um → `not-found`; PUB degraded → `ready` com `publications=[]` + `degraded=true`.
   - `reopen(projetoId, target: 'metadata'|'layout')`:
     - Seta `reopenPending = true`.
     - `POST .../reopen` → 200 `ProjetoDetail` → navega para COMP (`/comp/config` ou `/comp/editor-de-layout-preview`).
     - 409 → `reopenPending = false`; emite toast via `@cordele/shared/ui-feedback`.
   - `cancelInFlight()` para `projDestroy()`.
2. Expor `HistoryVM` como readonly signals.

**Non-goals:**
- Não faz flip optimista de status.
- Não implementa o componente de toast (responsabilidade de `@cordele/shared/ui-feedback`).

**Layer(s):**
frontend / libs/proj/data-access

**Bounded context:**
proj

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-04-data-access.md` (§2, diagrama HistoryFacade)
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-03-view-models.md` (§2)

**Architecture alignment:**
- Tag Nx: `scope:proj`, `type:data-access`
- Signals-first; `forkJoin` na inicialização; `reopenPending` gates CTAs no template

**Implementation checklist (by file):**

**Lib: libs/proj/data-access**
- 🔲 `libs/proj/data-access/src/lib/history.facade.ts`
- 🔲 `libs/proj/data-access/src/index.ts` (exporta `HistoryFacade`)

**Tests**
- 🔲 `nx test proj-data-access` PASS — `load()` emite 2 GETs em paralelo; 200/200 → `ready`
- 🔲 `nx test proj-data-access` PASS — 404 em getProjeto → `not-found`
- 🔲 `nx test proj-data-access` PASS — `reopen()` 200 → navega para COMP (spy em Router)
- 🔲 `nx test proj-data-access` PASS — `reopen()` 409 → `reopenPending() === false`; toast emitido
- 🔲 `nx test proj-data-access` PASS — `reopenPending` bloqueia segundo clique simultâneo
- 🔲 `nx lint proj-data-access` PASS

**Milestone:**
Wave 2 / P2 Data Access

**Labels:**
type:feature
layer:frontend
scope:proj
priority:P2

**Acceptance criteria:**
- `npx nx test proj-data-access` PASS
- `npx nx lint proj-data-access` PASS
- `reopen()` nunca navega para COMP antes do 200 (pessimista, verificado por spy de ordem)
- 409 defensivo: `reopenPending` reset + toast emitido; estado do header não muda

**Dependencies:**
- FE-PROJ-007 (ProjetoApiService — reopen + listPublicacoes + getProjeto)
- FE-PROJ-008 (mappers e DTOs)

**Data impact:**
- `POST /api/proj/projetos/{id}/reopen` muta status do projeto no BE

**API / Contract impact:**
- `GET /api/proj/projetos/{id}`, `GET /api/proj/projetos/{id}/publicacoes`
- `POST /api/proj/projetos/{id}/reopen` (200 ProjetoDetail | 409 problem+json)

**Testing / Evidence required:**
- Teste de sequência de reopen: assert que Router.navigate só é chamado APÓS o 200

**Risks / Notes:**
- Se `@cordele/shared/ui-feedback` não tiver API de toast estável, usar stub no teste.
- O 409 `urn:cordele:proj:illegal-status-transition` deve ser mapeado para a mensagem pt-BR
  "Este projeto ainda não pode ser reaberto." (SPEC-07 §1).
