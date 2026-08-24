## [FE-IMP-025] Playwright e2e — revisao-de-estrutura.feature (9 cenários)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`apps/imp-e2e/` contém os specs Playwright mapeados para todos os 9 cenários de
`e2e/revisao-de-estrutura.feature` passando no gate de CI.

**Context / Problem statement:**
- SPEC-08 §2 inventaria os 9 cenários de revisão de estrutura (T04).
- Cenários cobrem: hidratação direta do POST, contadores conferem, painel sempre visível, confirmar
  com pendências, zero capítulos modal, ignorar trecho (otimista), reimportar, deep-link GET único,
  isolamento por empresa.
- Importante: o cenário de "ignorar trecho" agora deve validar a chamada de API
  (addendum M4 — `POST .../segmentos/{id}/ignore`) e o rollback em caso de erro.

**Approach (execution path):**
1. Criar `apps/imp-e2e/src/revisao-de-estrutura.spec.ts` com Page Object `ReviewPage`:
   - `ReviewPage.waitForReady()` → aguarda `status='ready'`
   - `ReviewPage.getCounters()` → `{ capitulos, imagens, pendencias }`
   - `ReviewPage.ignoreFragment(index)` → clica em "Ignorar" no trecho N
   - `ReviewPage.confirm()` → clica "Confirmar estrutura"
   - `ReviewPage.acceptZeroChaptersModal()` → clica "Confirmar mesmo assim"
2. Mocks via `page.route()`:
   - GET `/api/imp/manuscripts/{id}` → stub `ManuscritoDetail`
   - GET `/api/imp/manuscripts/{id}/segmentos/ignored` → `{ ignoredSegmentoIds: [] }`
   - POST `/api/imp/manuscripts/{id}/segmentos/{segId}/ignore` → 201 `SegmentoCuradoriaDto`
   - POST `/api/imp/manuscripts/{id}/confirm-estrutura` → 200 `ConfirmEstruturaResultDto`
   - GET `/api/imp/manuscripts/{id}` (empresa errada) → 404
3. Cenário "rollback de ignore": mock POST ignore → 422 segmento-not-found → verificar que
   trecho retorna a `ignorado=false` no DOM.
4. Cenário "deep-link GET único": abrir URL diretamente → spy network: exatamente 1 GET, zero
   POSTs spurious.
5. Cenário "confirmar com pendências": `canConfirm=true` mesmo com pendências → confirm navigates.
6. Cenário "zero capítulos": mock retorna `totalCapitulos=0` → modal aparece antes de navegar.

**Non-goals:**
- Não implementa cenários de upload (FE-IMP-024).

**Layer(s):**
frontend / apps/imp-e2e

**Bounded context:**
imp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-08-e2e-scenarios.md` (§2)
- `docs/architecture/frontend/modules/imp/frontend/e2e/revisao-de-estrutura.feature`

**Architecture alignment:**
- Playwright (Nx executor `@nx/playwright`)
- Tag Nx: `scope:imp`, `type:e2e`

**Implementation checklist (by file):**

**App: apps/imp-e2e**
- 🔲 `apps/imp-e2e/src/revisao-de-estrutura.spec.ts` (9 cenários)
- 🔲 `apps/imp-e2e/src/page-objects/review.page.ts`
- 🔲 `apps/imp-e2e/src/fixtures/` (stubs: manuscrito com pendências, com zero capítulos, 404 empresa)

**Tests**
- 🔲 `nx e2e imp-e2e --spec=revisao-de-estrutura.spec.ts` PASS (todos 9 cenários)

**Milestone:**
Wave 7 / P9 e2e + Hardening

**Labels:**
type:e2e
layer:frontend
scope:imp
priority:P9

**Acceptance criteria:**
- `npx nx e2e imp-e2e --spec=revisao-de-estrutura.spec.ts` PASS
- Cenário de rollback de ignore: DOM retorna trecho a não-ignorado após 422
- Cenário de deep-link: rede tem exatamente 1 GET (não polling)

**Dependencies:**
- FE-IMP-017 (RevisaoDeEstruturaComponent completo)
- FE-IMP-011 (ReviewFacade com rollback real)
- FE-IMP-016 (ReviewActionsBar + modal)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Mocks de API via route interception (todos os endpoints do addendum incluídos)

**Testing / Evidence required:**
- Relatório de test run Playwright com 9/9 passed
- Network log do cenário deep-link confirmando 1 GET

**Risks / Notes:**
- Cenário de rollback de ignore é NOVO em relação ao que M3 especificou (era client-only otimista
  sem rollback real). Garantir que o stub de 422 `segmento-not-found` está incluído nos fixtures.
