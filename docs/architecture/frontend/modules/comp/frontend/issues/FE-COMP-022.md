## [FE-COMP-022] Design tokens — substituir oklch() inline por --paper-*, remover shared/mock-data

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
Todos os literais `oklch(...)` inline do COMP relacionados à surface "papel" do preview
são substituídos por variáveis CSS `--paper-bg`, `--paper-text`, `--paper-border` (e
similares) definidas em `libs/comp/styles/` ou `@cordele/shared/ui-theme`. Todos os imports
de `shared/mock-data` são removidos do COMP. O preview mantém a surface clara mesmo em
dark theme da app.

**Context / Problem statement:**
- SPEC-02 convencoes: literais `oklch(...)` / `style="..."` movem para design tokens no Promote.
- `contracts/design-tokens.md` especifica os tokens `--paper-*` para a surface clara do preview.
- `shared/mock-data` é fixture do protótipo; no Promote, os dados vêm das facades.
- A surface "papel" deve ser clara (`--paper-bg: #fff` ou equivalente) independentemente do
  dark theme (simula a página impressa — ADR-COMP-001).

**Approach (execution path):**
1. Criar `libs/comp/styles/src/lib/_paper-tokens.scss` (ou `.css`) com as variáveis
   `--paper-bg`, `--paper-text`, `--paper-border`, `--paper-shadow`.
2. Incluir no `theme.css` de `@cordele/shared/ui-theme` se o escopo é global; caso contrário,
   scope `:root .comp-preview-canvas { ... }`.
3. Pesquisar todos os componentes de COMP por `oklch(` / `style=` inline → substituir por tokens.
4. Pesquisar todos os arquivos de COMP por `shared/mock-data` → remover imports e fixtures.
5. Verificar que nenhum teste depende de mock-data importado (usar fixtures locais inline).

**Non-goals:**
- Não redesenha a UI (só substitui literais por tokens equivalentes).
- Não afeta tokens de outras superfícies (só paper/preview).

**Layer(s):**
frontend / libs/comp/styles · libs/comp/ui (e outros afetados)

**Bounded context:**
comp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (Convenções)
- `docs/architecture/frontend/modules/comp/frontend/contracts/design-tokens.md`

**Architecture alignment:**
- Tag Nx: `scope:comp`, `type:ui`
- Tokens definem a surface sem hardcoding de cor

**Implementation checklist (by file):**

**Lib: libs/comp/styles (ou @cordele/shared/ui-theme)**
- 🔲 `_paper-tokens.css` (ou `.scss`) com `--paper-bg`, `--paper-text`, `--paper-border`

**Componentes afetados (patch)**
- 🔲 `preview-canvas.component.*` — substituir oklch() por tokens
- 🔲 Outros componentes de libs/comp/ui com literais de cor inline

**Remoção de mock-data**
- 🔲 Todos os `import ... from 'shared/mock-data'` em libs/comp/** → removidos
- 🔲 Fixtures de test convertidas para dados inline

**Tests**
- 🔲 `nx build cordele-web` PASS (sem imports de mock-data)
- 🔲 `nx lint` PASS em todos os libs de comp

**Milestone:**
Wave 5 / P5 Promote cleanup (D-493)

**Labels:**
type:feature
layer:frontend
scope:comp
priority:P5

**Acceptance criteria:**
- `npx nx build cordele-web` PASS
- Nenhum `oklch(` literal inline nos componentes COMP
- Nenhum import de `shared/mock-data` em qualquer lib de comp
- Preview permanece com surface clara em dark theme da app

**Dependencies:**
- FE-COMP-011 (T05 promovido), FE-COMP-014 (T06 promovido), FE-COMP-016 (canvas)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- `grep -r 'oklch\|mock-data' libs/comp/` → zero resultados
- Screenshot do preview em dark mode da app → surface clara

**Risks / Notes:**
- Verificar `contracts/design-tokens.md` para os nomes exactos dos tokens antes de criar novos; evitar duplicação com tokens já existentes em `@cordele/shared/ui-theme`.
