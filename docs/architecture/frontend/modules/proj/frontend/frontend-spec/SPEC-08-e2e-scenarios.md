# SPEC-08 — E2E Scenarios — PROJ (Projetos) — Frontend

> Gherkin scenarios for `apps/proj-e2e` (Playwright). Each scenario becomes a `Cenario:` in an
> `e2e/*.feature` file (header `# language: pt`) and covers the EARS acceptance clauses of SPEC-01..07:
> the coverage gate (`fe-ears-coverage`) matches each EARS clause `[slug]` to the backtick-slug
> in a scenario title. No EARS section here (SPEC-08 lists scenarios).

## Feature files

| File | Screen | Scenarios |
|---|---|---|
| `e2e/biblioteca-de-projetos.feature` | T02 `/biblioteca-de-projetos` | home landing, guards, re-fetch on entry, empresa switch, ordering, badge derivation, loading skeleton, empty state, quick download, degraded fields, permission gating, forbidden/5xx errors, shell registration |
| `e2e/download-e-historico.feature` | T08 `/projetos/:projetoId/historico` | parallel load, projeto guard, non-downloadable rows, signed-URL download, reopen (metadata/layout) → COMP, reopen pending, reopen visibility, illegal reopen, permission/flag gating, not-found/artifact/degraded errors, destroy cleanup |

## Scenario inventory

### `biblioteca-de-projetos.feature` (T02)

1. **Landing na biblioteca após login** — sign-in lands on `/biblioteca-de-projetos` (home module).
2. **Guardas de rota** — no session → login; no empresa → blocked; missing `proj.view` → access denied.
3. **Re-fetch a cada entrada** — entering (and re-entering from a sibling) always issues `GET /projetos`;
   no client cache.
4. **Troca de empresa cancela e re-busca** — an empresa claim change cancels the in-flight list and
   re-issues it.
5. **Ordenação por última atividade** — cards render newest-activity first.
6. **Derivação do badge** — badge folds `ultimoEpubcheckStatus` once a publication exists, else project
   status.
7. **Skeleton em carregamento / estado vazio** — skeletons while loading; dashed empty CTA to IMP when
   zero projects.
8. **"Abrir" stage-aware** — `publicado` → history; `rascunho`/`em_composicao` → IMP/COMP (never a dead
   end).
9. **Download rápido por card** — quick-download resolves a signed URL and opens it directly (never
   proxied); hidden without `proj.download` or when flag off.
10. **Degradação parcial** — a downstream port down → identity/status still render, missing fields marked
    unavailable, never the error state.
11. **Erros de leitura** — `403 forbidden` banner; `5xx` error state with retry; correlationId attached.
12. **Registro no shell** — the shell renders "Projetos" from the descriptor and redirects home.

### `download-e-historico.feature` (T08)

1. **Carga paralela do histórico** — entering issues `GET /projetos/{id}` and `.../publicacoes` in
   parallel.
2. **Guarda de projeto** — a malformed/cross-empresa `:projetoId` routes to "não encontrado" without a
   detail call.
3. **Linha não baixável** — an `erros_criticos`/`pendente` row shows no "Baixar" affordance.
4. **Download por URL assinada** — "Baixar" resolves a signed URL and opens it directly; the SPA never
   fetches the bytes.
5. **Reabrir para revisão (metadados/layout)** — "Ajustar metadados"/"Ajustar layout" `POST .../reopen`,
   then route to COMP `/config` or `/editor-de-layout-preview`.
6. **Reopen pendente** — while reopen is in flight, both CTAs are disabled (no double write).
7. **Visibilidade do reopen** — CTAs shown only for `publicado`/`com_erros` and with `proj.reopen`.
8. **Reopen ilegal** — a `409` from `rascunho` shows a defensive toast; status unchanged.
9. **Erros específicos** — `404 not-found` state; `409 artifact-not-available` inline; `degraded` PUB →
   empty history with a notice.
10. **Limpeza ao sair** — leaving the screen cancels in-flight requests and leaves no state.
