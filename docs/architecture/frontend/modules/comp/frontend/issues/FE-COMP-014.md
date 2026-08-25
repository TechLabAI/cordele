## [FE-COMP-014] feature-layout routes + EditorDeLayoutPreviewComponent (T06 — smart)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/comp/feature-layout` contém `layout.routes.ts` e `EditorDeLayoutPreviewComponent`
(promovido do protótipo BA). O componente smart consome `LayoutFacade` via signals, delega
para presentacionais, e não toca em `HttpClient`. Mock imports removidos. Toolbar estrutural
**não** aparece (removida em FE-COMP-021).

**Context / Problem statement:**
- SPEC-02 §2 define a árvore de componentes de T06 e os signals que o smart component lê.
- `prototype_source` = `apps/cordele-web/src/app/screens/editor-de-layout-preview/editor-de-layout-preview.component.ts`
  (D-493): promover, não recriar.
- Ao promover: remover `shared/mock-data`; substituir por `LayoutFacade` injetado.
- A remoção da toolbar estrutural (adicionarPagina/inserirImagem/removerPagina) e do render
  de `tipo='em-branco'` são feitas em FE-COMP-021 (issue separada).
- Bloqueia: FE-COMP-015, FE-COMP-016, FE-COMP-017 (sub-componentes)

**Approach (execution path):**
1. Criar `layout.routes.ts` com rota `/projetos/:projetoId/editor-de-layout-preview`
   (loadComponent → `EditorDeLayoutPreviewComponent`).
2. Promover `editor-de-layout-preview.component.ts` para `libs/comp/feature-layout`.
3. Remover imports `shared/mock-data`; injetar `LayoutFacade`.
4. Declarar signals lidos: `status()`, `layout()`, `preview()`, `canExport()`, `saving()`.
5. Eventos delegados: `onStyleChange`, `onAlignmentChange`, `onPrevPage`, `onNextPage`,
   `onExport`, `onRetryPreview`.
6. `standalone: true`, `changeDetection: OnPush`.

**Non-goals:**
- Não implementa os sub-componentes (FE-COMP-015..FE-COMP-018).
- Não remove a toolbar estrutural nesta issue (FE-COMP-021).
- Não implementa tokens de design (FE-COMP-022).

**Layer(s):**
frontend / libs/comp/feature-layout

**Bounded context:**
comp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§2)
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-01-route-map.md` (§1)
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/generator-config.yml` (features[1])

**Architecture alignment:**
- Tag Nx: `scope:comp`, `type:feature`
- standalone + OnPush; selector `app-comp-editor-de-layout-preview`

**Implementation checklist (by file):**

**Lib: libs/comp/feature-layout**
- 🔲 `libs/comp/feature-layout/src/lib/layout.routes.ts`
- 🔲 `libs/comp/feature-layout/src/lib/editor-de-layout-preview/editor-de-layout-preview.component.ts`
- 🔲 `libs/comp/feature-layout/src/index.ts`
- 🔲 `libs/comp/feature-layout/project.json` (tags scope:comp, type:feature)

**Tests**
- 🔲 `nx test comp-feature-layout` PASS (renderização com LayoutFacade stub)
- 🔲 `nx lint comp-feature-layout` PASS

**Milestone:**
Wave 3 / P3 Feature libs

**Labels:**
type:feature
layer:frontend
scope:comp
priority:P3

**Acceptance criteria:**
- `npx nx test comp-feature-layout` PASS
- `npx nx lint comp-feature-layout` PASS
- Nenhum import de `shared/mock-data`
- Componente lê signals de `LayoutFacade` sem injetar `HttpClient`

**Dependencies:**
- FE-COMP-009 (LayoutFacade), FE-COMP-002 (rotas), FE-COMP-019, FE-COMP-020 (guards)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Indireto via LayoutFacade

**Testing / Evidence required:**
- Teste de renderização: status='empty' → empty state; status='ready' → canvas + painel

**Risks / Notes:**
- A toolbar estrutural existente no protótipo será removida em FE-COMP-021; esta issue pode deixar a toolbar presente temporariamente desde que seja documentada como pending de FE-COMP-021.
