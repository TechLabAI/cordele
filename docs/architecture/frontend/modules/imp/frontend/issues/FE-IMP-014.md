## [FE-IMP-014] Componentes presentacionais T04 — ManuscriptHeader, ParsingSummary, CounterTile

**Status:** ✅ COMPLETA (P4 validação 2026-08-31T17:50Z)
**GitHub:** [#TBD]

**Outcome:**
`libs/imp/feature-review/src/lib/components/` contém `ManuscriptHeaderComponent`,
`ParsingSummaryComponent` e `CounterTileComponent` (×3) — apresentando os contadores e header
de T04 a partir de inputs de `RevisaoDeEstruturaComponent`.

**Context / Problem statement:**
- SPEC-02 §2 define a árvore de T04. Estes três componentes cobrem a faixa superior da tela:
  nome do arquivo + contadores (totalCapitulos, totalImagens, trechosNaoParseados).
- Os contadores devem exibir exatamente os valores retornados pelo manuscrito response (SPEC-03 §3 +
  critério `imp-counters-match`).
- Em `status='loading'` estes componentes exibem skeleton states (SPEC-03 critério
  `imp-deeplink-single-get`).
- Bloqueia: FE-IMP-017 (RevisaoDeEstruturaComponent)

**Approach (execution path):**
1. Criar `ManuscriptHeaderComponent` (standalone OnPush):
   - `input() nomeArquivo: Signal<string>`, `input() formato: Signal<'docx'|'markdown'>`
   - Exibe nome do arquivo + ícone de formato; skeleton quando `nomeArquivo === null`.
2. Criar `CounterTileComponent` (standalone OnPush):
   - `input() label: Signal<string>`, `input() value: Signal<number>`,
     `input() tone: Signal<'neutral'|'warning'|'danger'>`
   - Exibe tile de contador; skeleton quando `value === null`.
3. Criar `ParsingSummaryComponent` (standalone OnPush):
   - `input() totalCapitulos, totalImagens, trechosNaoParseados: Signal<number | null>`
   - Renderiza três `CounterTileComponent` com labels pt-BR e tones adequados
     (`trechosNaoParseados > 0` → 'warning').

**Non-goals:**
- Não implementa `ChapterTocComponent` nem painel de pendências (FE-IMP-015).
- Não implementa `RevisaoDeEstruturaComponent` (FE-IMP-017).

**Layer(s):**
frontend / libs/imp/feature-review

**Bounded context:**
imp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§2)
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-03-view-models.md` (§2)

**Architecture alignment:**
- Standalone + OnPush + Signals
- Tag Nx: `scope:imp`, `type:feature`

**Implementation checklist (by file):**

**Lib: libs/imp/feature-review**
- 🔲 `libs/imp/feature-review/src/lib/components/manuscript-header/manuscript-header.component.ts`
- 🔲 `libs/imp/feature-review/src/lib/components/counter-tile/counter-tile.component.ts`
- 🔲 `libs/imp/feature-review/src/lib/components/parsing-summary/parsing-summary.component.ts`

**Tests**
- 🔲 `nx test imp-feature-review` PASS (ParsingSummary mostra 3 tiles; skeleton quando null)
- 🔲 `nx lint imp-feature-review` PASS

**Milestone:**
Wave 3 / P3 Feature Libs

**Labels:**
type:feature
layer:frontend
scope:imp
priority:P3

**Acceptance criteria:**
- `npx nx test imp-feature-review` PASS
- `npx nx lint imp-feature-review` PASS
- `npx nx build imp-feature-review` PASS
- `trechosNaoParseados > 0` renderiza CounterTile com `tone='warning'`
- Skeleton exibido quando `value === null`

**Dependencies:**
- (nenhuma — componentes presentacionais puros)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Screenshots: estado loading (skeletons), ready com contadores populados

**Risks / Notes:**
- `CounterTileComponent` pode ser promovido para `@cordele/shared/ui-feedback` se usado em outros
  módulos; por ora fica em `libs/imp/ui`.
