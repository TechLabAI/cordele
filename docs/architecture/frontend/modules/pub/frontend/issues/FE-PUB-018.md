## [FE-PUB-018] feature-history routes + DownloadEHistoricoComponent (T08 smart — promote + strip mocks)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/pub/feature-history` contém as routes de T08 e `DownloadEHistoricoComponent` promovido do
protótipo e conectado ao HistoryFacade. Artefatos de mock removidos. On entry: chama
`facade.openHistory(projetoId)`; delegação de ações (download, newExport, adjustMetadata, backToLibrary)
via facade.

**Context / Problem statement:**
- D-493: promover DownloadEHistoricoComponent de
  `frontend/design-reference/angular-prototype/apps/cordele-web/src/app/screens/download-e-historico/`.
- SPEC-02 §2 define os signals que o componente lê (status, projeto, meta, publicacoes, stats, versaoAtualId).
- Remoção de todos os dados hardcoded do protótipo (KPIs, lista de publicações mock, datas fixas).
- Bloqueia: FE-PUB-027 (e2e T08)

**Approach (execution path):**
1. Criar `libs/pub/feature-history/src/lib/history.routes.ts` com rota T08.
2. Promover DownloadEHistoricoComponent para
   `libs/pub/feature-history/src/lib/download-e-historico/`.
3. Remover todos os dados hardcoded e importações de mock-data.
4. Injetar `HistoryFacade`; ler signals (status, projeto, meta, publicacoes, stats, versaoAtualId).
5. On init: `facade.openHistory(projetoId)` via ActivatedRoute.
6. Wiring de outputs de sub-componentes para facade calls.
7. Re-exportar via index.ts.

**Non-goals:**
- Não implementa sub-componentes (FE-PUB-019, FE-PUB-020).
- Não implementa HistoryFacade (FE-PUB-010).

**Layer(s):**
frontend / libs/pub/feature-history

**Bounded context:**
pub

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§2)
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-01-route-map.md` (§1 T08)

**Architecture alignment:**
- Tag Nx: `scope:pub`, `type:feature`
- Standalone + OnPush; signals via HistoryFacade
- Nenhum dado hardcoded de publicação

**Implementation checklist (by file):**

**Lib: libs/pub/feature-history**
- 🔲 `libs/pub/feature-history/src/lib/history.routes.ts`
- 🔲 `libs/pub/feature-history/src/lib/download-e-historico/download-e-historico.component.ts`
- 🔲 `libs/pub/feature-history/src/lib/download-e-historico/download-e-historico.component.html`
- 🔲 `libs/pub/feature-history/src/index.ts`

**Tests**
- 🔲 `nx test pub-feature-history` PASS (init chama openHistory; status=empty → empty state; sem dados hardcoded)
- 🔲 `nx lint pub-feature-history` PASS

**Milestone:**
Wave 3 / P3 Feature Libs

**Labels:**
type:feature
layer:frontend
scope:pub
priority:P3

**Acceptance criteria:**
- `npx nx test pub-feature-history` PASS
- `npx nx lint pub-feature-history` PASS
- `npx nx build pub-feature-history` PASS
- On init: facade.openHistory(projetoId) chamado
- Nenhuma referência a dados hardcoded de publicação

**Dependencies:**
- FE-PUB-002 (routes), FE-PUB-010 (HistoryFacade), FE-PUB-019..020 (sub-componentes)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Via HistoryFacade: GET §4.3, §4.5, cross-context PROJ/COMP

**Testing / Evidence required:**
- Spy em facade.openHistory: chamado com projetoId correto no init

**Risks / Notes:**
- Status 'empty' quando publicacoes=[] → HistoryEmptyStateComponent (FE-PUB-020).
