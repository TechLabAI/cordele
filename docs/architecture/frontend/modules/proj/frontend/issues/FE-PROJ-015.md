## [FE-PROJ-015] PublicationHistoryListComponent + PublicationHistoryRowComponent

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/proj/ui` expõe `PublicationHistoryListComponent` e `PublicationHistoryRowComponent`.
Cada linha exibe: status epubcheck, contadores de erros/avisos, data, chip "versão atual" (row[0]),
e botão "Baixar" **somente** quando `row.canDownload === true`.

**Context / Problem statement:**
- SPEC-02 §2 define `PublicationHistoryListComponent` (pres) e `PublicationHistoryRowComponent` (pres).
- `canDownload` deriva de `arquivoUrl != null` — o componente recebe o VM calculado pelo mapper;
  não recomputa a downloadabilidade a partir do `epubcheckStatus` string.
- A linha com `epubcheckStatus ∈ {erros_criticos, pendente}` não exibe botão Baixar — exibe
  marcador "inválido" / "pendente" (sem botão disabled — doc 02 §3).
- `isCurrent` (row[0]) ativa o chip "versão atual".
- Degraded: se `HistoryFacade.degraded()` é true e `publications=[]`, a lista mostra notice
  "temporariamente indisponível" (SPEC-07 §2).

**Approach (execution path):**
1. Criar `libs/proj/ui/src/lib/publication-history-list/publication-history-list.component.ts`:
   - `input(items: PublicacaoRowVM[])`, `input(degraded: boolean)`.
   - `output(download)` (com o `PublicacaoRowVM` como payload).
   - `@for item → PublicationHistoryRowComponent`.
   - `@if items.length === 0 && degraded` → notice de degradação.
2. Criar `libs/proj/ui/src/lib/publication-history-row/publication-history-row.component.ts`:
   - `input(row: PublicacaoRowVM)`.
   - `output(download)` (só quando `row.canDownload`).
   - Renderiza: `statusLabel`, `totalErros`, `totalAvisos`, `criadoEm`, chip `isCurrent`.
   - Botão "Baixar" com `@if row.canDownload`; marcador textual (`@else`) quando não pode baixar.
3. Expor via `libs/proj/ui/src/index.ts`.

**Non-goals:**
- Não implementa o download por URL assinada (FE-PROJ-016).
- Não implementa erros de download inline (FE-PROJ-021).

**Layer(s):**
frontend / libs/proj/ui

**Bounded context:**
proj

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§2)
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-03-view-models.md` (§2)

**Architecture alignment:**
- `standalone: true`, `changeDetection: OnPush`
- Tag Nx: `scope:proj`, `type:ui`
- Puramente presentacional

**Implementation checklist (by file):**

**Lib: libs/proj/ui**
- 🔲 `libs/proj/ui/src/lib/publication-history-list/publication-history-list.component.ts`
- 🔲 `libs/proj/ui/src/lib/publication-history-row/publication-history-row.component.ts`
- 🔲 `libs/proj/ui/src/index.ts` (re-exports)

**Tests**
- 🔲 `nx test proj-ui` PASS — `canDownload=false` → sem botão Baixar e sem botão disabled
- 🔲 `nx test proj-ui` PASS — `isCurrent=true` → chip "versão atual" presente
- 🔲 `nx test proj-ui` PASS — `degraded=true && items=[]` → notice "temporariamente indisponível"
- 🔲 `nx lint proj-ui` PASS

**Milestone:**
Wave 3 / P3 Feature Libraries

**Labels:**
type:feature
layer:frontend
scope:proj
priority:P3

**Acceptance criteria:**
- `npx nx test proj-ui` PASS
- `npx nx lint proj-ui` PASS
- Linha sem `canDownload` não renderiza botão Baixar (nem disabled) — doc 02 §3
- Notice de degradação aparece quando `degraded=true && items=[]`

**Dependencies:**
- FE-PROJ-008 (PublicacaoRowVM)
- FE-PROJ-014 (DownloadEHistoricoComponent usa estes componentes)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum (puramente presentacional)

**Testing / Evidence required:**
- Screenshot de linha com status `erros_criticos` (sem botão Baixar, com marcador "inválido")
- Screenshot do chip "versão atual" na primeira linha

**Risks / Notes:**
- `statusLabel` é computado no mapper (FE-PROJ-008); o componente apenas renderiza a string.
  Não duplicar a lógica de label no template.
