## [FE-PROJ-024] Playwright e2e — biblioteca-de-projetos.feature (T02, 14 cenários)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`apps/proj-e2e` contém a spec Playwright `biblioteca-de-projetos.spec.ts` cobrindo os 14 cenários
de `e2e/biblioteca-de-projetos.feature`. Todos os cenários passam com MSW ou servidor de dev real.

**Context / Problem statement:**
- `e2e/biblioteca-de-projetos.feature` contém 14 cenários (contagem da feature oficial — cenários
  de sessão, empresa, permissão, re-fetch, empresa-switch, loading, badge, empty state, quick-download,
  card "Abrir" stage-aware, degradação, etc.).
- Os 15 cenários "órfãos" (comportamento defensivo extra além do EARS) são documentados em FE-PROJ-026
  (issue informacional) e NÃO precisam de spec Playwright dedicada — estão cobertos pelos testes
  unitários das facades.
- A spec usa Page Objects para as duas telas.

**Approach (execution path):**
1. Criar `apps/proj-e2e/src/biblioteca-de-projetos.spec.ts`:
   - Page Object `LibraryPage` com seletores: `newProjectButton`, `cards`, `card(n).openButton`,
     `card(n).quickDownloadButton`, `card(n).badge`, `emptyState`, `errorState`, `retryButton`.
   - Implementar step-by-step para cada cenário da feature usando Playwright `expect` e `page.goto`.
   - Usar MSW (ou fixtures) para simular respostas de `GET /api/proj/projetos`.
2. Cenários obrigatórios a cobrir:
   - Login → aterrissa em `/biblioteca-de-projetos`
   - Shell registra "Projetos" no nav
   - Re-fetch a cada entrada
   - Troca de empresa → cancel + re-fetch
   - Card com `rascunho` → "Abrir" navega para IMP
   - Card com `publicado|com_erros` → "Abrir" navega para `/projetos/:id/historico`
   - Badge derivado de `epubcheckStatus`
   - Quick-download → URL assinada → `window.open`
   - Estado `empty` com CTA para IMP
   - Estado `loading` com skeletons
   - Estado `error` com retry
   - Degradação parcial: campos null com marcador

**Non-goals:**
- Não cobre cenários da feature `download-e-historico` (FE-PROJ-025).
- Não implementa os cenários "órfãos" como specs Playwright (documentados em FE-PROJ-026).

**Layer(s):**
frontend / apps/proj-e2e

**Bounded context:**
proj

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/e2e/biblioteca-de-projetos.feature`
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-08-e2e-scenarios.md`

**Architecture alignment:**
- Tag Nx: `scope:proj`, `type:e2e`
- Playwright + Page Objects; sem acoplamento direto aos componentes Angular

**Implementation checklist (by file):**

**App: apps/proj-e2e**
- 🔲 `apps/proj-e2e/src/page-objects/library.page.ts`
- 🔲 `apps/proj-e2e/src/biblioteca-de-projetos.spec.ts` (14 cenários)
- 🔲 `apps/proj-e2e/src/fixtures/library-responses.ts` (MSW handlers ou JSON fixtures)

**Tests**
- 🔲 `nx e2e proj-e2e --spec=biblioteca-de-projetos` PASS (todos os 14 cenários)

**Milestone:**
Wave 8 / P8 e2e

**Labels:**
type:e2e
layer:frontend
scope:proj
priority:P8

**Acceptance criteria:**
- `npx nx e2e proj-e2e --spec=biblioteca-de-projetos` PASS
- 14 testes passam sem flaky (CI executa 2×)
- Nenhum hard-wait (`page.waitForTimeout`) no código de e2e

**Dependencies:**
- FE-PROJ-012 (BibliotecaDeProjetosComponent)
- FE-PROJ-013 (ProjectCardComponent, StatusBadgeComponent)
- FE-PROJ-016 (download handler)
- FE-PROJ-021 (degradação)

**Data impact:**
- Nenhum (e2e usa MSW / fixtures, não BE real)

**API / Contract impact:**
- Mock de `GET /api/proj/projetos` e `GET .../download`

**Testing / Evidence required:**
- CI green em 2 runs consecutivos

**Risks / Notes:**
- Se `apps/proj-e2e` ainda não existir no Nx workspace, registrar via `fe-nx-register-module.py`
  (D-487) antes de iniciar a spec.
- Quick-download usa `window.open`; no Playwright usar `page.waitForEvent('popup')` para verificar
  que a nova aba é aberta com a URL assinada.
