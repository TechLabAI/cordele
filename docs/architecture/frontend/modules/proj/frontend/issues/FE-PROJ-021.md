## [FE-PROJ-021] Degradação parcial — degraded:true rendering, nunca vira error state

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
Quando `degraded:true` chega na resposta, as duas telas PROJ mantêm o conteúdo disponível
(identidade + status do projeto) e marcam os campos indisponíveis com "temporariamente indisponível".
Nenhum campo degradado dispara o `status=error` da facade.

**Context / Problem statement:**
- SPEC-07 §2 define que `degraded:true` NÃO é um erro — é degradação parcial dos ports cross-context.
- `LibraryFacade.degraded()` e `HistoryFacade.degraded()` são sinais que indicam degradação.
- Campos afetados (biblioteca): `autor`, `totalCapitulos`, `totalImagens`, `ultimoEpubcheckStatus`.
- Campos afetados (histórico): lista de publicações vazia com `degraded:true`.
- Regra visual: campo null + `degraded=true` → marcador inline "temporariamente indisponível"
  (não "-" ou "N/A" genérico).
- `autor: null` sem `degraded` → campo ainda não preenchido (caso normal de rascunho);
  `autor: null` com `degraded` → marcador de degradação.

**Approach (execution path):**
1. Em `ProjectCardComponent`:
   - `@if card.autor !== null` → exibe autor; `@else if degraded` → "temporariamente indisponível";
     `@else` → omitir (rascunho sem autor ainda).
   - Mesma lógica para `totalCapitulos`, `totalImagens`.
   - Badge com `degraded` e `ultimoEpubcheckStatus===null` → `pending` tone.
2. Em `PublicationHistoryListComponent`:
   - `@if items.length === 0 && degraded` → notice "Histórico temporariamente indisponível".
3. Em `BibliotecaDeProjetosComponent`:
   - Exibir banner sutil de degradação quando `LibraryFacade.degraded() === true`.
4. Testes: verificar que `degraded=true` com campos null NÃO muda `status()` para `error`.

**Non-goals:**
- Não implementa o marcador de campo nos testes de schematics (responsabilidade de `@cordele/shared/ui-feedback`).
- Não implementa a lógica de degradação nas facades (FE-PROJ-009, FE-PROJ-010).

**Layer(s):**
frontend / libs/proj/ui + libs/proj/feature-library + libs/proj/feature-history

**Bounded context:**
proj

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-07-error-handling.md` (§2)
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-03-view-models.md` (§1 — degraded rules)

**Architecture alignment:**
- Tag Nx: `scope:proj`, `type:feature`
- Distinguir `null` (não preenchido) de `null + degraded` nos templates com signal composto

**Implementation checklist (by file):**

**Lib: libs/proj/ui**
- 🔲 `ProjectCardComponent` — marcador condicional por campo degradado
- 🔲 `PublicationHistoryListComponent` — notice quando `degraded && items=[]`

**Lib: libs/proj/feature-library**
- 🔲 `BibliotecaDeProjetosComponent` — banner sutil de degradação

**Lib: libs/proj/feature-history**
- 🔲 `DownloadEHistoricoComponent` — notice de degradação no histórico de publicações

**Tests**
- 🔲 `nx test proj-ui` PASS — `autor=null + degraded=true` → marcador "temporariamente indisponível"
- 🔲 `nx test proj-ui` PASS — `autor=null + degraded=false` → sem marcador (campo omitido)
- 🔲 `nx test proj-feature-history` PASS — `publications=[] + degraded=true` → notice de indisponibilidade
- 🔲 `nx test proj-feature-library` PASS — `degraded=true` não altera `status()` (ainda `ready`)
- 🔲 `nx lint proj-ui` PASS

**Milestone:**
Wave 5 / P5 UX Polish

**Labels:**
type:feature
layer:frontend
scope:proj
priority:P5

**Acceptance criteria:**
- `npx nx test proj-ui` PASS
- `npx nx test proj-feature-library` PASS
- `npx nx test proj-feature-history` PASS
- `degraded:true` nunca converte `status` para `error` em nenhuma das facades
- Campos degradados exibem marcador específico, não string genérica "-" ou "N/A"

**Dependencies:**
- FE-PROJ-009 (LibraryFacade.degraded signal)
- FE-PROJ-010 (HistoryFacade.degraded signal)
- FE-PROJ-013 (ProjectCardComponent)
- FE-PROJ-015 (PublicationHistoryListComponent)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Consome campo `degraded: boolean` de api-contract §4.2/§4.3

**Testing / Evidence required:**
- Screenshot da biblioteca com campo autor e counters degradados

**Risks / Notes:**
- A distinção entre "campo ainda não preenchido (rascunho)" e "campo degradado" é sutil;
  documentar a regra nos comentários do template para evitar regressão futura.
