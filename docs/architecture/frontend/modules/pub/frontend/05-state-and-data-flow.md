# 05 — State and Data Flow — PUB (Publicação)

## 1. State Topology

| State | Owner | Kind |
|---|---|---|
| Session, roles | `@cordele/shared/auth-session` | global signal |
| Active empresa | `@cordele/shared/empresa-context` | global signal |
| Export state (`phase`, `progresso`, `publicacao`) | `ExportFacade` (`libs/pub/data-access`) | local signal |
| Status-poll lifecycle (watch `pendente` → terminal) | `ExportFacade` / `PublicacaoApiService` | RxJS stream → signal |
| History list + `status` | `HistoryFacade` (`libs/pub/data-access`) | local signal |
| Step-bar / breadcrumb position (stage 4) | `libs/pub/navigation` | local signal / pure fn |

No cross-module shared state: PUB is entered with a `projetoId` route param, creates/reads its own
`Publicacao` records against `pub-service`, reads project/metadata for the header, and downloads
through an authenticated backend URL. It never holds a writable copy of `ProjetoEditorial`,
`Metadados`, `ConfiguracaoLayout` or `Manuscrito` — status is PROJ's, config is COMP's, content is
IMP's (immutable).

> Endpoints below are **DRAFT direction** (Vision phase). They are reconciled against
> `pub-service/contracts/api-contract.md` in the Specs phase (M3). Divergences will be recorded here as
> an addendum (mirroring how PROJ's doc 05 was reconciled).

## 2. Data Access Pattern

- Components never touch `HttpClient`. All I/O goes through `PublicacaoApiService` and
  `ArtifactDownloadService` (`libs/pub/data-access`), which use `@cordele/shared/access-http-base`
  (interceptors inject Correlation + `X-Empresa-Id`, normalize errors; empresa scoping is server-side
  via the JWT claim).
- Facades call the services, map responses into VMs, and publish `signal<T>` read via `.asReadonly()`;
  components bind with `OnPush`.

Endpoints (firmed in Specs against `pub-service/contracts/api-contract.md`):

| Action | Method / path | Scope | Notes |
|---|---|---|---|
| Request export | `POST /api/pub/projetos/{projetoId}/publicacoes` | `pub:export` | starts the server build + epubcheck; returns `Publicacao(pendente)` with an `id`; requires project `em_composicao` (`409` otherwise) |
| Read latest publication | `GET /api/pub/projetos/{projetoId}/publicacoes/latest` | `pub:read` | resume on T07 (re)entry; `404`/empty → no export yet |
| Read publication by id | `GET /api/pub/publicacoes/{id}` | `pub:read` | poll a `pendente` record until terminal `epubcheckStatus`; carries counts + warnings |
| Read warnings detail | `GET /api/pub/publicacoes/{id}/avisos` | `pub:read` | non-blocking warnings (`code`/`msg`/`local`) for the T07 `<details>`; may be inlined in the record |
| List export history | `GET /api/pub/projetos/{projetoId}/publicacoes` | `pub:read` | T08 list, newest-first; server-ordered |
| Download ePub | `GET /api/pub/publicacoes/{id}/arquivo` | `pub:download` | authenticated; streams the `.epub` (blob or signed-redirect); enabled iff `epubcheckStatus ∈ {valido, avisos}`; `arquivoUrl` points here |
| Read project header | `GET /api/proj/projetos/{projetoId}` (PROJ) | `proj:read` | name + status ("Publicado" chip) for the T08 header |
| Read metadata subtitle | via COMP `GetMetadados` (`autor`) | `comp:read` | header subtitle; sourced from COMP (backend read port or FE call — Specs) |

**Status transition** (`em_composicao → publicado | com_erros`) is **not** a PUB write: `pub-service`
authors it through PROJ's `AdvanceProjetoStatusUseCase` (`SolicitadoPor = pub`) as part of finalizing
the build. The FE only reflects the resulting `Publicacao` + the project's new status. Whether the
warnings/summary/KPIs are inlined in the `Publicacao` payload or fetched separately, and whether the
project-header + metadata reads are proxied by `pub-service` or fetched from PROJ/COMP directly, are
**Specs decisions**.

## 3. Cache Strategy

Default: **call the API on entry to each screen** — `POST` (or resume `GET latest`) on T07 entry;
`GET` project + history on T08 entry. No client cache across navigations: the publication verdict and
history must reflect what the backend actually recorded (a re-export or a status change may have
happened), and there is **no broker** to invalidate a cache (`messaging.enabled=false`). The
**in-flight export** state (`gerando` + poll) is intentionally client-side and ephemeral — it is not a
cache of server data but a live view of a `pendente` record that is dropped on leaving T07 (and
resumable on re-entry via `GET latest`).

## 4. Writes and Optimistic Updates

**No optimistic updates.** PUB has one write action, and it is server-authoritative:

- **Request export** (`POST .../publicacoes`, `pub:export`) — creates a `Publicacao(pendente)`; the
  facade then **polls** `GET .../publicacoes/{id}` until a terminal `epubcheckStatus`. The verdict
  (`valido`/`avisos`/`erros_criticos`), the counts, the `arquivoUrl` and the resulting project-status
  transition are all authored by `pub-service` — the FE never assumes success or fabricates completion
  (ADR-PUB-001). On a request/network failure before a record exists, T07 shows an error with retry;
  nothing partial is shown as "done".
- **Download** (`GET .../arquivo`, `pub:download`) — an authenticated fetch that streams the `.epub`;
  on `401`/`404`/expired it re-fetches a fresh authenticated URL and surfaces an inline error rather
  than degrading to a public link.

There is no update or delete of a `Publicacao` from the FE (the ledger is append-only); a re-export
creates a **new** record. Any future cancel-generation or delete-publication behaviour must declare its
own contract in a Spec (out of MVP).

## 5. Error Handling

- BE returns RFC-7807 `ProblemDetail`; the ErrorNormalize interceptor converts it to a normalized
  `AppError` (code, title, detail, correlationId).
- **Domain verdict is not an HTTP error:** a successful export that yields `erros_criticos` is a
  **200/2xx** response whose `epubcheckStatus` drives the red result banner + blocked download — it is
  domain data, never an error toast.
- Mapping to UI (URNs firmed against api-contract §5 in Specs):
  - `POST export` / `GET publicacao` `5xx` / network → error state on T07 with "Tentar novamente"; no
    phantom "gerando" that never resolves.
  - `409 urn:cordele:pub:illegal-status` (export requested for a project not `em_composicao`) → redirect
    to PROJ/COMP with feedback; pre-empted by `pubStatusGuard`.
  - `403 urn:cordele:pub:forbidden` (missing `pub:export`/`pub:download`) → access-denied feedback
    (pre-empted by the guard).
  - `GET .../arquivo` `401`/`404`/expired → inline "link expirou" with a re-fetch of a fresh authenticated
    URL; never a fallback to a public bucket link.
  - `404` on `GET latest`/history for a project with no exports → empty state (→ "Nova exportação").
- Correlation id (`traceId` mirrors `X-Correlation-Id`) from the interceptor is attached to every error
  for support/observability; on a build failure the `Publicacao.erros` summary + correlation id are
  shown for support.

## 6. Breadcrumbs and Navigation State

- `libs/pub/navigation` feeds the **step bar** (Importar › Configurar › Visualizar › **Exportar**) with
  stage 4 active on T07, and the breadcrumb: on `/exportacao-e-validacao` → `Projetos › {nome} ›
  Exportar`; on `/download-e-historico` → `Projetos › {nome} › Publicação`. Step positions come from
  `nav.config`, never built ad hoc in a template.
- **Entry resolution:** PUB is reached with `projetoId` from COMP's T06 "Exportar" (project
  `em_composicao`) or from PROJ / T08 "Nova exportação". A re-export of a `publicado`/`com_erros`
  project is interposed by a PROJ `reopen` (→ `em_composicao`) before T07, mirroring COMP's reopen
  contract (Specs firms this).
- **Exit:** T07 "Baixar ePub" → T08 (same project). T07/T08 "Ajustar layout / metadados" → COMP
  (`/editor-de-layout-preview` / `/config`). T08 "Voltar à biblioteca" → PROJ `/biblioteca-de-projetos`.
  Every cross-module handoff carries `projetoId` as a route param.
- Navigation values come from `NavigationService` (Access Layer) + PUB's `nav.config`.
