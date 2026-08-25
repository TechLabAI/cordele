## [FE-PROJ-018] Permission affordance wiring — proj.download + proj.reopen toggling via AccessDecisionService

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
Todas as affordances de download e reopen do módulo PROJ são gateadas por `AccessDecisionService`
usando as permissões `proj.download` e `proj.reopen` (não roles diretamente). A feature flag
`proj.quickDownload` controla o botão de quick-download no card; `proj.reopen` controla os CTAs
de reopen no header T08.

**Context / Problem statement:**
- SPEC-05 §2 define a tabela de permissões e o rule: nenhum componente testa roles diretamente
  — todos passam pelo `AccessDecisionService`.
- `proj.download` gatea o botão "Baixar" (T08) e o quick-download (T02).
- `proj.reopen` gatea "Ajustar metadados" e "Ajustar layout" (T08).
- Feature flags (`proj.quickDownload`, `proj.reopen`): quando desligadas, escondem as affordances
  sem deploy (SPEC-05 §3).
- Este wiring é complementar ao flag check do `ProjectCardVM.canQuickDownload` e do `ProjectHeaderVM.canReopen`.

**Approach (execution path):**
1. Em `BibliotecaDeProjetosComponent`:
   - Injetar `AccessDecisionService`.
   - `canDownload = computed(() => ads.hasPermission('proj.download') && featureFlag('proj.quickDownload'))`.
   - Passar `canQuickDownload` para `ProjectCardComponent` via input somente se `canDownload`.
2. Em `DownloadEHistoricoComponent`:
   - `canReopen = computed(() => ads.hasPermission('proj.reopen') && featureFlag('proj.reopen') && header()?.canReopen)`.
   - Passar para `ProjectHeaderComponent` via input; CTAs invisíveis quando `false`.
3. Verificar que os testes de `BibliotecaDeProjetosComponent` e `DownloadEHistoricoComponent`
   mockam `AccessDecisionService` e cobrem os cenários permissão presente/ausente.

**Non-goals:**
- Não implementa o `AccessDecisionService` (responsabilidade de `@cordele/shared/access-decision`).
- Não implementa o `FeatureFlagService` (responsabilidade de `@cordele/shared`).

**Layer(s):**
frontend / libs/proj/feature-library + libs/proj/feature-history

**Bounded context:**
proj

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-05-tool-contract.md` (§2, §3)

**Architecture alignment:**
- Tag Nx: `scope:proj`, `type:feature`
- Signals: `computed(() => ads.hasPermission(...))` — reativo sem subscribe manual

**Implementation checklist (by file):**

**Lib: libs/proj/feature-library**
- 🔲 `BibliotecaDeProjetosComponent` — wiring `proj.download` + flag `proj.quickDownload`

**Lib: libs/proj/feature-history**
- 🔲 `DownloadEHistoricoComponent` — wiring `proj.reopen` + flag `proj.reopen`
- 🔲 `ProjectHeaderComponent` — input `canReopen: boolean`; CTAs com `@if canReopen`

**Tests**
- 🔲 `nx test proj-feature-library` PASS — sem `proj.download` → quick-download ausente
- 🔲 `nx test proj-feature-library` PASS — flag `proj.quickDownload=off` → quick-download ausente
- 🔲 `nx test proj-feature-history` PASS — sem `proj.reopen` → CTAs de reopen ausentes
- 🔲 `nx test proj-feature-history` PASS — flag `proj.reopen=off` → CTAs de reopen ausentes
- 🔲 `nx lint proj-feature-library` PASS
- 🔲 `nx lint proj-feature-history` PASS

**Milestone:**
Wave 4 / P4 Access Guards

**Labels:**
type:feature
layer:frontend
scope:proj
priority:P4

**Acceptance criteria:**
- `npx nx test proj-feature-library` PASS
- `npx nx test proj-feature-history` PASS
- Nenhum componente PROJ verifica roles diretamente (lint rule ou revisão manual)
- 4 cenários de visibilidade cobertos: permissão+flag on/off × 2 affordances

**Dependencies:**
- FE-PROJ-001 (PROJ_PERMISSION_MAP e PROJ_FEATURE_FLAGS)
- FE-PROJ-012 (BibliotecaDeProjetosComponent)
- FE-PROJ-014 (DownloadEHistoricoComponent)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Nenhum

**Testing / Evidence required:**
- Testes com mock de `AccessDecisionService.hasPermission` retornando `false`

**Risks / Notes:**
- Se `AccessDecisionService` ou `FeatureFlagService` ainda não existirem em `@cordele/shared`,
  criar interfaces locais e abrir PR para o time de plataforma. Não hardcodar permissões.
