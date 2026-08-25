## [FE-COMP-016] PreviewCanvasComponent + PagePaginatorComponent — canvas página-a-página

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/comp/ui` contém `PreviewCanvasComponent` (renderiza uma página de cada vez sem rede)
e `PagePaginatorComponent` (prev/next). O canvas recebe `page: PreviewPageVM` e
`layout: LayoutParamsVM`; mudança de página não emite nenhuma requisição HTTP. A surface de
preview usa tokens `--paper-*` (implementado em FE-COMP-022).

**Context / Problem statement:**
- SPEC-02 §2: `PreviewCanvasComponent` renderiza uma página; `PagePaginatorComponent`
  controla `index` via outputs `prev()` / `next()`.
- SPEC-03 §2: `preview.current` drive o canvas; mudar página é local (sem rede).
- O canvas tem a surface clara "papel" independente do tema escuro do app
  (ADR-COMP-001; tokens `--paper-*` de FE-COMP-022).
- `@if page.tipo='imagem'` → `ImageAlignmentBadgeComponent` (FE-COMP-017) aparece no canvas.

**Approach (execution path):**
1. Criar `PreviewCanvasComponent` em `libs/comp/ui`:
   - inputs: `page: PreviewPageVM`, `layout: LayoutParamsVM`; output: `alignmentChange(referenciaNo, alinhamento)`.
   - Renderiza `@switch page.tipo` (capitulo/paragrafo/imagem).
   - `@if tipo='imagem'` → inclui `ImageAlignmentBadgeComponent` (FE-COMP-017, placeholder até essa issue).
2. Criar `PagePaginatorComponent`:
   - inputs: `index: number`, `total: number`; outputs: `prev()`, `next()`.
   - Botões desabilitados nos limites (index=0 / index=total-1).

**Non-goals:**
- Não renderiza o livro completo (sempre uma página — SPEC-03 §2).
- Não faz chamadas de rede ao mudar página.
- Não implementa `ImageAlignmentBadgeComponent` (FE-COMP-017).

**Layer(s):**
frontend / libs/comp/ui

**Bounded context:**
comp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§2 PreviewCanvasComponent, PagePaginatorComponent)
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-03-view-models.md` (§2 PreviewPageVM)

**Architecture alignment:**
- Tag Nx: `scope:comp`, `type:ui`
- standalone + OnPush; sem lógica de rede
- Surface "papel": usa variável CSS `--paper-bg`, `--paper-text` (tokens FE-COMP-022)

**Implementation checklist (by file):**

**Lib: libs/comp/ui**
- 🔲 `libs/comp/ui/src/lib/preview-canvas/preview-canvas.component.ts`
- 🔲 `libs/comp/ui/src/lib/preview-canvas/preview-canvas.component.html`
- 🔲 `libs/comp/ui/src/lib/page-paginator/page-paginator.component.ts`

**Tests**
- 🔲 `nx test comp-ui` PASS
  - Canvas renderiza uma página por vez
  - Prev desabilitado em index=0; Next desabilitado em index=total-1
  - `alignmentChange` emitido apenas em páginas `tipo='imagem'`
- 🔲 `nx lint comp-ui` PASS

**Milestone:**
Wave 3 / P3 Feature libs

**Labels:**
type:feature
layer:frontend
scope:comp
priority:P3

**Acceptance criteria:**
- `npx nx test comp-ui` PASS
- `npx nx lint comp-ui` PASS
- Mudar página não emite HTTP
- Canvas exibe exatamente uma `PreviewPageVM` por vez

**Dependencies:**
- FE-COMP-014 (feature-layout usa o canvas), FE-COMP-022 (tokens --paper-*)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Teste: mudança de índice renderiza página correta sem XHR

**Risks / Notes:**
- A surface "papel" deve permanecer clara mesmo em app com dark theme; implementado via variáveis CSS `--paper-bg` (FE-COMP-022) — não hardcode oklch() aqui.
