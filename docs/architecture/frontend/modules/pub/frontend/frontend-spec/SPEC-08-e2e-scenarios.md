# SPEC-08 — E2E Scenarios — PUB (Publicação) — Frontend

> Gherkin scenarios for `apps/pub-e2e` (Playwright). Each scenario becomes a `Cenario:` in an
> `e2e/*.feature` file and covers the EARS acceptance clauses of SPEC-01..07 (the coverage gate
> `fe-ears-coverage` matches clause backtick-slugs to scenario titles). No EARS section here (SPEC-08
> lists scenarios). Titles carry the slug in backticks (e.g. `` `pub-export-trigger` ``).

## Feature files

| File | Screen | Scenarios |
|---|---|---|
| `e2e/exportacao-e-validacao.feature` | T07 `/projetos/:id/exportacao-e-validacao` | trigger + poll (202/Retry-After), idempotent in-flight, indeterminate progress, verdict rendered, avisos non-blocking, resume on re-entry, "Baixar" → T08, no optimistic write, pre-flight errors (manuscript-missing, metadata-incomplete), status-advance-failed, verdict-not-error, network retry, not-found, forbidden, trace-id, guards outline, permissions/flags outline, shell lifecycle outline |
| `e2e/download-e-historico.feature` | T08 `/projetos/:id/download-e-historico` | history newest-first + versão atual, KPI cards from stats, KPI tile omitted when unsupplied, download via signed URL (never streamed), download gate ("inválido" rows), expired-URL re-fetch, artifact-not-available |

## Scenario inventory

### `exportacao-e-validacao.feature` (T07)

1. **Disparo e polling da exportação** (`pub-export-trigger`, `pub-poll-status`, `pub-poll-terminal`)
   — entering from COMP triggers one `POST .../publicacoes` (empty body, 202), then polls
   `.../{id}/status` honouring `Retry-After` until a terminal state; no SSE, no long-request.
2. **Build já em andamento é idempotente** (`pub-export-idempotent`) — triggering while a build is in
   flight returns the in-flight `Publicacao` (200) and starts no second job.
3. **Progresso indeterminado durante gerando** (`pub-progress-indeterminate`) — while `gerando`, an
   indeterminate indicator is shown with **no** numeric percentage.
4. **Veredito válido é renderizado, não computado** (`pub-verdict-rendered`) — on `publicado`/`valido`
   the success banner + epubcheck counts come straight from the record.
5. **Avisos não bloqueiam** (`pub-avisos-nonblocking`) — an `avisos` verdict renders as a downloadable
   success with a non-blocking warning caveat.
6. **Retomada ao reentrar** (`pub-resume-reentry`) — re-entering T07 resumes from the newest
   publication in history, not a fresh client timer.
7. **"Baixar ePub" navega para o histórico** (`pub-nav-baixar-t08`) — a valid result's "Baixar ePub"
   navigates to T08 for the same `projetoId`.
8. **Sem escrita otimista** (`pub-no-optimistic`) — the verdict/project status are never assumed before
   the server confirms.
9. **Manuscrito ausente** (`pub-err-manuscript-missing`) — `409` shows a banner pointing to IMP; no
   result.
10. **Metadados incompletos** (`pub-err-metadata-incomplete`) — `422` shows a banner pointing to COMP.
11. **Falha ao avançar o status do projeto** (`pub-err-status-advance-failed`) — `502` states the ePub
    was generated but the status update failed, preserving the traceId.
12. **Veredito de erros críticos não é toast de erro** (`pub-err-verdict-not-error`) — a `200` with
    `erros_criticos` renders the red result banner + blocked download, not an HTTP error toast.
13. **Falha de rede é retryável** (`pub-err-network-retry`) — a `5xx`/network error before a record
    exists shows a retryable banner and no phantom `gerando`.
14. **Publicação inexistente** (`pub-err-publicacao-not-found`) — `404` shows a not-found banner.
15. **Acesso proibido** (`pub-err-forbidden`) — `403` shows a blocking permission message, no retry.
16. **Toda falha anexa o traceId** (`pub-err-trace-id`).
17. **Guards de rota** (outline: `pub-guard-session`, `pub-guard-empresa`, `pub-guard-permission`,
    `pub-guard-uuid`, `pub-guard-status-export`, `pub-guard-status-history`).
18. **Permissões e feature flags** (outline: `pub-perm-export`, `pub-perm-view`, `pub-perm-download`,
    `pub-flag-rexport`, `pub-flag-pdf`, `pub-perm-accessdecision`).
19. **Integração com o Shell** (outline: `pub-shell-descriptor`, `pub-shell-nav-register`,
    `pub-shell-unmount`, `pub-empresa-cancel`, `pub-shell-nohttp`).

### `download-e-historico.feature` (T08)

1. **Histórico mais recente primeiro com versão atual** (`pub-versao-atual`) — the list is
   server-ordered newest-first and index 0 is tagged "versão atual".
2. **KPIs vêm do endpoint de stats** (`pub-stats-live`) — the KPI cards are computed from
   `.../publicacoes/stats`.
3. **Tile de KPI ausente é omitido** (`pub-kpi-omit-missing`) — an ePub-summary tile the contract does
   not supply is omitted, never faked.
4. **Download via URL assinada** (`pub-download-signed-url`) — downloading a valid publication requests
   a fresh short-TTL signed URL and opens it directly; the bytes are never streamed through the app.
5. **Gate de download bloqueia inválidos** (`pub-gate-download`) — a row with `erros_criticos`/no
   `arquivoUrl` renders "inválido" with no enabled download.
6. **Link expirado é renovado** (`pub-download-expired-refetch`) — an expired signed URL triggers a
   fresh re-fetch, never a public-link fallback.
7. **Artefato indisponível** (`pub-err-artifact-not-available`) — `409` on a blocked download shows an
   inline error and keeps the download disabled.
