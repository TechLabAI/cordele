## [FE-COMP-021] Promote cleanup T06 — remover toolbar estrutural e render tipo=em-branco

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
O componente `EditorDeLayoutPreviewComponent` (T06) promovido do protótipo BA não contém os
3 botões estruturais (`adicionarPagina`, `inserirImagem`, `removerPagina`) nem renderiza
páginas de `tipo='em-branco'`. A única acção de página é o alinhamento de imagem.
`structuralEdits=false` é a invariante permanente do MVP.

**Context / Problem statement:**
- SPEC-05 §5, api-contract §0 D-H: os 3 botões estruturais do protótipo são **removidos no Promote**.
- O BE rejeita `tipo=em-branco` com `422 structural-edit-deferred`; o FE nunca os envia (defensive symmetry).
- A remoção deve ser cirúrgica: apagar os 3 botões da toolbar, remover qualquer `@if tipo='em-branco'`
  no canvas, e verificar que `PreviewCanvasComponent` não renderiza esse tipo.
- Bloqueia: FE-COMP-016 (canvas não deve lidar com `em-branco`)

**Approach (execution path):**
1. Em `EditorDeLayoutPreviewComponent`: identificar e remover os elementos HTML/Angular dos
   3 botões estruturais.
2. Remover qualquer handler `adicionarPagina()`, `inserirImagem()`, `removerPagina()` do
   componente smart.
3. Em `PreviewCanvasComponent` (FE-COMP-016): garantir que `@switch page.tipo` não tem
   `case 'em-branco'` (ou, se presente no switch, redirecionar para um placeholder oculto).
4. Adicionar comentário `// D-H: structural edits deferred; toolbar removed at Promote` nos
   locais de remoção para rastreabilidade.
5. Teste: verificar que nenhum botão estrutural está presente no DOM de T06.

**Non-goals:**
- Não remove a toolbar de alinhamento (única que permanece).
- Não afeta T05 (ConfiguracoesComponent não tem toolbar estrutural).

**Layer(s):**
frontend / libs/comp/feature-layout · libs/comp/ui

**Bounded context:**
comp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-05-tool-contract.md` (§5)
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-07-error-handling.md` (§1 structural-edit-deferred)

**Architecture alignment:**
- D-H: `structuralEdits=false` é permanente no MVP
- Nenhum payload de PUT deve conter `tipo=em-branco`

**Implementation checklist (by file):**

**Lib: libs/comp/feature-layout**
- 🔲 `editor-de-layout-preview.component.ts` — remover handlers e botões estruturais
- 🔲 `editor-de-layout-preview.component.html` — remover os 3 botões do template

**Lib: libs/comp/ui**
- 🔲 `preview-canvas.component.ts` — garantir que `tipo='em-branco'` não é renderizado

**Tests**
- 🔲 `nx test comp-feature-layout` PASS — sem elementos de add/insert/remove page no DOM
- 🔲 `nx lint comp-feature-layout` PASS

**Milestone:**
Wave 5 / P5 Promote cleanup (D-493)

**Labels:**
type:feature
layer:frontend
scope:comp
priority:P5

**Acceptance criteria:**
- `npx nx test comp-feature-layout` PASS
- DOM de T06 não contém botões `adicionarPagina`, `inserirImagem`, `removerPagina`
- `PreviewCanvasComponent` não renderiza `tipo='em-branco'`
- Nenhum payload de PUT contém `tipo=em-branco` (teste de Facade — FE-COMP-009)

**Dependencies:**
- FE-COMP-014 (EditorDeLayoutPreviewComponent promovido), FE-COMP-016 (PreviewCanvas)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Garante que `tipo=em-branco` nunca é enviado (simetria defensiva com BE §0 D-H)

**Testing / Evidence required:**
- Teste de DOM: queries por `[data-testid=add-page]`, `[data-testid=insert-image]`, `[data-testid=remove-page]` → inexistentes

**Risks / Notes:**
- Se o protótipo usar nomes de evento diferentes (ex.: `addPage`, `insertImage`), adaptar a busca antes de remover.
