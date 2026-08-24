# SPEC-08 — E2E Scenarios — IMP (Importação) — Frontend

> Gherkin scenarios for `apps/imp-e2e` (Playwright). Each scenario becomes a `Cenario:` in an
> `e2e/*.feature` file and covers the EARS acceptance clauses of SPEC-01..07 (the coverage gate
> matches clause backtick-slugs to scenario titles). No EARS section here (SPEC-08 lists scenarios).

## Feature files

| File | Screen | Scenarios |
|---|---|---|
| `e2e/upload-manuscrito.feature` | T03 `/imp/upload` | create-and-upload (synchronous), attach-to-existing, indeterminate parse indicator, invalid extension, oversize file, both-bindings error, neither-binding disabled, parse-failed banner, empresa-switch cancel |
| `e2e/revisao-de-estrutura.feature` | T04 `/imp/manuscritos/:id/revisao` | hydrate from POST response (no extra GET), counters match, pending panel always rendered, confirm with pending items, zero-chapters warning modal, optimistic ignore, reimport, deep-link single-GET hydration, cross-tenant 404 |

## Scenario inventory

### `upload-manuscrito.feature`

1. **Importação síncrona de projeto novo** — editor types a project name, drops a valid `.docx`,
   submits; a single `POST` runs; upload bar then an indeterminate "analisando estrutura…" indicator;
   on `201` the app navigates to structure review — **no polling, no parseJobId**.
2. **Anexar manuscrito a projeto existente** — from the nested route with a `projetoId`, the request
   carries `projetoId` (not `projetoTitulo`).
3. **Indicador de análise indeterminado** — while the request is in flight after upload completes, an
   indeterminate parse indicator is shown (no numeric percentage).
4. **Extensão inválida** — dropping a `.pdf` shows an inline drop-zone error and sends no request.
5. **Arquivo acima do limite** — a file over 50 MB shows the size-limit inline error and sends no
   request.
6. **Vínculo de projeto inválido — ambos** — supplying both a new name and an existing project is
   rejected before any request (mirrors 400 invalid-project-binding).
7. **Vínculo de projeto ausente** — with neither name nor selected project, the import button stays
   disabled.
8. **Falha de parsing** — a corrupt file yields `422 parse-failed`; a banner with "Reimportar" is
   shown and the app does not navigate.
9. **Troca de empresa cancela upload** — switching empresa mid-upload cancels the in-flight request.

### `revisao-de-estrutura.feature`

1. **Hidratação direta da resposta** — after a successful import, structure review is populated from
   the `POST` response body with **no** follow-up `GET`.
2. **Contadores conferem** — chapter, image and pending counters equal the manuscript response.
3. **Painel de pendências sempre visível** — every unparsed fragment is rendered and the pending
   counter is not hidden.
4. **Confirmar com pendências** — the confirm action is enabled even with pending fragments; the
   editor confirms and the app hands off to COMP.
5. **Aviso de zero capítulos** — confirming a manuscript with zero chapters opens a warning modal
   first.
6. **Ignorar trecho (otimista)** — ignoring a fragment marks it ignored immediately in the panel.
7. **Reimportar** — the "Reimportar outro arquivo" link returns to the upload screen.
8. **Deep-link hidrata com um único GET** — opening the review URL directly issues exactly one `GET`
   and shows loading skeletons until ready — no polling.
9. **Isolamento por empresa** — a manuscritoId from another empresa yields a not-found banner.
