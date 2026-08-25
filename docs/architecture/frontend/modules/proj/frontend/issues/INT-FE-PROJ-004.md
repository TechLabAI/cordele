## [INT-FE-PROJ-004] Integração PROJ→COMP — handoff pós-reopen para /comp/config | /comp/editor-de-layout-preview

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
Após reopen bem-sucedido com 200 `ProjetoDetail` e `status = 'em_composicao'`, `HistoryFacade.reopen()`
navega para a rota COMP correta: "Ajustar metadados" → `/comp/config`, "Ajustar layout" →
`/comp/editor-de-layout-preview`. O handoff passa `projetoId` via route param.

**Context / Problem statement:**
- SPEC-01 §2 define os dois alvos COMP distintos por CTA:
  - "Ajustar metadados" → COMP `/comp/config`
  - "Ajustar layout" → COMP `/comp/editor-de-layout-preview`
- `HistoryFacade.reopen(projetoId, target: 'metadata'|'layout')` precisa conhecer o alvo
  para navegar para a rota correta após o 200.
- `reopen()` envia o mesmo `POST .../reopen` independente do alvo (COMP decide o estado interno);
  a distinção de rota é do FE PROJ, não do BE.

**Approach (execution path):**
1. Ajustar `HistoryFacade.reopen(projetoId, target: 'metadata' | 'layout')`:
   - Após 200: `target === 'metadata'` → `/comp/config`; `target === 'layout'` → `/comp/editor-de-layout-preview`.
   - Passar `projetoId` via route param: `/comp/config?projetoId=${id}` ou `/comp/config/${id}` conforme rota COMP.
2. Atualizar `DownloadEHistoricoComponent.onReopenMetadata()` → `reopen(id, 'metadata')`;
   `onReopenLayout()` → `reopen(id, 'layout')`.
3. Testar os dois caminhos com spy em `Router.navigate`.

**Non-goals:**
- Não implementa o módulo COMP (responsabilidade de COMP).
- Não muta estado de COMP; o handoff é via route param.

**Layer(s):**
frontend / libs/proj/data-access (HistoryFacade) + libs/proj/feature-history

**Bounded context:**
proj → comp (cross-module handoff)

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-01-route-map.md` (§2 — T08 transitions)
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-04-data-access.md` (§2 — reopen)

**Architecture alignment:**
- Tag Nx: `scope:proj`, `type:data-access`
- Route param only; sem estado cross-module

**Implementation checklist (by file):**

**Lib: libs/proj/data-access**
- 🔲 `HistoryFacade.reopen()` — parâmetro `target: 'metadata'|'layout'`; navega para COMP correto

**Lib: libs/proj/feature-history**
- 🔲 `DownloadEHistoricoComponent` — passa `target` correto para cada CTA

**Tests**
- 🔲 `nx test proj-data-access` PASS — reopen `metadata` + 200 → navigate `/comp/config`
- 🔲 `nx test proj-data-access` PASS — reopen `layout` + 200 → navigate `/comp/editor-de-layout-preview`
- 🔲 `nx lint proj-feature-history` PASS

**Milestone:**
Wave 4 / P4 Integrações

**Labels:**
type:integration
layer:frontend
scope:proj
priority:P4

**Acceptance criteria:**
- Spy em `Router.navigate`: "Ajustar metadados" → `/comp/config`; "Ajustar layout" → `/comp/editor-de-layout-preview`
- `projetoId` presente no navigate call em ambos os casos

**Dependencies:**
- FE-PROJ-010 (HistoryFacade — reopen pessimista já implementado)
- FE-PROJ-014 (DownloadEHistoricoComponent — CTAs já presentes)

**Data impact:**
- Nenhum

**API / Contract impact:**
- `POST /api/proj/projetos/{id}/reopen` (mesma chamada para ambos os targets)

**Testing / Evidence required:**
- 2 spy tests: um por CTA

**Risks / Notes:**
- Confirmar as URLs exatas de COMP (`/comp/config` e `/comp/editor-de-layout-preview`) com o
  módulo COMP antes de implementar; se ainda não existirem, usar placeholder e criar card de
  follow-up para atualizar quando COMP for scaffolded.
- Se COMP não existir no shell ainda, o navigate resulta em 404; usar feature flag `proj.reopen`
  como kill-switch.
