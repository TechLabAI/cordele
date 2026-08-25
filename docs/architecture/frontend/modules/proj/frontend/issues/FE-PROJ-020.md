## [FE-PROJ-020] Error states + URN→UI mapping + retry (SPEC-07)

**Status:** 🔲 ABERTA
**GitHub:** [#TBD]

**Outcome:**
Todos os cenários de erro de SPEC-07 §1 estão mapeados: estado de erro 5xx/network (com retry),
banner de 403, estado not-found de 404, toast defensivo de 409 (reopen ilegal), inline feedback de
download. O `correlationId` aparece em todos os erros para suporte.

**Context / Problem statement:**
- SPEC-07 §1 define a tabela completa de URN → tratamento de UI (6 URNs + 5xx + signed URL expired).
- SPEC-07 §3 define o canal para cada erro: error state vs banner vs inline vs toast.
- `ErrorNormalize` interceptor normaliza `ProblemDetail` → `AppError { code, title, detail, correlationId }`.
- Os facades já setam `status=error` / `toast` / `inline` (FE-PROJ-009, FE-PROJ-010); esta issue
  conecta os estados das facades aos componentes visuais corretos.

**Approach (execution path):**
1. Verificar que `BibliotecaDeProjetosComponent` renderiza `ErrorStateComponent` (de `@cordele/shared/ui-feedback`)
   quando `LibraryFacade.status() === 'error'` + botão "Tentar novamente" chama `LibraryFacade.retry()`.
2. Verificar que `DownloadEHistoricoComponent` renderiza `ErrorStateComponent` quando
   `HistoryFacade.status() === 'error'`.
3. Implementar banner de 403 (`urn:cordele:proj:forbidden`) nas duas telas.
4. Implementar banner "Projeto não encontrado" (404 / `urn:cordele:proj:not-found`) em `DownloadEHistoricoComponent`.
5. Verificar que o toast de 409 (`urn:cordele:proj:illegal-status-transition`) é emitido pelo
   `HistoryFacade.reopen()` (FE-PROJ-010) e que o `correlationId` está presente.
6. Adicionar display de `correlationId` nas mensagens de erro (modo dev: visível; prod: copiável).

**Non-goals:**
- Não implementa o `ErrorNormalize` interceptor (responsabilidade de `@cordele/shared/access-http-base`).
- Não implementa o canal de toast (responsabilidade de `@cordele/shared/ui-feedback`).

**Layer(s):**
frontend / libs/proj/feature-library + libs/proj/feature-history + libs/proj/ui

**Bounded context:**
proj

**Service execution spec(s):**
- `docs/architecture/frontend/modules/proj/frontend/frontend-spec/SPEC-07-error-handling.md` (§1, §3, §4)

**Architecture alignment:**
- Tag Nx: `scope:proj`, `type:feature`
- Sem estado adicional nos componentes; os estados vêm das facades

**Implementation checklist (by file):**

**Lib: libs/proj/feature-library**
- 🔲 `BibliotecaDeProjetosComponent` — `@if status='error'` → `ErrorStateComponent` + retry
- 🔲 `BibliotecaDeProjetosComponent` — banner 403 (usar `@cordele/shared/ui-feedback`)

**Lib: libs/proj/feature-history**
- 🔲 `DownloadEHistoricoComponent` — `@if status='error'` → `ErrorStateComponent` + retry
- 🔲 `DownloadEHistoricoComponent` — banner not-found (404) com link para biblioteca
- 🔲 `DownloadEHistoricoComponent` — banner 403
- 🔲 Exibição de `correlationId` nas mensagens de erro

**Tests**
- 🔲 `nx test proj-feature-library` PASS — `status=error` → ErrorStateComponent presente
- 🔲 `nx test proj-feature-library` PASS — retry chama `LibraryFacade.retry()`
- 🔲 `nx test proj-feature-history` PASS — 404 → banner "Projeto não encontrado" com link à biblioteca
- 🔲 `nx test proj-feature-history` PASS — 403 → banner de acesso negado
- 🔲 `nx lint proj-feature-library` PASS
- 🔲 `nx lint proj-feature-history` PASS

**Milestone:**
Wave 5 / P5 UX Polish

**Labels:**
type:feature
layer:frontend
scope:proj
priority:P5

**Acceptance criteria:**
- `npx nx test proj-feature-library` PASS
- `npx nx test proj-feature-history` PASS
- `npx nx lint proj-feature-library` PASS
- Todos os 6 URNs de SPEC-07 §1 têm tratamento mapeado (verificado por review manual)
- `correlationId` presente em todas as mensagens de erro surfaced ao usuário

**Dependencies:**
- FE-PROJ-009 (LibraryFacade.status + retry)
- FE-PROJ-010 (HistoryFacade.status + reopen toast)

**Data impact:**
- Nenhum

**API / Contract impact:**
- Consome `ProblemDetail` estrutura de todos os endpoints PROJ

**Testing / Evidence required:**
- Screenshot do error state (com "Tentar novamente") em T02 e T08
- Screenshot do banner 404 "Projeto não encontrado" com link de volta

**Risks / Notes:**
- `urn:cordele:proj:erasure-failed` (502 no delete) não tem UI no MVP; manter o mapeamento no
  `AppErrorCode` para quando a UI for ativada.
