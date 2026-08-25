## [FE-COMP-017] ImageAlignmentBadgeComponent + ExportBarComponent — controlo de alinhamento e barra de export

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/comp/ui` contém `ImageAlignmentBadgeComponent` (controlo de alinhamento por imagem,
4 opções, flag-gated) e `ExportBarComponent` (botão "Exportar" com estado de loading,
gateado por `comp.edit`). Ambos são standalone + OnPush e não fazem rede.

**Context / Problem statement:**
- SPEC-02 §2: `ImageAlignmentBadgeComponent` (input: `alinhamento`, `stale: boolean`;
  output: `change(alinhamento)`) aparece no canvas somente em `tipo='imagem'` E com flag
  `comp.imageAlignment=on` E `comp.edit`.
- `ExportBarComponent` (input: `saving`, `canExport`; output: `export`): navega para PUB.
- SPEC-05 §3: `WHERE comp.imageAlignment is off → NOT render the per-image alignment control`.
- SPEC-05 §5 e SPEC-01 §2: "Exportar" = navegação, não mudança de status.

**Approach (execution path):**
1. Criar `ImageAlignmentBadgeComponent` em `libs/comp/ui`:
   - inputs: `alinhamento: Alinhamento`, `stale: boolean`, `canEdit: boolean`.
   - output: `change: EventEmitter<Alinhamento>`.
   - 4 botões: full | centralizado | junto-esquerda | junto-direita.
   - `@if stale` → mostra aviso sutil (override obsoleto).
   - Ocultado `@if !flagOn('comp.imageAlignment') || !canEdit`.
2. Criar `ExportBarComponent`:
   - inputs: `saving: boolean`, `canExport: boolean`; output: `export: EventEmitter<void>`.
   - Botão desabilitado quando `!canExport || saving`.

**Non-goals:**
- Não emite HTTP (responsabilidade da Facade).
- Não modifica o status do projeto (COMP nunca escreve status).

**Layer(s):**
frontend / libs/comp/ui

**Bounded context:**
comp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§2 ImageAlignmentBadgeComponent, ExportBarComponent)
- `docs/architecture/frontend/modules/comp/frontend/frontend-spec/SPEC-05-tool-contract.md` (§3, §5)

**Architecture alignment:**
- Tag Nx: `scope:comp`, `type:ui`
- standalone + OnPush; sem lógica de rede
- `Alinhamento` = union `'full' | 'centralizado' | 'junto-esquerda' | 'junto-direita'`

**Implementation checklist (by file):**

**Lib: libs/comp/ui**
- 🔲 `libs/comp/ui/src/lib/image-alignment-badge/image-alignment-badge.component.ts`
- 🔲 `libs/comp/ui/src/lib/export-bar/export-bar.component.ts`
- 🔲 `libs/comp/ui/src/index.ts` (re-exports atualizados)

**Tests**
- 🔲 `nx test comp-ui` PASS
  - `comp.imageAlignment=off` → ImageAlignmentBadge não renderiza
  - `stale=true` → aviso visível
  - ExportBar desabilitado quando `canExport=false`
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
- Badge não renderiza com `comp.imageAlignment=off`
- ExportBar desabilita botão corretamente

**Dependencies:**
- FE-COMP-016 (canvas que usa o badge), FE-COMP-014 (smart component que usa ExportBar)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Teste de DOM: 4 botões de alinhamento visíveis quando permitido; badge oculto com flag off

**Risks / Notes:**
- Override stale deve ser mostrado como aviso sutil (não erro); não bloqueia a ação do utilizador.
