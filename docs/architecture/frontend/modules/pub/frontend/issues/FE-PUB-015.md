## [FE-PUB-015] EpubSummaryGridComponent + KpiTileComponent — null-safe; tile omitido quando sem fonte

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/pub/ui` contém `EpubSummaryGridComponent` (grid de 4 KpiTiles: Tamanho/Páginas/Capítulos/Imagens)
e `KpiTileComponent` (tile genérico). Quando o campo de fonte for `null` (gap de contrato M4 — campos
Tamanho/Páginas/Capítulos/Imagens não estão no api-contract §6), o tile é **omitido**, nunca exibido
com dado fabricado.

**Context / Problem statement:**
- SPEC-03 §3: `EpubSummaryVM` — todos os campos são `| null`. Tile null → omitido (EARS pub-kpi-omit-missing).
- `contracts/backend-api-cross-link.md §6` GAP 2: ePub summary KPIs (tamanho/páginas/capítulos/imagens)
  sem campo-fonte no api-contract §6 ratificado → cada tile omitido quando unsupplied, nunca fabricado.
- O protótipo hardcodava KPIs ("1,4 MB", "124 pgs", etc.) — esses valores DEVEM ser removidos.
- KpiTileComponent é também usado por PublicationKpiRowComponent (T08, FE-PUB-019).

**Approach (execution path):**
1. Criar `libs/pub/ui/src/lib/kpi-tile/kpi-tile.component.ts`:
   - `standalone: true`, `OnPush`
   - `input()`: label: string, value: string | number | null
   - `@if (value !== null)`: renderiza tile; senão não renderiza nada
2. Criar `libs/pub/ui/src/lib/epub-summary-grid/epub-summary-grid.component.ts`:
   - `standalone: true`, `OnPush`
   - `input()`: summary: EpubSummaryVM | null
   - Monta 4 KpiTileComponent com label/value; null → tile oculto automaticamente
3. Re-exportar via index.ts.

**Non-goals:**
- Não preenche valores de KPI ausentes com defaults ou placeholders (gap de produto — aguarda M4).

**Layer(s):**
frontend / libs/pub/ui

**Bounded context:**
pub

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§1 EpubSummaryGridComponent, KpiTileComponent)
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-03-view-models.md` (§3)
- `docs/architecture/frontend/modules/pub/frontend/contracts/backend-api-cross-link.md` (§6 GAP 2)

**Architecture alignment:**
- Tag Nx: `scope:pub`, `type:ui`
- Standalone + OnPush; null-safety explícita

**Implementation checklist (by file):**

**Lib: libs/pub/ui**
- 🔲 `libs/pub/ui/src/lib/kpi-tile/kpi-tile.component.ts`
- 🔲 `libs/pub/ui/src/lib/kpi-tile/kpi-tile.component.html`
- 🔲 `libs/pub/ui/src/lib/epub-summary-grid/epub-summary-grid.component.ts`
- 🔲 `libs/pub/ui/src/lib/epub-summary-grid/epub-summary-grid.component.html`
- 🔲 `libs/pub/ui/src/index.ts` (re-exports)

**Tests**
- 🔲 `nx test pub-ui` PASS (summary={tamanho:null,...} → zero tiles renderizados; summary={tamanho:'1,4 MB',...} → tile visível)
- 🔲 `nx lint pub-ui` PASS

**Milestone:**
Wave 3 / P3 Feature Libs

**Labels:**
type:feature
layer:frontend
scope:pub
priority:P3

**Acceptance criteria:**
- `npx nx test pub-ui` PASS
- KpiTileComponent com value=null: DOM não renderiza tile
- EpubSummaryGridComponent com summary=null: nenhum tile visível
- Nenhum valor hardcoded de KB/MB/páginas/capítulos

**Dependencies:**
- FE-PUB-012 (usa em T07), FE-PUB-019 (usa em T08 via PublicationKpiRowComponent)
- INT-FE-PUB-005 (gap de produto documentado)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Depende de campo-fonte futuro do api-contract (M4 gap)

**Testing / Evidence required:**
- DOM snapshot: tiles condicionais corretos

**Risks / Notes:**
- INT-FE-PUB-005 documenta a dependência de produto pendente. Não implementar tile com valor "N/D" ou "--".
