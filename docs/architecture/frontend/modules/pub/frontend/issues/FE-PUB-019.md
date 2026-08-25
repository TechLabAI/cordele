## [FE-PUB-019] ProjectPublicationHeaderComponent + PublicationKpiRowComponent (T08 header + stats KPIs)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/pub/ui` contém `ProjectPublicationHeaderComponent` (cabeçalho T08 com nome do projeto,
chip de status, "Ajustar metadados/layout" e "+ Nova exportação") e `PublicationKpiRowComponent`
(linha de 4 KPI tiles de stats: Total/Publicadas/Com avisos/Com erros) alimentados por
`PublicationStats` do api-contract §6.3.

**Context / Problem statement:**
- SPEC-02 §2: ProjectPublicationHeaderComponent inputs (nomeProjeto, statusChip, autor, editora);
  outputs adjustMetadata e newExport.
- PublicationKpiRowComponent usa KpiTileComponent (FE-PUB-015) com dados de PublicationStats §6.3.
- "Ajustar metadados / layout": dispara adjustMetadata() → PROJ reopen → COMP.
- "+ Nova exportação": dispara newExport() → navega T07.
- Stats: Total/Publicadas/Com avisos/Com erros — dados ao vivo do endpoint §4.5 (não hardcoded).

**Approach (execution path):**
1. Criar `libs/pub/ui/src/lib/project-publication-header/project-publication-header.component.ts`:
   - `standalone: true`, `OnPush`
   - `input()`: nomeProjeto, statusChip, autor, editora
   - `output()`: adjustMetadata: OutputEmitterRef, newExport: OutputEmitterRef
2. Criar `libs/pub/ui/src/lib/publication-kpi-row/publication-kpi-row.component.ts`:
   - `standalone: true`, `OnPush`
   - `input()`: stats: PublicationStats | null
   - Renderiza 4 KpiTileComponent com campos de stats; null → loading/empty state
3. Re-exportar via index.ts.

**Non-goals:**
- Não implementa a lista de histórico (FE-PUB-020).
- Não computa stats (lê de HistoryFacade via DownloadEHistoricoComponent).

**Layer(s):**
frontend / libs/pub/ui

**Bounded context:**
pub

**Service execution spec(s):**
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§2)
- `docs/architecture/frontend/modules/pub/frontend/frontend-spec/SPEC-03-view-models.md` (§4)

**Architecture alignment:**
- Tag Nx: `scope:pub`, `type:ui`
- Standalone + OnPush; sem HttpClient

**Implementation checklist (by file):**

**Lib: libs/pub/ui**
- 🔲 `libs/pub/ui/src/lib/project-publication-header/project-publication-header.component.ts`
- 🔲 `libs/pub/ui/src/lib/project-publication-header/project-publication-header.component.html`
- 🔲 `libs/pub/ui/src/lib/publication-kpi-row/publication-kpi-row.component.ts`
- 🔲 `libs/pub/ui/src/lib/publication-kpi-row/publication-kpi-row.component.html`
- 🔲 `libs/pub/ui/src/index.ts` (re-exports)

**Tests**
- 🔲 `nx test pub-ui` PASS (newExport output emitido; stats=null → tiles ocultos)
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
- newExport output emitido no click de "+ Nova exportação"
- stats=null: nenhum tile KPI com dado fabricado
- stats preenchido: 4 tiles visíveis

**Dependencies:**
- FE-PUB-015 (KpiTileComponent), FE-PUB-018 (DownloadEHistoricoComponent usa este componente)

**Data impact:**
- Nenhum

**API / Contract impact:**
- PublicationStats §6.3 (via HistoryFacade)

**Testing / Evidence required:**
- DOM: chip de status correto; botões de ação presentes

**Risks / Notes:**
- "Nova exportação" deve verificar flag `pub.rexport`; a verificação é no smart component (FE-PUB-018), não aqui.
