## [FE-PROJ-014] Promote T08 → feature-history — DownloadEHistoricoComponent + ProjectHeaderComponent + reopen CTAs

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`libs/proj/feature-history` contém `DownloadEHistoricoComponent` (smart) promovida do protótipo BA,
conectada à `HistoryFacade`. Inclui `ProjectHeaderComponent` (pres) com os CTAs de reopen gateados
por `canReopen` + `reopenPending`. A rota é parametrizada por `:projetoId`.

**Context / Problem statement:**
- D-493: o componente existe em `frontend/design-reference/.../screens/download-e-historico/`.
- A rota do protótipo (`/download-e-historico`) é **substituída** por `/projetos/:projetoId/historico`.
- `DownloadEHistoricoComponent` (smart): lê `HistoryFacade.status()`, `header()`, `publications()`, `reopenPending()`.
  Emite: `onReopenMetadata()`, `onReopenLayout()`, `onNewExport()`, `onDownload(pub)`, `onBack()`.
- `ProjectHeaderComponent` (pres): `input(header: ProjectHeaderVM)`, outputs de ação.
  Os CTAs "Ajustar metadados" / "Ajustar layout" são renderizados **só** quando `header.canReopen === true`
  e a flag `proj.reopen` está on; ficam desabilitados quando `reopenPending()`.
- Bloqueia: FE-PROJ-015 (lista de publicações), FE-PROJ-025 (e2e T08)

**Approach (execution path):**
1. Copiar `download-e-historico.component.ts/.html` do protótipo para
   `libs/proj/feature-history/src/lib/download-e-historico/`.
2. Remover imports de mock; injetar `HistoryFacade` e `ActivatedRoute`.
3. Ler `:projetoId` do `ActivatedRoute.params` e chamar `HistoryFacade.load(projetoId)` no init.
4. Extrair `ProjectHeaderComponent` como standalone pres (input `header`, outputs de ação).
5. Aplicar `@if` condicional nos CTAs de reopen (`header.canReopen && !reopenPending()`).
6. Substituir `oklch()` por design tokens.
7. Atualizar `libs/proj/feature-history/src/index.ts`.

**Non-goals:**
- Não implementa a lista de publicações (FE-PROJ-015).
- Não implementa o download por URL assinada (FE-PROJ-016).
- Não implementa `projProjetoGuard` (FE-PROJ-017).

**Layer(s):**
frontend / libs/proj/feature-history

**Bounded context:**
proj

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-02-component-hierarchy.md` (§2)
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-03-view-models.md` (§2)

**Architecture alignment:**
- `standalone: true`, `changeDetection: OnPush`
- Tag Nx: `scope:proj`, `type:feature`
- `ActivatedRoute` para ler `:projetoId`; facade re-fetches no init do componente

**Implementation checklist (by file):**

**Lib: libs/proj/feature-history**
- 🔲 `libs/proj/feature-history/src/lib/download-e-historico/download-e-historico.component.ts`
- 🔲 `libs/proj/feature-history/src/lib/download-e-historico/download-e-historico.component.html`
- 🔲 `libs/proj/feature-history/src/lib/project-header/project-header.component.ts`
- 🔲 `libs/proj/feature-history/src/lib/feature-history.routes.ts`
- 🔲 `libs/proj/feature-history/src/index.ts`

**Tests**
- 🔲 `nx test proj-feature-history` PASS — `canReopen=false` → CTAs de reopen ausentes do DOM
- 🔲 `nx test proj-feature-history` PASS — `reopenPending=true` → CTAs desabilitados
- 🔲 `nx test proj-feature-history` PASS — `onBack()` navega para `/biblioteca-de-projetos`
- 🔲 `nx test proj-feature-history` PASS — `status=not-found` → banner "Projeto não encontrado"
- 🔲 `nx lint proj-feature-history` PASS

**Milestone:**
Wave 3 / P3 Feature Libraries

**Labels:**
type:feature
layer:frontend
scope:proj
priority:P3

**Acceptance criteria:**
- `npx nx test proj-feature-history` PASS
- `npx nx lint proj-feature-history` PASS
- `npx nx build proj-feature-history` PASS
- URL `/projetos/uuid/historico` resolve com `:projetoId` no param
- Nenhum import de mock no bundle de produção
- CTAs de reopen seguem as regras de visibilidade `canReopen + flag proj.reopen`

**Dependencies:**
- FE-PROJ-010 (HistoryFacade)
- FE-PROJ-013 (StatusBadgeComponent de libs/proj/ui — reutilizado no header)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Consome `GET .../projetos/{id}` e `GET .../projetos/{id}/publicacoes` via HistoryFacade

**Testing / Evidence required:**
- Screenshot dos CTAs "Ajustar metadados" / "Ajustar layout" (estado habilitado e desabilitado)
- Screenshot de `status=not-found`

**Risks / Notes:**
- Flag `proj.reopen`: se o `FeatureFlagService` ainda não existir em `@cordele/shared`, usar
  stub injetável; não hardcodar o booleano.
- O protótipo pode ter a rota hardcoded como `/download-e-historico`; remover qualquer navegação
  interna que use a rota plana.
