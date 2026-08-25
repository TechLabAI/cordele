## [INT-FE-PROJ-003] Integração PROJ→IMP — handoff pós-reopen para /imp/upload | /revisao-de-estrutura

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
Após reopen bem-sucedido com 200 `ProjetoDetail`, `HistoryFacade.reopen()` navega para a rota
IMP correta (`/imp/upload` para rascunho ou `/imp/revisao-de-estrutura/:manuscritoId`). O handoff
passa apenas `projetoId` como route param; IMP carrega seu próprio estado.

**Context / Problem statement:**
- ADR-PROJ-001 + SPEC-01 §2: handoff cross-module via route param apenas; PROJ não injeta
  estado em memória compartilhada.
- `reopen()` pode retornar `ProjetoDetail` com `status = 'rascunho'` (reopen enviou para rascunho)
  → rota IMP. O resolver stage-aware (FE-PROJ-011) mapeia o novo status para o target.
- O IMP recebe `projetoId` pelo route param e re-busca o próprio estado (IMP-ADR).
- O BE executa `advanceTo({ projetoId, targetStatus: 'rascunho' })` no reopen (decisão M2 D-D).

**Approach (execution path):**
1. Em `HistoryFacade.reopen()` após 200 `ProjetoDetail`:
   - Chamar `ProjetoNavigationService.resolveOpenTarget(detail.status, projetoId)`.
   - `Router.navigate([resolvedTarget, projetoId])` (ou URL construída pelo resolver).
2. Verificar que o `ProjetoNavigationService` retorna `/imp/upload` quando `detail.status === 'rascunho'`.
3. Testar que o navigate é chamado com a URL IMP correta após o 200.

**Non-goals:**
- Não implementa o módulo IMP (responsabilidade de IMP).
- Não passa estado além do `projetoId`.

**Layer(s):**
frontend / libs/proj/data-access (HistoryFacade) + libs/proj/navigation

**Bounded context:**
proj → imp (cross-module handoff)

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-04-data-access.md` (§2 reopen flow)
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-01-route-map.md` (§2)

**Architecture alignment:**
- Tag Nx: `scope:proj`, `type:data-access`
- Route param only; sem estado cross-module (ADR-PROJ-001)

**Implementation checklist (by file):**

**Lib: libs/proj/data-access**
- 🔲 `HistoryFacade.reopen()` — navega via `ProjetoNavigationService.resolveOpenTarget` após 200

**Tests**
- 🔲 `nx test proj-data-access` PASS — reopen → status `rascunho` → navigate `/imp/upload`
- 🔲 `nx lint proj-data-access` PASS

**Milestone:**
Wave 4 / P4 Integrações

**Labels:**
type:integration
layer:frontend
scope:proj
priority:P4

**Acceptance criteria:**
- Após reopen 200, Router.navigate recebe a URL IMP correta (verificado por spy)
- Nenhum estado em memória é compartilhado entre PROJ e IMP além do route param

**Dependencies:**
- FE-PROJ-010 (HistoryFacade)
- FE-PROJ-011 (ProjetoNavigationService)

**Data impact:**
- Nenhum

**API / Contract impact:**
- `POST /api/proj/projetos/{id}/reopen` → 200 `ProjetoDetail` com novo `status`

**Testing / Evidence required:**
- Spy em `Router.navigate` verifica URL IMP com `projetoId`

**Risks / Notes:**
- Se IMP ainda não estiver deployado, o navigate pode retornar 404; considerar feature flag
  para habilitar o reopen só quando IMP estiver disponível.
- Bloqueia na disponibilidade do módulo IMP no shell; pode-se usar stub de rota em dev.
