# API Contract — pub-service (Publicação)

**Module:** PUB · **Service:** `pub-service` · **Stack:** Node 22 · NestJS 11 · Prisma · PostgreSQL 16
**Base path:** `/api/pub` (served through the single BFF — TECH-003; the frontend never reads storage or DB directly)
**Governing ADRs:** shared `docs/architecture/backend/adr/ADR-001-hexagonal-node.md` (hexagonal boundary),
`ADR-002-modular-monolith.md`, `ADR-003-multi-tenancy.md`; local `adr/ADR-001-service-boundary.md`,
`adr/ADR-002-async-build-status-machine.md`, `adr/ADR-003-epubcheck-validation-port.md`.
EARS acceptance criteria per endpoint follow `docs/architecture/backend/standards/ears-notation.md`.

---

## 0. Authoritative decisions resolved in this contract

Three points were left open at the end of the Vision phase (doc 06, M1/M1.5 handoff warnings): the
generation-progress mechanism, the source of the KPIs the FE shows, and the re-export/reopen contract with
PROJ. They are resolved here (plus two supporting decisions on verdict mapping and concurrency) and are
**binding on downstream phases** (Backlog, Scaffold) and on the FE Specs phase (M3).

### D-N — Generation progress is bounded status-polling: `202` on trigger, poll a status endpoint (closes "progress mechanism")

With no broker and `messaging.enabled=false` there is **no server-push channel**. The Vision's three
candidates (a long synchronous request, polling, or SSE) are resolved to **polling** (local ADR-002):
`POST .../publicacoes` creates the `Publicacao` in `gerando`, enqueues the in-process build job, and
returns **`202 Accepted`** with the `publicacaoId` immediately; the client polls
`GET .../publicacoes/{publicacaoId}/status` until a terminal state (`publicado` | `com_erros`). SSE is
**rejected** for the POC (it needs a held connection and lifecycle the single BFF does not warrant here;
recorded as a post-POC option in doc 06). The long synchronous request is **rejected** because assembly +
epubcheck are long-running and must not block the request thread (doc 04). The status endpoint returns a
`Retry-After` hint while non-terminal and is safely cacheable once terminal (§4.2, §7). This supersedes
the FE ADR-PUB-001 assumption that the mechanism was undecided — **M3 wires the T07 progress UI to this
poll loop**, not to SSE.

### D-O — FE KPIs are computed from PUB's own publication read model, not a separate analytics store (closes "KPI source")

The KPI figures the T07/T08 screens show — total publications, how many `válido` / `avisos` /
`erros_criticos`, and the latest outcome — are derived **from PUB's `Publicacao` + `validation_message`
rows** through a dedicated read use case `GetPublicationStatsUseCase` (REST `GET .../publicacoes/stats`,
§4.5) and the existing `PublicationHistoryPort`. There is **no** analytics pipeline, warehouse or event
store feeding these numbers (`analytics`/`elastic` disabled, `ai.hasAi=false`); they are a live projection
of the authoritative table, scoped to the active empresa. This keeps the KPI a by-product of the same data
that drives history (T08), never a second source of truth that could drift.

### D-P — Re-export is a new `Publicacao`; reopening for edits is PROJ's job, never PUB's (closes "re-export/reopen with PROJ")

Two distinct editor intents were conflated as "re-export/reopen":

- **Re-generate the ePub** (the manuscript/metadata/layout are already what the editor wants): the editor
  triggers `POST .../publicacoes` again. PUB creates a **new** `Publicacao` with the next `sequencia`
  (append-only history, doc 05) and, on the outcome, calls
  `AdvanceProjetoStatusUseCase.advanceTo({ projetoId, targetStatus: publicado | com_erros })`. PROJ's legal
  table already allows `publicado ↔ com_erros` and `em_composicao → publicado|com_erros` (proj
  api-contract §7), so **PUB never needs a backward transition** and never calls `reopen`.
- **Re-open to change metadata/layout first**: this returns the project to `em_composicao` and is owned by
  **PROJ** — `ReopenProjectForRevisionUseCase.reopen`, invoked by the editor via
  `POST /api/proj/projetos/{id}/reopen` (T08 "Ajustar metadados / layout"). PUB is **not** a caller of
  `reopen` (proj integration-contracts §1.4). After the editor reopens and re-composes, the next PUB
  export advances the project forward again through `advanceTo`.

> **Net:** PUB's only write to the project lifecycle is `advanceTo(publicado|com_erros)` (D-C holds — PUB
> never writes `projeto_editorial`). Re-export = new attempt row; reopen = PROJ. No new PUB→PROJ port is
> introduced by this phase.

### D-Q — The build machine status and the epubcheck verdict are two fields; warnings do not block publication

PUB stores **both** the build-lifecycle `status` (`gerando | validando | publicado | com_erros`, doc 05)
**and** the epubcheck `epubcheckStatus` verdict (`valido | avisos | erros_criticos | pendente`, the BA
`Publicacao.epubcheckStatus` enum surfaced to PROJ/FE). The mapping is fixed (ADR-003):

| epubcheck verdict | `epubcheckStatus` | build `status` | Downloadable | `advanceTo` target |
|---|---|---|---|---|
| clean | `valido` | `publicado` | yes | `publicado` |
| warnings only, no errors | `avisos` | `publicado` | yes | `publicado` |
| ≥ 1 fatal/error | `erros_criticos` | `com_erros` | no | `com_erros` |
| build not finished | `pendente` | `gerando`/`validando` | no | — |

**Warnings do not block publication** — `avisos` still yields `publicado` with a downloadable artifact
(consistent with PROJ minting a signed URL for `epubcheckStatus ∈ {valido, avisos}`, proj api-contract
§4.5 / D-F). Only fatal/error messages make the build `com_erros`.

### D-R — At most one non-terminal build per project; the trigger is idempotent (closes concurrency)

A project has **at most one** `Publicacao` in `gerando`/`validando` at a time (doc 04). Triggering an
export while a build is in flight is a **successful idempotent no-op** that returns the in-flight
`publicacaoId` (HTTP `200` with the existing resource) rather than starting a second job. The invariant is
enforced by a partial unique index (`data-model.md` §2.1) and checked in the use case. The download URL is
a **short-TTL signed URL minted by PUB** via its `FileStoragePort` (§4.4 / D-F); PUB serves bytes only
through storage, never proxied through the app.

### D-S — EpubSummaryVM KPI fields: build-time snapshot for Tamanho/Capítulos/Imagens; Páginas permanently omitted (closes PUB-021)

Resolves the third open point carried since the Vision phase: the source of the T07 KPI tiles
(`EpubSummaryVM` — Tamanho/Páginas/Capítulos/Imagens, SPEC-03 §3). Full rationale in local
`adr/ADR-004-epub-summary-kpi-field-sources.md`.

- `PublicacaoStatus` (§6.1) gains `tamanhoBytes`, `totalCapitulos`, `totalImagens` — non-null iff
  `status = publicado` (same rule as `arquivoDisponivel`/`artefato_ref`). **Not** added to
  `PublicacaoHistoryItem` (§6.2): `EpubSummaryVM` is scoped to the T07 "KPI grid for a valid export"
  (SPEC-03 §1), sourced from `PublicacaoStatus` only (cross-link §3) — T08 history rows don't render it,
  and §6.2's field set is fixed/shared with PROJ's `PublicationHistoryPort` (G2), so it is left untouched
  to avoid an unrequested ripple into `proj-service`'s mirrored contract.
- Chapter/image counts are **counted during the `ManuscriptContentPort` walk PUB already performs** at
  assembly (`integration-contracts.md` §2.1) — no new cross-context port. Size is the byte length of the
  assembled `.epub` at the point it is written to `FileStoragePort`. All three are captured together, at
  the `gerando → validando` transition, and persisted as a snapshot (append-only, like the rest of
  `publicacao` — they reflect the manuscript *at that build*, not its current state).
- **`paginas`/`pages` is not part of this contract, and will not be added.** ePub reflowable content has
  no fixed pagination; the FE tile stays permanently hidden (`null` forever) by product decision (ADR-004),
  not as a pending gap.

---

## 1. Conventions

- **Media type:** `application/json` for requests and responses.
- **IDs:** UUID v4 (server-generated). Never client-supplied.
- **Timestamps:** RFC 3339 / ISO-8601 UTC (`iniciadaEm`, `concluidaEm`, `expiresAt`).
- **Errors:** RFC 7807 `application/problem+json` (see §5).
- **Idempotency:** the export trigger is idempotent while a build is in flight (D-R); polling is naturally
  idempotent; download-URL minting is idempotent (re-minting is allowed, returns a fresh TTL).
- **Project binding:** PUB never creates or writes `projeto_editorial`; it is keyed to a `projetoId` PROJ
  owns and only *requests* the terminal status via `advanceTo` (D-C / D-P). A `projetoId` not in the active
  empresa yields `404`.

## 2. Authentication, authorization, tenancy

- **Auth:** OAuth2 Bearer JWT (`Authorization: Bearer <token>`). Unauthenticated → `401`.
- **Scopes:** `pub:read` (status, list, stats, download-url), `pub:write` (trigger export).
- **Tenant:** the owning `empresa` is taken **from the JWT claim** and applied via `EmpresaContext`
  (AsyncLocalStorage, RULE-07 / ADR-003). It is **never** read from the path, query or body — including on
  the in-process `PublicationHistoryPort` / `PublicationErasurePort`, which inherit the caller's
  `EmpresaContext`. The build job runs inside the triggering request's `EmpresaContext`.
  - **EARS:** `THE SYSTEM SHALL resolve the tenant schema exclusively from the authenticated principal's
    empresa claim.`
  - **EARS:** `IF a caller references a projetoId or publicacaoId that belongs to another empresa, THEN THE
    SYSTEM SHALL respond 404 (never revealing cross-tenant existence).`

## 3. Required headers

| Header | Direction | Notes |
|---|---|---|
| `Authorization: Bearer <jwt>` | request | required on every endpoint |
| `X-Correlation-Id` | request (optional) / response (always) | propagated to logs and pipeline events; generated if absent |
| `Content-Type: application/json` | request | trigger export |
| `Retry-After` | response | on `202`/non-terminal `200` from the status endpoint — poll hint (seconds) |
| `Content-Type: application/problem+json` | response | error responses |

---

## 4. Resources

Every PUB resource is a child of a project (`/api/pub/projetos/{projetoId}/...`), matching the house style
PROJ and COMP set for sub-resources.

### 4.1 `POST /api/pub/projetos/{projetoId}/publicacoes` — trigger an ePub 3 export (T07)

Creates a `Publicacao` in `gerando`, enqueues the **asynchronous in-process build job** (assemble →
validate → persist outcome → request project status), and returns `202` immediately with the new resource
(local ADR-002 / D-N). If a build is already in flight for the project, returns the in-flight resource
`200` without starting a second job (D-R). Requires that the project has an imported manuscript (IMP) and
at least the required metadata (COMP `titulo`/`autor`/`idioma`) — otherwise a synchronous pre-flight
rejection before any job is enqueued (§7.1).

**Scope:** `pub:write` · **Request body:** empty (the project's current manuscript + composition are the
inputs; no client-supplied content).

**Success — `202 Accepted`** (new build) or **`200 OK`** (in-flight build already exists), body =
`PublicacaoStatus` (§6.1) with `status = "gerando"`, `Location: /api/pub/projetos/{projetoId}/publicacoes/{publicacaoId}`.

Acceptance criteria (EARS):

- `WHEN an authenticated editor triggers an export for a project that has a manuscript and complete required
  metadata, THE SYSTEM SHALL create a Publicacao in status gerando, enqueue the build job, and respond 202
  with the PublicacaoStatus and a Location header.`
- `IF a Publicacao for the project is already in gerando or validando, THEN THE SYSTEM SHALL return that
  in-flight Publicacao with 200 and start no second job (idempotent, D-R).`
- `IF the project has no imported manuscript, THEN THE SYSTEM SHALL respond 409
  (urn:cordele:pub:manuscript-missing) and enqueue nothing.`
- `IF required metadata (titulo, autor, idioma) is absent, THEN THE SYSTEM SHALL respond 422
  (urn:cordele:pub:metadata-incomplete) and enqueue nothing.`
- `THE SYSTEM SHALL assign each new Publicacao the next per-project sequencia (append-only history).`
- `THE SYSTEM SHALL NOT write projeto_editorial on trigger; the project status changes only via advanceTo
  when the build reaches a terminal outcome (D-P).`

### 4.2 `GET /api/pub/projetos/{projetoId}/publicacoes/{publicacaoId}/status` — poll build status (T07)

The poll endpoint the client hits after triggering (D-N). Returns the current build `status`, the
`epubcheckStatus` verdict, the validation-message counts, and — once terminal and downloadable — a
resolvable download reference. While non-terminal it sets `Retry-After`.

**Scope:** `pub:read` · **Success — `200 OK`**, body = `PublicacaoStatus` (§6.1).

Acceptance criteria (EARS):

- `WHILE the build is non-terminal (gerando or validando), THE SYSTEM SHALL respond 200 with the current
  status, epubcheckStatus=pendente, and a Retry-After header hinting the poll interval.`
- `WHEN the build has reached publicado, THE SYSTEM SHALL respond 200 with status=publicado, epubcheckStatus
  in {valido, avisos}, the message counts, and arquivoDisponivel=true.`
- `WHEN the build has reached com_erros, THE SYSTEM SHALL respond 200 with status=com_erros,
  epubcheckStatus=erros_criticos, the message counts and resumoErro, and arquivoDisponivel=false.`
- `IF the publicacaoId does not belong to the projetoId or the active empresa, THEN THE SYSTEM SHALL respond
  404 (urn:cordele:pub:publicacao-not-found).`

### 4.3 `GET /api/pub/projetos/{projetoId}/publicacoes` — publication history (T08)

The full publication history for one project, newest first — the same records PROJ reads through
`PublicationHistoryPort` (proj api-contract §4.4). PUB is the authoritative owner; this REST list serves
the T08 screen directly, PROJ's `/api/proj/.../publicacoes` composes the same rows into the project view.

**Scope:** `pub:read` · **Success — `200 OK`**, body = `PublicacaoHistoryItem[]` (§6.2).

- `WHEN an existing projetoId of the active empresa is requested, THE SYSTEM SHALL return its publications
  ordered by criadoEm descending (possibly empty), each with epubcheckStatus, totalErros, totalAvisos and a
  download reference.`
- `THE SYSTEM SHALL set arquivoUrl to null for any publication whose epubcheckStatus is erros_criticos or
  pendente (no downloadable artifact).`

### 4.4 `GET /api/pub/projetos/{projetoId}/publicacoes/{publicacaoId}/download` — signed download URL (T08, D-F/D-R)

Mints a **short-TTL signed URL** to the ePub artifact in `FileStoragePort` storage. The client opens the
URL directly; **PUB never streams the bytes through the app** (mirrors PROJ D-F; PROJ delegates its own
download endpoint to `PublicationHistoryPort.signedDownloadUrl`, which resolves here).

**Scope:** `pub:read` · **Success — `200 OK`**:

```json
{ "publicacaoId": "uuid", "arquivoUrl": "https://storage.../romance-v2.epub?sig=...", "expiresAt": "2026-08-25T15:10:00Z" }
```

- `WHEN a download is requested for a publication whose epubcheckStatus is valido or avisos, THE SYSTEM
  SHALL return a short-TTL signed URL to the artifact and never proxy the bytes.`
- `IF the publication's epubcheckStatus is erros_criticos or pendente, THEN THE SYSTEM SHALL respond 409
  (urn:cordele:pub:artifact-not-available).`
- `IF the publicacaoId does not belong to the projetoId or the active empresa, THEN THE SYSTEM SHALL respond
  404.`

### 4.5 `GET /api/pub/projetos/{projetoId}/publicacoes/stats` — publication KPIs (T07/T08, D-O)

Live projection of the project's publications used to render the KPI cards. Computed from `Publicacao` +
`validation_message` rows; no separate analytics store.

**Scope:** `pub:read` · **Success — `200 OK`**, body = `PublicationStats` (§6.3).

- `WHEN an existing projetoId of the active empresa is requested, THE SYSTEM SHALL return the aggregate
  counts (total, publicadas, comAvisos, comErros, emAndamento) and the latest outcome computed live from the
  project's publications.`
- `THE SYSTEM SHALL compute the KPIs from the Publicacao rows of the active empresa only, never from a
  separate analytics source (D-O).`

### 4.6 `GET /api/pub/projetos/{projetoId}/publicacoes/{publicacaoId}/validation-messages` — detailed validation messages (PUB-016)

Returns the `validation_message` rows for one publication, optionally filtered by severity, ordered by
`ordem ASC`. Useful for the FE to render the error-details screen without a separate query per severity.

**Scope:** `pub:read`  
**Query parameter:** `severity` (optional) — one of `error | warning | info`. When omitted all severities are returned.  
**Success — `200 OK`**, body = `ValidationMessageItem[]` (§6.5).

Cross-tenant guard: returns `404` when `publicacaoId` does not exist in the given `projetoId` or the active empresa (schema-per-tenant isolation via `search_path`; never reveals cross-tenant existence).

Acceptance criteria (EARS):

- `WHEN a valid publicacaoId belonging to the active empresa is requested, THE SYSTEM SHALL return its validation messages ordered by ordem ASC.`
- `WHEN the query parameter severity=error is supplied, THE SYSTEM SHALL return only messages whose severity is error.`
- `IF no severity parameter is supplied, THE SYSTEM SHALL return messages of all severities.`
- `IF the publicacaoId does not belong to the projetoId or the active empresa, THEN THE SYSTEM SHALL respond 404 (urn:cordele:pub:publicacao-not-found).`

---

### 4.7 `POST /api/pub/publications/latest-batch` — batch latest publication status per project (PROJ integration)

Returns the latest publication summary for a batch of project IDs in a **single round-trip**.
Used by PROJ's `GetProjetoLibraryUseCase` / `GetProjetoDetailsUseCase` to decorate project cards
with the current publication status without N+1 queries.

**Scope:** `pub:read`  
**Body:** `{ "projetoIds": string[] }` — list of project UUIDs (v4). Empty array is valid. **Max 50 IDs** per request.  
**Success — `200 OK`**, body = `LatestBatchResponseItem[]`.

```
LatestBatchResponseItem {
  projetoId:       string   // UUID of the project
  publicacaoId:    string   // UUID of the latest publication
  epubcheckStatus: string   // valido | avisos | erros_criticos | pendente
}
```

Projects with no publications are **omitted** from the response array (absence = "never published").
The response is **unordered** — consumers must index by `projetoId`.

"Latest" = the publication with the highest `sequencia` per `projetoId`.
Resolution is done in a single `findMany` with `ORDER BY sequencia DESC`,
then the first entry per `projetoId` wins in O(n) in memory.

Acceptance criteria (EARS):

- `WHEN a batch of projetoIds is supplied, THE SYSTEM SHALL return at most one item per projetoId — the one with the highest sequencia.`
- `WHEN a projetoId has no publications, THE SYSTEM SHALL omit it from the response (absence = never published).`
- `WHEN the batch is empty, THE SYSTEM SHALL return an empty array without querying the database.`
- `IF the token carries no empresa claim, THE SYSTEM SHALL respond 403.`
- `WHEN the projetoIds list exceeds 50 items, THE SYSTEM SHALL return 400 with type urn:cordele:pub:validation.`

> **Batch limit:** máximo 50 IDs por requisição (padrão cross-módulo). O consumidor (proj-service)
> deve fatiar listas maiores em blocos de até 50.

---

## 5. Errors (RFC 7807 ProblemDetail)

All errors use `application/problem+json`. `type` is a stable URN; `traceId` mirrors `X-Correlation-Id`.

| `type` (URN) | HTTP | When |
|---|---|---|
| `urn:cordele:pub:validation` | 400 | malformed request |
| `urn:cordele:pub:manuscript-missing` | 409 | export triggered but the project has no imported manuscript |
| `urn:cordele:pub:artifact-not-available` | 409 | download requested for a non-`valido`/`avisos` publication |
| `urn:cordele:pub:metadata-incomplete` | 422 | required metadata (titulo/autor/idioma) missing at export |
| `urn:cordele:pub:status-advance-failed` | 502 | PROJ `advanceTo` rejected/failed the terminal transition |
| `urn:cordele:pub:unauthorized` | 401 | missing/invalid token |
| `urn:cordele:pub:forbidden` | 403 | valid token lacking the required scope |
| `urn:cordele:pub:projeto-not-found` | 404 | projetoId not in the active empresa |
| `urn:cordele:pub:publicacao-not-found` | 404 | publicacaoId not in the project / active empresa |

Example:

```json
{
  "type": "urn:cordele:pub:metadata-incomplete",
  "title": "Editorial metadata is incomplete for export",
  "status": 422,
  "detail": "Cannot generate an ePub without titulo, autor and idioma; compose metadata (T05) first.",
  "instance": "/api/pub/projetos/2f1c.../publicacoes",
  "traceId": "8b1f...c2"
}
```

---

## 6. Schemas

### 6.1 `PublicacaoStatus` (trigger + poll — T07)

```json
{
  "publicacaoId": "uuid",
  "projetoId": "uuid",
  "status": "validando",
  "epubcheckStatus": "pendente",
  "sequencia": 2,
  "totalErros": 0,
  "totalAvisos": 0,
  "resumoErro": null,
  "arquivoDisponivel": false,
  "tamanhoBytes": null,
  "totalCapitulos": null,
  "totalImagens": null,
  "iniciadaEm": "2026-08-25T15:00:00Z",
  "concluidaEm": null
}
```

- `status ∈ {gerando, validando, publicado, com_erros}` — the build-machine state (owned by PUB, ADR-002).
- `epubcheckStatus ∈ {valido, avisos, erros_criticos, pendente}` — the epubcheck verdict (D-Q); `pendente`
  until the build is terminal.
- `arquivoDisponivel` is `true` only when `status=publicado` (`epubcheckStatus ∈ {valido, avisos}`); the
  client then calls §4.4 for the signed URL.
- `resumoErro` is a short human-readable failure summary, non-null only when `com_erros`.
- `tamanhoBytes`, `totalCapitulos`, `totalImagens` are non-null **only** when `status=publicado` (D-S /
  ADR-004) — a build-time snapshot (byte size of the assembled `.epub`; chapter/image counts from the
  `ManuscriptContentPort` walk at that build), never recomputed from the manuscript's current state. There
  is no `paginas`/`pages` field — permanently omitted (D-S), not a future gap.

### 6.2 `PublicacaoHistoryItem` (history read-model — T08; the fixed field set PROJ consumes, D-E/G2)

The canonical shape of one publication row in the history view. **Identical** to the field set PROJ's
`PublicationHistoryPort` returns (proj api-contract §6.3 / integration-contracts §2.3) — this contract is
the authoritative source of that shape.

```json
{
  "publicacaoId": "uuid",
  "projetoId": "uuid",
  "epubcheckStatus": "avisos",
  "totalErros": 0,
  "totalAvisos": 2,
  "erros": null,
  "arquivoUrl": "https://storage.../romance-v2.epub?sig=... | null",
  "criadoEm": "2026-08-19T16:30:00Z"
}
```

- `epubcheckStatus ∈ {valido, avisos, erros_criticos, pendente}` (BA `data-model.json` / ADR-003).
- `erros` is a human-readable summary of critical errors (nullable), surfaced on T08 for `erros_criticos`.
- `arquivoUrl` is `null` for non-downloadable publications (`erros_criticos`/`pendente`); for
  `valido`/`avisos` it is either a placeholder the client resolves via §4.4 or an inlined signed URL when
  TTL policy allows. The download endpoint (§4.4) is the authoritative minting path.
- `criadoEm` maps to the row's `iniciada_em`.

### 6.3 `PublicationStats` (KPI projection — D-O)

```json
{
  "projetoId": "uuid",
  "total": 3,
  "publicadas": 2,
  "comAvisos": 1,
  "comErros": 1,
  "emAndamento": 0,
  "ultimoStatus": "publicado",
  "ultimoEpubcheckStatus": "avisos",
  "ultimaPublicacaoEm": "2026-08-19T16:30:00Z"
}
```

- `publicadas` counts publications whose `status=publicado`; `comAvisos` is the subset with
  `epubcheckStatus=avisos`; `comErros` counts `com_erros`; `emAndamento` counts non-terminal builds.
- `ultimo*` reflect the newest `Publicacao`; `null` when the project has never been exported.

### 6.5 `ValidationMessageItem` (validation detail — PUB-016)

```json
{
  "id": "uuid",
  "severity": "error",
  "code": "OPF-033",
  "message": "Duplicate spine item reference",
  "location": "OEBPS/content.opf#L42",
  "ordem": 0
}
```

- `severity ∈ {error, warning, info}` — epubcheck message class (data-model.md §2.2).
- `code` is the stable epubcheck message id (e.g. `PKG-006`, `OPF-033`).
- `location` is nullable — some epubcheck messages have no file/line reference.
- `ordem` is 0-based insertion order; the list is always returned `ordem ASC`.

### 6.4 Inbound application ports exported by PUB (in-process; not REST)

The public surface other contexts call in-process (ADR-001). These are **not** HTTP endpoints; they are
exported NestJS providers injected by DI token. Contract detail in `contracts/integration-contracts.md`.

| Port | Signature | Caller | Semantics |
|---|---|---|---|
| `PublicationHistoryPort` | `history(projetoId): Promise<PublicacaoHistoryItem[]>` · `latest(projetoIds): Promise<Map<projetoId, PublicacaoHistoryItem>>` · `signedDownloadUrl(publicacaoId): Promise<{ arquivoUrl, expiresAt }>` | PROJ (library/detail/download, D-E/D-F) | read-model over `Publicacao`; batched `latest`; PUB signs via its own `FileStoragePort` |
| `PublicationErasurePort` | `purge(projetoId): Promise<void>` | PROJ (LGPD cascade step 1, G3/D-G) | idempotent delete of `Publicacao` rows **+** ePub artifacts in storage |

- **EARS:** `WHEN PROJ composes project detail or the library badge, THE SYSTEM SHALL serve publications
  through PublicationHistoryPort and never expose the publicacao table.`
- **EARS:** `WHEN PROJ requests a download URL for a valido/avisos publication, THE SYSTEM SHALL mint a
  short-TTL signed URL via signedDownloadUrl and never return the bytes.`
- **EARS:** `WHEN PROJ purges a project (LGPD), THE SYSTEM SHALL delete Publicacao rows and ePub artifacts
  idempotently (purging already-absent data is a no-op).`

---

## 7. Cross-context reads, pre-flight and the build outcome

### 7.1 Export pre-flight (synchronous, before enqueue)

Before enqueuing the job, the trigger validates inputs synchronously so the editor gets an immediate,
actionable rejection rather than a `com_erros` build:

- **Manuscript present:** `ManuscriptContentPort.getContentTree(projetoId)` (IMP) must return non-null,
  else `409 urn:cordele:pub:manuscript-missing`.
- **Required metadata present:** `GetMetadadosUseCase.get(projetoId)` (COMP) must return metadata with
  `titulo`, `autor`, `idioma`, else `422 urn:cordele:pub:metadata-incomplete`.

- **EARS:** `THE SYSTEM SHALL validate manuscript presence and required metadata synchronously before
  enqueuing a build, rejecting with 409/422 and creating no Publicacao when a precondition fails.`

### 7.2 The build job (asynchronous, in-process)

Runs in the triggering request's `EmpresaContext`. Steps (ADR-002 / ADR-003):

1. `gerando`: read inputs — `ManuscriptContentPort.getContentTree` (IMP),
   `GetMetadadosUseCase.get` + `GetConfiguracaoLayoutUseCase.get` (COMP); assemble the OCF/ePub 3 package
   (`EpubBuilder` domain service) honouring only the parameters COMP declares honoured (comp api-contract
   §7.3).
2. `validando`: run `EpubValidationPort.validate(epubBytes)` (epubcheck); persist `validation_message`
   rows; map the verdict to `epubcheckStatus`/`status` (D-Q).
3. terminal: on `publicado`, store the `.epub` via `FileStoragePort` and set `artefatoRef`; on `com_erros`,
   set `resumoErro`. Persist the `Publicacao` outcome.
4. request the project status: `AdvanceProjetoStatusUseCase.advanceTo({ projetoId, targetStatus })` with
   `publicado` | `com_erros` (D-P).
5. dispatch the in-process domain event `PublicationSucceeded` / `PublicationFailed` after commit
   (best-effort; `event-contracts.md`).

- **EARS:** `WHEN the build finishes assembly, THE SYSTEM SHALL run epubcheck through EpubValidationPort and
  set epubcheckStatus/status from its verdict (D-Q) before persisting the terminal Publicacao.`
- **EARS:** `WHEN the terminal outcome is persisted, THE SYSTEM SHALL request PROJ.advanceTo with the mapped
  targetStatus, and IF advanceTo fails THEN THE SYSTEM SHALL record the Publicacao outcome and surface
  status-advance-failed to observability without losing the build result.`
- **EARS:** `IF epubcheck reports only warnings, THEN THE SYSTEM SHALL still publish (status=publicado,
  epubcheckStatus=avisos) with a downloadable artifact (D-Q).`

### 7.3 Notes for the FE Specs phase (M3)

1. **T07 export & validation** triggers §4.1, then polls §4.2 until terminal (D-N — no SSE). Show an
   indeterminate progress indicator while `status ∈ {gerando, validando}`; honour `Retry-After`.
2. **T08 download & history** reads §4.3 (or PROJ's composed `/api/proj/projetos/{id}/publicacoes`), calls
   §4.4 for a signed URL and opens it directly — **never** fetch the bytes through the app (D-F). Disable
   the download button when `arquivoUrl`/`arquivoDisponivel` is null/false.
3. **KPI cards** read §4.5 (D-O). Warnings are a *published* outcome — render `avisos` as success with a
   caveat, not as a failure (D-Q).
4. **Re-export** re-calls §4.1 (new attempt). "Ajustar metadados / layout" is PROJ's reopen
   (`POST /api/proj/projetos/{id}/reopen`), not a PUB endpoint (D-P).
