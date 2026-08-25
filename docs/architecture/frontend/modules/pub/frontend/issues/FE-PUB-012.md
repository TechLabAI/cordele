## [FE-PUB-012] feature-export routes + ExportacaoEValidacaoComponent (T07 smart — promote + strip mocks)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/pub/feature-export` contém as routes de T07 e `ExportacaoEValidacaoComponent` promovido do
protótipo. O componente está conectado ao ExportFacade via signals; os artefatos de mock removidos:
`setInterval` do progress timer, o seletor "Simular estado" e `AVISOS_MOCK`. O progresso é real
(bounded poll via facade); o download navega para T08.

**Context / Problem statement:**
- D-493 (prototype-to-production): promover ExportacaoEValidacaoComponent de
  `frontend/design-reference/angular-prototype/apps/cordele-web/src/app/screens/exportacao-e-validacao/`.
- generator-config.yml `prototype_source` aponta o arquivo original.
- SPEC-02 §1 define os signals que o componente lê (phase, publicacao, summary, avisos, podeBaixar, verdict).
- SPEC-04 §2 define as facade calls (requestExport on entry from COMP, resumeExport on re-entry).
- **Remoção obrigatória (gaps do protótipo):**
  - `setInterval` / timer de progresso (substituído por poll real via ExportFacade)
  - Seletor dropdown "Simular estado" e toda lógica de simulação associada
  - Constante `AVISOS_MOCK` e qualquer import de `shared/mock-data`
- Bloqueia: FE-PUB-027 (e2e T07)

**Approach (execution path):**
1. Criar `libs/pub/feature-export/src/lib/export.routes.ts` com rota T07.
2. Copiar/promover ExportacaoEValidacaoComponent do protótipo para
   `libs/pub/feature-export/src/lib/exportacao-e-validacao/`.
3. Remover: `setInterval`, "Simular estado" dropdown, `AVISOS_MOCK`, imports de mock-data.
4. Injetar `ExportFacade`; ler signals `phase`, `publicacao`, `summary`, `avisos`, `podeBaixar`, `verdict`.
5. On entry: detectar se vem de COMP (requestExport) ou re-entry (resumeExport) via query param / history state.
6. Wiring de outputs: `adjustLayout()` navega COMP; `baixar()` navega T08.
7. Re-exportar via `libs/pub/feature-export/src/index.ts`.

**Non-goals:**
- Não implementa os sub-componentes presentacionais (FE-PUB-013..017).
- Não implementa ExportFacade (FE-PUB-009).

**Layer(s):**
frontend / libs/pub/feature-export

**Bounded context:**
pub

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§1)
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-01-route-map.md` (§1, §2)
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-04-data-access.md` (§2)

**Architecture alignment:**
- Tag Nx: `scope:pub`, `type:feature`
- Standalone + OnPush; signals via ExportFacade
- Nenhum mock residual (setInterval, "Simular estado", AVISOS_MOCK)

**Implementation checklist (by file):**

**Lib: libs/pub/feature-export**
- 🔲 `libs/pub/feature-export/src/lib/export.routes.ts`
- 🔲 `libs/pub/feature-export/src/lib/exportacao-e-validacao/exportacao-e-validacao.component.ts`
- 🔲 `libs/pub/feature-export/src/lib/exportacao-e-validacao/exportacao-e-validacao.component.html`
- 🔲 `libs/pub/feature-export/src/index.ts`

**Tests**
- 🔲 `nx test pub-feature-export` PASS (componente rende phase gerando com indicador indeterminado; sem AVISOS_MOCK; sem setInterval)
- 🔲 `nx lint pub-feature-export` PASS

**Milestone:**
Wave 3 / P3 Feature Libs

**Labels:**
type:feature
layer:frontend
scope:pub
priority:P3

**Acceptance criteria:**
- `npx nx test pub-feature-export` PASS
- `npx nx lint pub-feature-export` PASS
- `npx nx build pub-feature-export` PASS
- Nenhuma referência a `setInterval`, "Simular estado", `AVISOS_MOCK` ou `shared/mock-data`
- phase=gerando → indicador indeterminado (sem %)
- baixar() output → navigate to T08

**Dependencies:**
- FE-PUB-002 (routes), FE-PUB-009 (ExportFacade), FE-PUB-013..017 (sub-componentes)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Via ExportFacade: POST §4.1, GET §4.2

**Testing / Evidence required:**
- DOM: nenhum elemento com texto "Simular estado" ou "%" junto ao progress
- Componente renderiza StepBarComponent com activeIndex=3

**Risks / Notes:**
- Distinguir "entrada de COMP" de "re-entrada" pode usar ActivatedRoute queryParams ou um serviço de handoff state — definir antes de implementar.
