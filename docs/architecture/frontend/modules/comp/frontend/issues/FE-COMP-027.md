## [FE-COMP-027] Playwright e2e — editor-de-layout-preview.feature (T06)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`apps/comp-e2e/src/e2e/editor-de-layout-preview.spec.ts` (gerado de `.feature`) cobre os
9 grupos de cenários de T06 descritos em SPEC-08: hidratação lazy, bounds/heading order,
preview página-a-página, override obsoleto, edição local e write-back, exportar pessimista,
toolbar alignment-only, gating de permissão/flag, erros específicos (409/422).

**Context / Problem statement:**
- SPEC-08 §2 (editor-de-layout-preview.feature) define os 9 grupos de cenários.
- Slugs EARS a cobrir: `comp-layout-hydrate`, `comp-layout-defaults`, `comp-layout-bounds`,
  `comp-layout-refetch`, `comp-preview-paginate`, `comp-stale-override`, `comp-no-optimistic`,
  `comp-alignment-writeback`, `comp-export-persist`, `comp-export-persist-fail`,
  `comp-nav-export`, `comp-toolbar-alignment-only`, `comp-honoured-params-only`,
  `comp-flag-imagealignment`, `comp-perm-edit`, `comp-err-manuscript-missing`,
  `comp-err-override-ref`, `comp-err-structural-deferred`.
- Validar que "Exportar" navega para PUB **sem** mudar status.
- Validar que toolbar não tem botões estruturais.

**Approach (execution path):**
1. Implementar `editor-de-layout-preview.spec.ts` a partir do `.feature`.
2. Usar Page Object (LayoutEditorPage) com seletores para painel de estilos, canvas, paginador.
3. Mockar: `GET layout` com `materialized:false`, `GET preview-context` com `409`, override stale.
4. Testar: mudança de estilo local (sem XHR); export → PUT → navigate PUB.
5. Testar: DOM não contém add-page/remove-page/insert-image.

**Non-goals:**
- Não cobre T05 (FE-COMP-026).

**Layer(s):**
frontend / apps/comp-e2e

**Bounded context:**
comp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-08-e2e-scenarios.md` (§2)
- `docs/architecture/frontend/modules/comp/frontend/e2e/editor-de-layout-preview.feature`

**Architecture alignment:**
- Runner: Playwright
- Page Objects em `apps/comp-e2e/src/support/`

**Implementation checklist (by file):**

**App: apps/comp-e2e**
- 🔲 `apps/comp-e2e/src/e2e/editor-de-layout-preview.spec.ts`
- 🔲 `apps/comp-e2e/src/support/layout-editor.page.ts` (Page Object)

**Tests**
- 🔲 `nx e2e comp-e2e --grep editor-de-layout-preview` PASS
- 🔲 `nx lint comp-e2e` PASS

**Milestone:**
Wave 9 / P9 e2e + Hardening

**Labels:**
type:e2e
layer:frontend
scope:comp
priority:P9

**Acceptance criteria:**
- `npx nx e2e comp-e2e --grep editor-de-layout-preview` PASS
- Todos os slugs EARS de T06 cobertos
- DOM de T06 não contém botões estruturais (testado em e2e)
- "Exportar" navega para PUB sem mudar status (verificado via route intercept)

**Dependencies:**
- FE-COMP-014..FE-COMP-017 (features T06), FE-COMP-021 (toolbar removida), FE-COMP-022 (tokens)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Mocks via route intercept

**Testing / Evidence required:**
- `nx e2e comp-e2e --headed` para validação visual dos 9 grupos

**Risks / Notes:**
- Verificar que o PUT de export é interceptado e não chega a um servidor real nos testes (ambiente CI sem BE).
