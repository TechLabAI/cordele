## [FE-PROJ-025] Playwright e2e — download-e-historico.feature (T08, 15 cenários)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`apps/proj-e2e` contém a spec Playwright `download-e-historico.spec.ts` cobrindo os 15 cenários
de `e2e/download-e-historico.feature`. Inclui os fluxos de reopen pessimista, download por URL
assinada, guard `projProjetoGuard`, e degradação de publicações.

**Context / Problem statement:**
- `e2e/download-e-historico.feature` contém 15 cenários cobrindo: carregamento da tela T08,
  guard de UUID, estado not-found, forkJoin, reopen pessimista (200→navega, 409→toast), download
  de linha com URL assinada, canReopen gating, reopenPending disabling, degradação de publicações.
- Esta feature tem cenários de fluxo de escrita (reopen) que exigem mock de `POST .../reopen`.

**Approach (execution path):**
1. Criar `apps/proj-e2e/src/download-e-historico.spec.ts`:
   - Page Object `HistoryPage` com seletores: `adjustMetadataButton`, `adjustLayoutButton`,
     `newExportButton`, `backButton`, `rows`, `row(n).downloadButton`, `row(n).statusLabel`,
     `row(n).currentChip`, `errorState`, `notFoundBanner`.
   - Cenários de happy path: T08 carrega header + lista de publicações.
   - Cenários de reopen: clique "Ajustar metadados" → POST mock → 200 → URL muda para COMP.
   - Cenário de 409 defensivo: POST mock → 409 → toast visível, URL não muda, CTAs reabilitados.
   - Cenário de guard: UUID malformado na URL → redirect para biblioteca.
   - Cenário de download: clique "Baixar" → popup aberto com URL assinada.
   - Cenário de degradação: publicações vazias + degraded=true → notice visível.
2. Usar MSW para mocks de `GET /api/proj/projetos/{id}`, `listPublicacoes`, `POST .../reopen`,
   `GET .../download`.

**Non-goals:**
- Não cobre cenários da biblioteca T02 (FE-PROJ-024).
- Não cobre os 15 cenários "órfãos" como specs Playwright (documentados em FE-PROJ-026).

**Layer(s):**
frontend / apps/proj-e2e

**Bounded context:**
proj

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/e2e/download-e-historico.feature`
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-08-e2e-scenarios.md`

**Architecture alignment:**
- Tag Nx: `scope:proj`, `type:e2e`
- Page Objects; Playwright `waitForResponse` para o POST reopen

**Implementation checklist (by file):**

**App: apps/proj-e2e**
- 🔲 `apps/proj-e2e/src/page-objects/history.page.ts`
- 🔲 `apps/proj-e2e/src/download-e-historico.spec.ts` (15 cenários)
- 🔲 `apps/proj-e2e/src/fixtures/history-responses.ts` (MSW handlers ou JSON fixtures)

**Tests**
- 🔲 `nx e2e proj-e2e --spec=download-e-historico` PASS (todos os 15 cenários)

**Milestone:**
Wave 8 / P8 e2e

**Labels:**
type:e2e
layer:frontend
scope:proj
priority:P8

**Acceptance criteria:**
- `npx nx e2e proj-e2e --spec=download-e-historico` PASS
- 15 testes passam sem flaky (CI executa 2×)
- Cenário reopen pessimista: `Router.navigate` chamado SOMENTE após a resposta 200 do POST

**Dependencies:**
- FE-PROJ-014 (DownloadEHistoricoComponent)
- FE-PROJ-015 (PublicationHistoryListComponent)
- FE-PROJ-016 (download handler)
- FE-PROJ-017 (projProjetoGuard)
- FE-PROJ-021 (degradação)

**Data impact:**
- Nenhum (e2e usa MSW / fixtures)

**API / Contract impact:**
- Mock de `GET /api/proj/projetos/{id}`, `GET .../publicacoes`, `POST .../reopen`, `GET .../download`

**Testing / Evidence required:**
- CI green em 2 runs consecutivos
- Gravação de sessão Playwright (trace) para cenário de reopen

**Risks / Notes:**
- O cenário de reopen pesimista é sensível à ordem: `waitForResponse` deve capturar o POST antes
  de verificar a URL. Usar `page.route` para interceptar e simular delay controlado.
- UUID malformado no guard: navegar para `/projetos/not-a-uuid/historico` e verificar redirect.
