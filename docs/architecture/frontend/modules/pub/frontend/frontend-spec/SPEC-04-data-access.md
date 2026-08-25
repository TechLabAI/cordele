# SPEC-04 — Data Access — PUB (Publicação) — Frontend

> All I/O goes through `PublicacaoApiService` + `ArtifactDownloadService` (`libs/pub/data-access`)
> built on `@cordele/shared/access-http-base` (interceptors inject `X-Correlation-Id` + `X-Empresa-Id`
> and normalize `ProblemDetail` → `AppError`). Components never touch `HttpClient`. Endpoints, methods
> and schemas are **owned by** `pub-service/contracts/api-contract.md` — this spec references them, it
> does not redefine them. Cross-link: `contracts/backend-api-cross-link.md`.

## 1. Resource master table

| Resource | Endpoint | Service | Facade | Operations | Cache? |
|---|---|---|---|---|---|
| Publicação (trigger export) | `POST /api/pub/projetos/{projetoId}/publicacoes` (§4.1) | `PublicacaoApiService.trigger()` | `ExportFacade` | create (202 new / 200 in-flight, idempotent) | no |
| Publicação (poll status) | `GET /api/pub/projetos/{projetoId}/publicacoes/{publicacaoId}/status` (§4.2) | `PublicacaoApiService.getStatus()` | `ExportFacade` | get (poll until terminal; honour `Retry-After`) | no |
| Publicação history | `GET /api/pub/projetos/{projetoId}/publicacoes` (§4.3) | `PublicacaoApiService.listByProjeto()` | `HistoryFacade` (+ resume on T07) | list (newest-first) | no |
| Download URL | `GET /api/pub/projetos/{projetoId}/publicacoes/{publicacaoId}/download` (§4.4) | `ArtifactDownloadService.getSignedUrl()` | `HistoryFacade` / `ExportFacade` | get (mint short-TTL signed URL) | no |
| Publication stats (KPIs) | `GET /api/pub/projetos/{projetoId}/publicacoes/stats` (§4.5) | `PublicacaoApiService.getStats()` | `HistoryFacade` | get (live projection) | no |
| Project header (PROJ) | `GET /api/proj/projetos/{projetoId}` | `PublicacaoApiService.getProjetoHeader()` | `HistoryFacade` | get (name + status chip + editora) | no |
| Metadata subtitle (COMP) | COMP `GetMetadados` (`autor`) | `PublicacaoApiService.getAutor()` | `HistoryFacade` | get (header subtitle) | no |

There is **no** `GET .../publicacoes/latest`, **no** `GET .../publicacoes/{id}/avisos` and **no**
`GET .../publicacoes/{id}/arquivo` (byte stream) in `api-contract.md`. See §2–§5 for how resume,
warnings and download are handled given the ratified contract (the doc 05 DRAFT shapes are reconciled
in the cross-link).

## 2. Export trigger + status poll (the load-bearing flow — ADR-PUB-001 / D-N)

```ts
// PublicacaoApiService (libs/pub/data-access)
trigger(projetoId: string): Observable<PublicacaoStatus>;              // POST §4.1 (body empty); 202 | 200
getStatus(projetoId: string, publicacaoId: string): Observable<{ body: PublicacaoStatus; retryAfterMs: number | null }>;
```

- **Trigger:** `POST` with an **empty body** (the project's current manuscript + composition are the
  inputs — no client-supplied content). `202 Accepted` starts a new build; `200 OK` returns the
  **in-flight** `Publicacao` when a build is already running (idempotent no-op, D-R). Both bodies are a
  `PublicacaoStatus` with `status=gerando`; the facade captures `publicacaoId` (also in the `Location`
  header) and begins polling.
- **Poll:** the facade repeatedly calls `getStatus()` until `status ∈ {publicado, com_erros}`
  (terminal). While non-terminal (`gerando`/`validando`) the response carries `Retry-After`; the facade
  waits `retryAfterMs` (falling back to a bounded default with backoff) before the next read — it does
  **not** hammer a fixed interval. There is **no SSE and no long-request** (D-N).
- **Bounded:** the poll has a max-attempts / max-duration ceiling; on exhaustion the facade surfaces an
  honest timeout state (retry re-reads status; it does **not** re-trigger a second build).
- **Cancellation:** the poll subscription is torn down on navigate-away and on empresa switch (the
  Access Layer also cancels requests scoped to the previous empresa).

### `ExportFacade` state machine

```
enter(COMP) --requestExport--> gerando --poll(Retry-After)--> gerando ...
                                   |-- status=publicado, epubcheckStatus∈{valido,avisos} --> valido (podeBaixar=true)
                                   |-- status=com_erros, epubcheckStatus=erros_criticos   --> erros  (podeBaixar=false)
                                   \-- request/network fail before a record --> error --retry--> gerando
re-enter --resumeExport--> (GET history, newest-first) --> in-flight? gerando(poll) : terminal verdict
```

Export is **not** optimistic — the verdict, `arquivoUrl` and the resulting project-status transition
are all the server's; the FE never assumes success or fabricates completion (ADR-PUB-001, §4).

## 3. Resume on re-entry (reconciled — no `latest` endpoint)

The doc 05 DRAFT `GET .../publicacoes/latest` is **not** in the contract. On T07 (re)entry with no
in-memory export state, `resumeExport(projetoId)` reads the **history list** (§4.3, server-ordered
newest-first) and takes index 0: if its `status` is non-terminal it resumes `gerando` and polls
(§4.2); otherwise it renders the terminal verdict directly. `GET .../stats` (§4.5) `ultimoStatus` /
`ultimoEpubcheckStatus` may short-circuit this when only the latest outcome is needed.

## 4. Download (reconciled — signed URL, never a byte stream)

The doc 05 DRAFT assumed the SPA streams the `.epub` through the app (`GET .../arquivo`). The ratified
contract (§4.4 / D-F/D-R) **mints a short-TTL signed URL** and the client opens it directly — **PUB
never proxies the bytes**:

```ts
// ArtifactDownloadService (libs/pub/data-access)
getSignedUrl(projetoId: string, publicacaoId: string): Observable<{ arquivoUrl: string; expiresAt: string }>;
download(projetoId: string, publicacaoId: string): void;   // getSignedUrl → open arquivoUrl in a new context
```

- `download()` is called **only** when `podeBaixar` is true. It requests a **fresh** signed URL (§4.4)
  and opens it; it never reuses a stale `arquivoUrl` beyond its TTL and never falls back to a public
  bucket link.
- `409 urn:cordele:pub:artifact-not-available` (download requested for a non-`valido`/`avisos`
  publication) is defence-in-depth on the server; the FE's `podeBaixar` gate should pre-empt it.
- On an expired/`401`/`404` URL, the facade **re-fetches** a fresh signed URL (§4.4) and surfaces an
  inline "link expirou" error rather than degrading.

## 5. Cache & writes

- **Cache:** none across navigations (§3 doc 05). Each screen calls the API on entry — the verdict,
  history and KPIs must reflect what the backend recorded (a re-export or status change may have
  happened) and there is **no broker** to invalidate (`messaging.enabled=false`). The in-flight
  `gerando` + poll state is ephemeral (dropped on leaving T07, resumable on re-entry via §3).
- **Writes:** PUB has exactly **one** write — `trigger` (create a `Publicacao`). It is
  server-authoritative and polled, **never optimistic** (§4). There is **no** update/delete of a
  `Publicacao` from the FE (the ledger is append-only, D-P); a re-export creates a **new** record. The
  project-status transition (`em_composicao → publicado | com_erros`) is **not** a PUB write — the
  build job authors it through PROJ's `advanceTo` (D-P); the FE only reflects the resulting status.

## Criterios de aceite (EARS)

- `WHEN the editor triggers an export, THE SYSTEM SHALL send exactly one POST to /api/pub/projetos/{projetoId}/publicacoes with an empty body and begin polling the returned publicacaoId [pub-export-trigger].`
- `IF a build is already in flight for the project, THEN THE SYSTEM SHALL adopt the in-flight publicacao returned with 200 and SHALL NOT trigger a second build [pub-export-idempotent].`
- `WHILE the build status is non-terminal, THE SYSTEM SHALL poll the status endpoint honouring the Retry-After hint and SHALL NOT open a streaming or long-held connection [pub-poll-status].`
- `WHEN the build status becomes publicado or com_erros, THE SYSTEM SHALL stop polling and render the terminal verdict [pub-poll-terminal].`
- `WHEN the export screen is re-entered without in-memory state, THE SYSTEM SHALL resume from the newest publication in the history list rather than a fresh client timer [pub-resume-reentry].`
- `WHEN the editor downloads a valid publication, THE SYSTEM SHALL request a fresh short-TTL signed URL and open it directly, and SHALL NOT stream the bytes through the app [pub-download-signed-url].`
- `IF a signed download URL is expired or rejected, THEN THE SYSTEM SHALL re-fetch a fresh signed URL and SHALL NOT fall back to a public link [pub-download-expired-refetch].`
- `WHEN the history screen loads, THE SYSTEM SHALL compute the KPI cards from the stats endpoint of the active project [pub-stats-live].`
- `THE SYSTEM SHALL treat the export as server-authoritative and SHALL NOT apply an optimistic update to the publication verdict or the project status [pub-no-optimistic].`
