## [INT-FE-PROJ-006] Integração PROJ←PUB — nova exportação handoff, /pub/exportacao-e-validacao

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
O CTA "Nova exportação" (T08) navega para `PUB /pub/exportacao-e-validacao` passando `projetoId`
como route param. PROJ não valida o estado do PUB — apenas roteiam. O handoff é via route param;
PUB carrega seu próprio estado (ADR-PROJ-001).

**Context / Problem statement:**
- SPEC-01 §2: `onNewExport()` → PUB `/exportacao-e-validacao`.
- `canNewExport: boolean` no `ProjectHeaderVM` é verdadeiro quando `status ∈ {em_composicao, publicado, com_erros}`.
- Este CTA não é um write de PROJ — é navegação pura. Não há POST envolvido.
- Integração: PROJ→PUB via route; PUB deve aceitar `projetoId` no param para saber qual projeto exportar.

**Approach (execution path):**
1. Em `DownloadEHistoricoComponent.onNewExport()`:
   - `Router.navigate(['/pub/exportacao-e-validacao'], { queryParams: { projetoId } })`.
   - (Ou route param, dependendo da convenção do módulo PUB — confirmar com PUB spec.)
2. Verificar que `canNewExport` só habilita o CTA quando `status ∈ {em_composicao, publicado, com_erros}`.
3. Testar o navigate com spy em `Router.navigate`.

**Non-goals:**
- Não implementa PUB (responsabilidade de PUB).
- Não faz nenhum POST ou mutação de estado.

**Layer(s):**
frontend / libs/proj/feature-history

**Bounded context:**
proj → pub (cross-module handoff)

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-01-route-map.md` (§2 — "Nova exportação")
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-03-view-models.md` (§2 — canNewExport)

**Architecture alignment:**
- Tag Nx: `scope:proj`, `type:feature`
- Route param only; sem estado cross-module (ADR-PROJ-001)

**Implementation checklist (by file):**

**Lib: libs/proj/feature-history**
- 🔲 `DownloadEHistoricoComponent.onNewExport()` — navigate para PUB com `projetoId`
- 🔲 `ProjectHeaderComponent` — `canNewExport` input; CTA condicional com `@if`

**Tests**
- 🔲 `nx test proj-feature-history` PASS — `canNewExport=true` + click → navigate PUB com projetoId
- 🔲 `nx test proj-feature-history` PASS — `canNewExport=false` → CTA ausente do DOM
- 🔲 `nx lint proj-feature-history` PASS

**Milestone:**
Wave 4 / P4 Integrações

**Labels:**
type:integration
layer:frontend
scope:proj
priority:P4

**Acceptance criteria:**
- Spy em `Router.navigate` verifica URL `/pub/exportacao-e-validacao` com `projetoId`
- CTA só visível quando `status ∈ {em_composicao, publicado, com_erros}`

**Dependencies:**
- FE-PROJ-014 (DownloadEHistoricoComponent)
- FE-PROJ-010 (HistoryFacade — `canNewExport` derivado do status)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum (navegação pura)

**Testing / Evidence required:**
- Spy em `Router.navigate`; teste de condicional `@if canNewExport`

**Risks / Notes:**
- A URL exata de PUB (`/pub/exportacao-e-validacao`) deve ser confirmada com o módulo PUB antes
  de implementar. Se ainda não existir, usar placeholder e feature flag `proj.quickDownload` como
  indicador temporário (ou nova flag).
- Status `rascunho` não tem CTA "Nova exportação" (não faz sentido exportar sem composição).
