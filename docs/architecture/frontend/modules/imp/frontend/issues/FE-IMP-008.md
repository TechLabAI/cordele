## [FE-IMP-008] ManuscriptApiService — operações de leitura (getById, getEstrutura, listByProjeto)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`ManuscriptApiService` expõe `getById()`, `getEstrutura()` e `listByProjeto()` — cobrindo
o reload/deep-link de T04, a refetch de árvore grande e o histórico de imports por projeto.

**Context / Problem statement:**
- SPEC-04 §1 e §3 e `backend-api-cross-link.md §1` definem as três operações de leitura.
- `getById()` é chamado apenas em deep-link/reload (não é polling; ADR-IMP-001).
- `getEstrutura()` é reservado para refetch de árvore grande — não é o caminho padrão.
- `listByProjeto()` alimenta o histórico de imports (contexto re-import em T03).
- Bloqueia: FE-IMP-011 (ReviewFacade)

**Approach (execution path):**
1. Adicionar a `ManuscriptApiService` (mesma classe de FE-IMP-007):
   - `getById(manuscritoId: string): Observable<ManuscritoDetail>`
     → `GET /api/imp/manuscripts/{manuscritoId}`
   - `getEstrutura(manuscritoId: string): Observable<ContentTree>`
     → `GET /api/imp/manuscripts/{manuscritoId}/estrutura`
   - `listByProjeto(projetoId: string): Observable<ManuscritoSummary[]>`
     → `GET /api/imp/projetos/{projetoId}/manuscritos`
2. Nenhum dos três usa `reportProgress`.
3. `getById()` pode auto-retry uma vez em 5xx (idempotente, SPEC-07 §4).
4. `listByProjeto()` retorna lista imutável (newest first); não cacheia.

**Non-goals:**
- Não implementa endpoints de ignore/confirm do addendum (FE-IMP-009).

**Layer(s):**
frontend / libs/imp/data-access

**Bounded context:**
imp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-04-data-access.md` (§1, §3)
- `docs/architecture/frontend/modules/imp/frontend/contracts/backend-api-cross-link.md` (§1)

**Architecture alignment:**
- Tag Nx: `scope:imp`, `type:data-access`

**Implementation checklist (by file):**

**Lib: libs/imp/data-access**
- 🔲 `libs/imp/data-access/src/lib/services/manuscript-api.service.ts` (getById, getEstrutura, listByProjeto)

**Tests**
- 🔲 `nx test imp-data-access` PASS (HttpTestingController para os 3 GETs)
- 🔲 `nx lint imp-data-access` PASS

**Milestone:**
Wave 2 / P2 Data Access

**Labels:**
type:feature
layer:frontend
scope:imp
priority:P2

**Acceptance criteria:**
- `npx nx test imp-data-access` PASS
- `npx nx lint imp-data-access` PASS
- `npx nx build imp-data-access` PASS
- `getById` NÃO usa `reportProgress`
- `getById` auto-retry máximo 1 vez em 5xx

**Dependencies:**
- FE-IMP-006 (DTOs)
- FE-IMP-007 (ManuscriptApiService base)

**Data impact:**
- Nenhum

**API / Contract impact:**
- GET /api/imp/manuscripts/{id} (§4.2)
- GET /api/imp/manuscripts/{id}/estrutura (§4.3)
- GET /api/imp/projetos/{projetoId}/manuscritos (§4.4)

**Testing / Evidence required:**
- `HttpTestingController` confirma URLs e métodos corretos

**Risks / Notes:**
- `getEstrutura` é path de exceção (árvore grande); não chamar por padrão em T04 — só quando
  `ReviewFacade` decidir necessário.
