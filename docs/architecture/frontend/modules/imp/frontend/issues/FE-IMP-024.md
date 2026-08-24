## [FE-IMP-024] Playwright e2e — upload-manuscrito.feature (9 cenários)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
`apps/imp-e2e/` contém os specs Playwright mapeados para todos os 9 cenários de
`e2e/upload-manuscrito.feature` passando no gate de CI.

**Context / Problem statement:**
- SPEC-08 §1 inventaria os 9 cenários de upload (T03). Cada cenário deve ter um arquivo
  `.spec.ts` mapeado para o `.feature` Gherkin.
- Cenários cobrem: import síncrono (novo projeto), import existente, indicador indeterminado,
  extensão inválida, arquivo grande, binding inválido, binding ausente, falha de parsing,
  empresa-switch cancela upload.
- Gate: `npx nx e2e imp-e2e --spec=upload-manuscrito.spec.ts`.

**Approach (execution path):**
1. Criar `apps/imp-e2e/src/upload-manuscrito.spec.ts` com Playwright `test.describe`.
2. Implementar os 9 cenários usando Page Object `UploadPage`:
   - `UploadPage.fillProjectName(name)`
   - `UploadPage.dropFile(filePath)`
   - `UploadPage.submit()`
   - `UploadPage.waitForNavigation()` → verifica URL `/imp/manuscritos/.+/revisao`
3. Mocks de API via Playwright `page.route()` (MSW ou route interception):
   - POST `/api/imp/manuscripts` → 201 com stub `ManuscritoDetail`
   - POST `/api/imp/manuscripts` → 422 parse-failed (cenário 8)
4. Cenário 9 (empresa-switch): simular via localStorage clear + trigger + verificar que navegação
   para T04 NÃO ocorre.
5. Verificar que NENHUM cenário faz polling (monitorar network requests — máximo 1 POST).

**Non-goals:**
- Não implementa specs de T04 (FE-IMP-025).
- Não roda mocks de servidor BE real.

**Layer(s):**
frontend / apps/imp-e2e

**Bounded context:**
imp

**Service execution spec(s):**
- `docs/architecture/frontend/modules/imp/frontend/frontend-spec/SPEC-08-e2e-scenarios.md` (§1)
- `docs/architecture/frontend/modules/imp/frontend/e2e/upload-manuscrito.feature`

**Architecture alignment:**
- Playwright (Nx executor `@nx/playwright`)
- Tag Nx: `scope:imp`, `type:e2e`

**Implementation checklist (by file):**

**App: apps/imp-e2e**
- 🔲 `apps/imp-e2e/src/upload-manuscrito.spec.ts` (9 cenários)
- 🔲 `apps/imp-e2e/src/page-objects/upload.page.ts` (Page Object)
- 🔲 `apps/imp-e2e/src/fixtures/` (stubs de API: 201, 422 parse-failed)

**Tests**
- 🔲 `nx e2e imp-e2e --spec=upload-manuscrito.spec.ts` PASS (todos 9 cenários)

**Milestone:**
Wave 7 / P9 e2e + Hardening

**Labels:**
type:e2e
layer:frontend
scope:imp
priority:P9

**Acceptance criteria:**
- `npx nx e2e imp-e2e --spec=upload-manuscrito.spec.ts` PASS
- Cenário de import síncrono confirma: exatamente 1 POST, zero polling
- Cenário extensão inválida confirma: zero requests enviados

**Dependencies:**
- FE-IMP-013 (UploadComponent completo)
- FE-IMP-021 (error handling implementado)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Mocks de API via route interception

**Testing / Evidence required:**
- Relatório de test run Playwright com 9/9 passed
- Network log confirmando ausência de polling

**Risks / Notes:**
- O gate `npx nx e2e` exige que a app esteja servida. Usar Playwright `webServer` config
  (`nx serve cordele-web`) ou ambiente de test.
- Arquivo de teste `feature` existente em `docs/architecture/frontend/modules/imp/frontend/e2e/`
  — usar como referência, não como runner (runner fica em `apps/imp-e2e/src/`).
