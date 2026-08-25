# SPEC-08 — E2E Scenarios — COMP (Composição) — Frontend

> Gherkin scenarios for `apps/comp-e2e` (Playwright). Each scenario becomes a `Cenario:` in an `e2e/*.feature`
> file (header `# language: pt`) and covers the EARS acceptance clauses of SPEC-01..07: the coverage gate
> (`fe-ears-coverage`) matches each EARS clause `[slug]` to the backtick-slug in a scenario title. No EARS
> section here (SPEC-08 lists scenarios).

## Feature files

| File | Screen | Scenarios |
|---|---|---|
| `e2e/configuracoes.feature` | T05 `/projetos/:projetoId/config` | guards (session/empresa/permission/projeto/status), metadata hydrate + lazy default, required-field gating, re-fetch on entry, pessimistic advance, cover upload/remove, cover 413/415, edit-permission gating, coverUpload flag, access-decision, forbidden/not-found/5xx errors, correlation, shell registration/no-prefetch/destroy |
| `e2e/editor-de-layout-preview.feature` | T06 `/projetos/:projetoId/editor-de-layout-preview` | layout hydrate + lazy default, bounds + heading order, single-page preview, stale override, local-only live edit, alignment write-back, pessimistic export + PUB navigation (no status change), toolbar alignment-only, honoured-params-only, imageAlignment flag, edit-permission gating, manuscript-missing empty state, override-ref/structural-deferred defensive toasts |

## Scenario inventory

### `configuracoes.feature` (T05)

1. **Guardas de rota** — no session → login; no empresa → blocked; missing `comp.view` → access denied;
   malformed `:projetoId` → "não encontrado" (no API call); project not `em_composicao` → redirect to PROJ.
2. **Hidratação com default lazy** — `GET metadados` `materialized:false` → form renders with `idioma=pt`
   defaults (no "not created" screen).
3. **Campos obrigatórios travam o avanço** — "Ir para preview" stays disabled until `titulo`, `autor`,
   `idioma` are valid.
4. **Re-fetch a cada entrada** — entering (and re-entering) always issues `GET .../metadados`; no cache.
5. **Avanço pessimista** — "Ir para preview" `PUT .../metadados`, awaits `200`, then routes to T06; a failed
   PUT halts the advance and preserves edits.
6. **Upload e remoção de capa** — a valid image `POST .../capa` swaps the object-URL for `capaUrl`; remove
   `DELETE .../capa` clears it idempotently.
7. **Capa inválida** — `415` wrong format and `413` too large show inline drop-zone errors; the form is intact.
8. **Gating por permissão e flag** — without `comp.edit` the advance/cover affordances are hidden; with the
   `comp.coverUpload` flag off the drop zone is not rendered; permissions go through `AccessDecisionService`.
9. **Erros de leitura** — `403 forbidden` banner; `404 not-found` state; `5xx` error state with retry;
   correlationId attached.
10. **Integração com o shell** — the shell registers the descriptor and nav config, does not prefetch, and
    cancels in-flight requests on destroy.

### `editor-de-layout-preview.feature` (T06)

1. **Hidratação com default lazy** — `GET layout` + `GET preview-context` in parallel; `materialized:false`
   → default configuration; single-page canvas.
2. **Limites e ordem de headings** — style controls clamp to §7.2 bounds and enforce `h1 ≥ h2 ≥ h3`.
3. **Preview página-a-página** — exactly one page in the DOM; changing page issues **no** network call.
4. **Override obsoleto** — an override marked `stale` is excluded from the applied preview and from the
   persisted payload, shown as a non-blocking notice.
5. **Edição local e write-back de alinhamento** — typography and alignment change locally with no network;
   the alignment set is written back only with the layout upsert on export.
6. **Exportar pessimista sem mudar status** — "Exportar" `PUT .../layout`, awaits `200`, then navigates to PUB
   `/exportacao-e-validacao`; COMP never changes the project status.
7. **Toolbar apenas de alinhamento** — no add-page/remove-page/insert-image controls; only the image-alignment
   control, and only the PUB-honoured parameters are exposed.
8. **Gating por permissão e flag** — without `comp.edit` the export/alignment affordances are hidden; with
   `comp.imageAlignment` off the alignment control is not rendered.
9. **Erros específicos** — `409 manuscript-missing` → preview empty state; defensive `422 override-ref-not-found`
   and `422 structural-edit-deferred` toasts.
