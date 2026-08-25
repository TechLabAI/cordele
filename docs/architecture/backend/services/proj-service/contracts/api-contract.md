# API Contract — proj-service (Projetos)

**Module:** PROJ · **Service:** `proj-service` · **Stack:** Node 22 · NestJS 11 · Prisma · PostgreSQL 16
**Base path:** `/api/proj` (served through the single BFF — TECH-003; the frontend never reads storage or DB directly)
**Governing ADRs:** shared `docs/architecture/backend/adr/ADR-001-hexagonal-node.md` (hexagonal boundary),
`ADR-002-modular-monolith.md`, `ADR-003-multi-tenancy.md`; local `adr/ADR-001-service-boundary.md`,
`adr/ADR-002-project-status-authority.md`, `adr/ADR-003-publication-history-read-model.md`.
EARS acceptance criteria per endpoint follow `docs/architecture/backend/standards/ears-notation.md`.

---

## 0. Authoritative decisions resolved in this contract

Four gaps were open at the end of the Vision phase (doc 06 G1–G7, M1 handoff warnings). They are
resolved here and are **binding on downstream phases** (Backlog, Scaffold) and on the FE Specs phase.

### D-D — Status authority is a port with a fixed transition table + explicit reopen (closes G6)

`AdvanceProjetoStatusUseCase.advanceTo({ projetoId, targetStatus })` is the **only** way IMP and PUB
move a project forward through its lifecycle; it is **idempotent and never regresses** (ADR-002). The one
*backward* edge an editor legitimately needs — re-opening a `publicado`/`com_erros` project for a new
revision (G6) — is a **separate, explicitly-named** use case `ReopenProjectForRevisionUseCase.reopen`,
**not** an overload of `advanceTo`. This keeps `advanceTo` deterministic for its two automated callers
(IMP, PUB) while giving the editor an unambiguous, auditable "reopen" action. Full table in §7.

### D-E — Publication history is read from PUB via `PublicationHistoryPort` (closes G2)

Project detail and the T08 history screen are assembled at read time from PUB's `Publicacao` records
through the outbound `PublicationHistoryPort` (ADR-003). The field set returned per publication, its
ordering, and download-link resolution are **fixed here** (§6.3, §6.5). PROJ stores no publication rows.

### D-F — ePub download is a signed URL minted by PUB; the SPA never proxies bytes (closes point 5)

`GET /api/proj/projetos/{projetoId}/publicacoes/{publicacaoId}/download` returns a **short-TTL signed
URL** to the artifact in object storage. The bytes are served **directly by object storage**, never
streamed through PROJ or the BFF. Only publications whose `epubcheckStatus ∈ {valido, avisos}` have a
downloadable artifact; `erros_criticos`/`pendente` have `arquivoUrl = null` and are not downloadable.

### D-G — Deletion / LGPD erasure is an orchestrated leaf-first cross-context cascade (closes G3)

`DELETE /api/proj/projetos/{projetoId}` runs an **in-process, leaf-first, idempotent** purge across PUB,
COMP and IMP (rows **and** binaries/artifacts) **before** deleting the `projeto_editorial` identity row.
The DB `ON DELETE CASCADE` FKs declared by the other contexts are the integrity backstop, not the erasure
mechanism (storage binaries are not in the DB). Order, idempotency and failure semantics in §4.6 and
`spec/backend/SPEC-11-cross-context-deletion-lgpd-erasure.md`.

---

## 1. Conventions

- **Media type:** `application/json` for requests and responses.
- **IDs:** UUID v4 (server-generated). Never client-supplied.
- **Timestamps:** RFC 3339 / ISO-8601 UTC (`criadoEm`, `atualizadoEm`).
- **Errors:** RFC 7807 `application/problem+json` (see §5).
- **Idempotency:** status transitions are idempotent by construction (§7); `DELETE` is idempotent
  (re-deleting an absent project is a `404`, but each per-context purge step is a safe no-op).

## 2. Authentication, authorization, tenancy

- **Auth:** OAuth2 Bearer JWT (`Authorization: Bearer <token>`). Unauthenticated → `401`.
- **Scopes:** `proj:read` (list, detail, history, download-url), `proj:write` (create, reopen),
  `proj:delete` (LGPD erasure — privileged).
- **Tenant:** the owning `empresa` is taken **from the JWT claim** and applied via `EmpresaContext`
  (AsyncLocalStorage, RULE-07 / ADR-003). It is **never** read from the path, query or body — including
  on the in-process `advanceTo` port, which inherits the caller's `EmpresaContext`.
  - **EARS:** `THE SYSTEM SHALL resolve the tenant schema exclusively from the authenticated principal's
    empresa claim.`
  - **EARS:** `IF a caller references a projetoId that belongs to another empresa, THEN THE SYSTEM SHALL
    respond 404 (never revealing cross-tenant existence).`

## 3. Required headers

| Header | Direction | Notes |
|---|---|---|
| `Authorization: Bearer <jwt>` | request | required on every endpoint |
| `X-Correlation-Id` | request (optional) / response (always) | propagated to logs and pipeline events; generated if absent |
| `Content-Type: application/json` | request | create / reopen |
| `Content-Type: application/problem+json` | response | error responses |

---

## 4. Resources

### 4.1 `POST /api/proj/projetos` — create an editorial project

Creates a `ProjetoEditorial` in status `rascunho` for the active empresa, emits `ProjectCreated`, and
returns the new project. This is the "Novo projeto" action (T02 → T03). The same domain use case backs
the in-process `CreateProjetoEditorialUseCase` port that IMP calls in the create-and-upload flow (D-C).

**Scope:** `proj:write` · **Request:** `application/json`

```json
{ "nome": "Romance das Cidades", "descricao": "optional" }
```

- `nome` — required, non-empty, ≤ 200 chars. `descricao` — optional.
- `editoraId` is **not** in the body; it is resolved from the tenant claim.

**Success — `201 Created`**, body = `ProjetoDetail` (§6.1) with `status = "rascunho"`,
`Location: /api/proj/projetos/{id}`.

Acceptance criteria (EARS):

- `WHEN an authenticated editor POSTs a valid nome, THE SYSTEM SHALL create a ProjetoEditorial in status
  rascunho owned by the active empresa, emit ProjectCreated, and respond 201 with the ProjetoDetail.`
- `IF nome is missing or empty, THEN THE SYSTEM SHALL respond 400 (urn:cordele:proj:validation) and
  persist nothing.`
- `THE SYSTEM SHALL set editoraId from the authenticated principal's empresa claim, never from the body.`

### 4.2 `GET /api/proj/projetos` — project library (T02)

Lists the projects of the active empresa (newest activity first) with the composed fields the library
cards render: status badge, chapter/image counts (from IMP's latest manuscript), last epubcheck outcome
(from PUB's latest publication), author (from COMP metadata) and last activity. Cross-context fields are
resolved through outbound read ports in a **single batched read** (no N+1 — §6.4, SPEC-03).

**Scope:** `proj:read` · **Query:** `?status=<enum>` (optional filter), `?limit`/`?cursor` (optional
pagination; POC default returns all — G5). **Success — `200 OK`**, body = `ProjetoCard[]` (§6.2).

Acceptance criteria (EARS):

- `WHEN an authenticated editor lists projects, THE SYSTEM SHALL return the projects of the active empresa
  ordered by ultimaAtividadeEm descending, each as a ProjetoCard.`
- `THE SYSTEM SHALL populate each card's totalCapitulos/totalImagens from the project's latest manuscript
  (ManuscriptSummaryPort) and ultimoEpubcheckStatus from the project's latest publication
  (PublicationHistoryPort).`
- `WHERE a project has no manuscript yet, THE SYSTEM SHALL return totalCapitulos=0, totalImagens=0 and a
  status badge of rascunho.`
- `IF a cross-context read port is unavailable, THEN THE SYSTEM SHALL still return each project's own
  identity and status and mark the degraded fields null` (degrade, never fail the library — SPEC-07).
- `WHERE the status query parameter is supplied, THE SYSTEM SHALL return only projects in that status.`

### 4.3 `GET /api/proj/projetos/{projetoId}` — project detail

Composes the project's own identity + status with the manuscript summary (IMP), the metadata/author
(COMP) and the publication history (PUB) — the aggregate behind the T08 header and detail view.

**Scope:** `proj:read` · **Success — `200 OK`**, body = `ProjetoDetail` (§6.1).

- `WHEN an existing projetoId of the active empresa is requested, THE SYSTEM SHALL return its ProjetoDetail
  including status, manuscriptSummary, metadata and publicationHistory.`
- `IF the projetoId does not exist in the active empresa, THEN THE SYSTEM SHALL respond 404.`
- `IF the PUB read is unavailable, THEN THE SYSTEM SHALL return detail with publicationHistory=[] and
  degraded=true, still rendering the authoritative status.`

### 4.4 `GET /api/proj/projetos/{projetoId}/publicacoes` — publication history (T08)

The read-side publication history for one project, newest first, assembled from PUB's `Publicacao`
records via `PublicationHistoryPort` (ADR-003 / D-E). Serves the T08 "Histórico de exportações" list.

**Scope:** `proj:read` · **Success — `200 OK`**, body = `PublicacaoHistoryItem[]` (§6.3).

- `WHEN an existing projetoId of the active empresa is requested, THE SYSTEM SHALL return its publications
  ordered by criadoEm descending (possibly empty), each with epubcheckStatus, totalErros, totalAvisos
  and a download reference.`
- `THE SYSTEM SHALL set arquivoUrl to null for any publication whose epubcheckStatus is erros_criticos or
  pendente (no downloadable artifact).`
- `IF the projetoId belongs to another empresa or does not exist, THEN THE SYSTEM SHALL respond 404.`

### 4.5 `GET /api/proj/projetos/{projetoId}/publicacoes/{publicacaoId}/download` — signed download URL (D-F)

Mints a short-TTL signed URL to the ePub artifact in object storage. The client opens the URL directly;
**PROJ never streams the bytes** (point 5). PUB owns the artifact and signs it via its `FileStoragePort`;
PROJ calls `PublicationHistoryPort.signedDownloadUrl`.

**Scope:** `proj:read` · **Success — `200 OK`**:

```json
{ "publicacaoId": "uuid", "arquivoUrl": "https://storage.../romance-v2.epub?sig=...", "expiresAt": "2026-08-25T15:10:00Z" }
```

- `WHEN a download is requested for a publication whose epubcheckStatus is valido or avisos, THE SYSTEM
  SHALL return a short-TTL signed URL to the artifact and never proxy the bytes.`
- `IF the publication's epubcheckStatus is erros_criticos or pendente, THEN THE SYSTEM SHALL respond 409
  (urn:cordele:proj:artifact-not-available).`
- `IF the publicacaoId does not belong to the projetoId or the active empresa, THEN THE SYSTEM SHALL
  respond 404.`

### 4.6 `DELETE /api/proj/projetos/{projetoId}` — delete / LGPD erasure (D-G)

Deletes the project and **cascades an orchestrated, leaf-first, in-process purge** across PUB, COMP and
IMP (rows **and** stored binaries/artifacts) before removing the `projeto_editorial` identity row; emits
`ProjectDeleted` after commit. Full order and failure semantics in SPEC-11.

**Scope:** `proj:delete` · **Success — `204 No Content`**.

Purge order (leaf-first; each step idempotent):

1. `PublicationErasurePort.purge(projetoId)` — PUB deletes `Publicacao` rows **and** ePub/PDF artifacts.
2. `CompositionErasurePort.purge(projetoId)` — COMP deletes `Metadados`/`ConfiguracaoLayout` rows.
3. `ManuscriptErasurePort.purge(projetoId)` — IMP deletes `manuscrito` rows **and** binaries/images.
4. PROJ deletes `projeto_editorial` (and its `projeto_status_historico`) last.

Acceptance criteria (EARS):

- `WHEN an authorized principal DELETEs an existing project, THE SYSTEM SHALL purge PUB, COMP and IMP data
  (rows and stored binaries) in leaf-first order, then delete projeto_editorial, then emit ProjectDeleted,
  and respond 204.`
- `THE SYSTEM SHALL treat each per-context purge as idempotent so a retried deletion after a partial
  failure completes without error.`
- `IF any per-context purge fails, THEN THE SYSTEM SHALL abort before deleting projeto_editorial, leave the
  project existing (recoverable), and respond 502 (urn:cordele:proj:erasure-failed).`
- `IF the projetoId does not exist in the active empresa, THEN THE SYSTEM SHALL respond 404.`

---

## 5. Errors (RFC 7807 ProblemDetail)

All errors use `application/problem+json`. `type` is a stable URN; `traceId` mirrors `X-Correlation-Id`.

| `type` (URN) | HTTP | When |
|---|---|---|
| `urn:cordele:proj:validation` | 400 | malformed request (missing/empty nome, unknown targetStatus) |
| `urn:cordele:proj:illegal-status-transition` | 409 | requested transition is not in the legal table (§7) |
| `urn:cordele:proj:artifact-not-available` | 409 | download requested for a non-valid publication |
| `urn:cordele:proj:erasure-failed` | 502 | a cross-context purge step failed; deletion aborted |
| `urn:cordele:proj:unauthorized` | 401 | missing/invalid token |
| `urn:cordele:proj:forbidden` | 403 | valid token lacking the required scope |
| `urn:cordele:proj:not-found` | 404 | projetoId/publicacaoId not in active empresa |

Example:

```json
{
  "type": "urn:cordele:proj:illegal-status-transition",
  "title": "Illegal project status transition",
  "status": 409,
  "detail": "Cannot advance from 'rascunho' to 'publicado'; composition must precede publication.",
  "instance": "/api/proj/projetos/2f1c.../status",
  "traceId": "8b1f...c2"
}
```

---

## 6. Schemas

### 6.1 `ProjetoDetail`

```json
{
  "id": "uuid",
  "editoraId": "uuid",
  "nome": "Romance das Cidades",
  "descricao": "optional or null",
  "status": "publicado",
  "criadoEm": "2026-06-10T09:00:00Z",
  "atualizadoEm": "2026-06-19T16:30:00Z",
  "manuscriptSummary": {
    "manuscritoId": "uuid | null",
    "nomeArquivo": "romance.docx",
    "formato": "docx",
    "totalCapitulos": 18,
    "totalImagens": 3,
    "trechosNaoParseados": 0,
    "criadoEm": "2026-06-10T09:05:00Z"
  },
  "metadata": { "autor": "Eliana Moraes" },
  "publicationHistory": [ "PublicacaoHistoryItem — see §6.3" ],
  "degraded": false
}
```

- `status ∈ {rascunho, em_composicao, publicado, com_erros}` — authoritative; PROJ is the only writer.
- `manuscriptSummary` is `null` while the project has no imported manuscript (rascunho).
- `metadata.autor` is `null` until COMP has composed metadata for the project.
- `degraded` is `true` when any cross-context read port was unavailable (SPEC-07).

### 6.2 `ProjetoCard` (library — T02)

```json
{
  "id": "uuid",
  "nome": "Romance das Cidades",
  "autor": "Eliana Moraes",
  "status": "publicado",
  "totalCapitulos": 18,
  "totalImagens": 3,
  "ultimoEpubcheckStatus": "avisos",
  "ultimaAtividadeEm": "2026-06-19T16:30:00Z",
  "criadoEm": "2026-06-10T09:00:00Z"
}
```

- `ultimoEpubcheckStatus ∈ {valido, avisos, erros_criticos, pendente} | null` — from the latest
  `Publicacao`; `null` when the project has never been exported.
- The status **badge** the card renders is derived: `rascunho`/`em_composicao` show the project status;
  once a publication exists, the badge reflects `ultimoEpubcheckStatus` (matches the prototype legend
  "Válido · N avisos · N erros · Rascunho").
- `autor` is `null` until COMP metadata exists.

### 6.3 `PublicacaoHistoryItem` (read-model over PUB — ADR-003 / D-E)

The canonical shape of one publication row in the history view, projected from PUB's `Publicacao`. Field
set fixed by agreement with PUB (closes G2).

```json
{
  "publicacaoId": "uuid",
  "projetoId": "uuid",
  "epubcheckStatus": "avisos",
  "totalErros": 0,
  "totalAvisos": 2,
  "erros": null,
  "arquivoUrl": "https://storage.../romance-v2.epub?sig=... | null",
  "criadoEm": "2026-06-19T16:30:00Z"
}
```

- `epubcheckStatus ∈ {valido, avisos, erros_criticos, pendente}` (matches BA `data-model.json` / ADR-003).
- `erros` is a human-readable summary of critical errors (nullable), surfaced on T08 for `erros_criticos`.
- `arquivoUrl` in the **history list** is either `null` (non-downloadable) or a **placeholder marker** the
  client resolves to a signed URL via §4.5; the list endpoint MAY inline a signed URL when TTL policy
  allows, but the download endpoint (§4.5) is the authoritative minting path (D-F).

### 6.4 Cross-context read composition (no N+1)

`ProjetoCard[]` and `ProjetoDetail` are composed from PROJ's own aggregate plus outbound read ports. For
the library, the ports are called **once with the full set of projetoIds** for the page, not once per
project (SPEC-03):

- `ManuscriptSummaryPort.summaries(projetoIds): Map<projetoId, ManuscriptSummary>` (IMP).
- `PublicationHistoryPort.latest(projetoIds): Map<projetoId, PublicacaoHistoryItem>` (PUB).
- `ProjectMetadataPort.metadata(projetoIds): Map<projetoId, { autor? }>` (COMP).

- `THE SYSTEM SHALL resolve library cross-context fields with a bounded number of port calls independent
  of the number of projects (batched by projetoId set), never one call per card.`

### 6.5 Inbound application ports exported by PROJ (in-process; not REST)

These are the public surface other contexts call in-process (ADR-001 / D-C). They are **not** HTTP
endpoints; they are exported NestJS providers injected by DI token. Contract detail in
`contracts/integration-contracts.md`.

| Port | Signature | Caller | Semantics |
|---|---|---|---|
| `CreateProjetoEditorialUseCase` | `create({ titulo }): Promise<{ projetoId }>` | IMP (create-and-upload, D-C) | creates in `rascunho`; `titulo` sets `projeto_editorial.nome` |
| `ProjetoEditorialLookup` | `exists(projetoId): Promise<boolean>` | IMP (validate `projetoId`) | tenant-scoped existence check |
| `AdvanceProjetoStatusUseCase` | `advanceTo({ projetoId, targetStatus }): Promise<{ projetoId, newStatus, changed }>` | IMP (`em_composicao`), PUB (`publicado`/`com_erros`) | legal-transition table + idempotency (§7) |
| `ReopenProjectForRevisionUseCase` | `reopen({ projetoId }): Promise<{ projetoId, newStatus, changed }>` | editor (REST §4.7) / COMP | the one explicit backward edge to `em_composicao` (G6) |

### 4.7 `POST /api/proj/projetos/{projetoId}/reopen` — reopen for a new revision (G6)

Editor-facing action behind T08's "Ajustar metadados / Ajustar layout": returns a `publicado` or
`com_erros` project to `em_composicao` for a new revision. Backs `ReopenProjectForRevisionUseCase`.

**Scope:** `proj:write` · **Request body:** empty · **Success — `200 OK`**, body = `ProjetoDetail`.

- `WHEN an editor reopens a project whose status is publicado or com_erros, THE SYSTEM SHALL set its
  status to em_composicao, emit ProjectStatusChanged, and respond 200 with the ProjetoDetail.`
- `IF the project is already em_composicao, THE SYSTEM SHALL respond 200 without change (idempotent).`
- `IF the project is in rascunho, THEN THE SYSTEM SHALL respond 409 (urn:cordele:proj:illegal-status-transition).`

---

## 7. Status authority — the legal-transition table (ADR-002 / D-D)

The transition rules live in the `ProjectStatus` value object; no controller or adapter re-encodes them.
`advanceTo` is the forward/lateral, idempotent path for IMP and PUB; `reopen` is the single deliberate
backward edge for the editor (G6).

**Status set (fixed, doc 06 A6):** `rascunho`, `em_composicao`, `publicado`, `com_erros`.

**Legal transitions**

| From | To | Trigger | Via |
|---|---|---|---|
| `rascunho` | `em_composicao` | IMP confirms structure (`confirm-estrutura`) | `advanceTo` |
| `em_composicao` | `publicado` | PUB export valid / with warnings | `advanceTo` |
| `em_composicao` | `com_erros` | PUB export failed epubcheck (critical) | `advanceTo` |
| `publicado` | `com_erros` | a later PUB export failed | `advanceTo` |
| `com_erros` | `publicado` | a later PUB export succeeded | `advanceTo` |
| `publicado` | `em_composicao` | editor opens a new revision | `reopen` |
| `com_erros` | `em_composicao` | editor recovers / adjusts | `reopen` |

**Idempotency (successful no-op, `changed=false`, no event):**

- `IF targetStatus equals the current status, THEN THE SYSTEM SHALL return changed=false without emitting
  an event.`
- `IF advanceTo targets em_composicao WHILE the project is already em_composicao, publicado or com_erros,
  THEN THE SYSTEM SHALL return changed=false and never regress` (matches IMP `confirm-estrutura`; the
  deliberate regression is `reopen`, not `advanceTo`).

**Rejections (`urn:cordele:proj:illegal-status-transition`, 409 over REST / thrown to in-process caller):**

- `IF advanceTo targets publicado or com_erros WHILE the project is in rascunho, THEN THE SYSTEM SHALL
  reject the transition (composition must precede publication).`
- `IF any transition targets rascunho, THEN THE SYSTEM SHALL reject it (rascunho is an initial-only state).`
- `IF targetStatus is not one of {em_composicao, publicado, com_erros}, THEN THE SYSTEM SHALL respond 400
  (urn:cordele:proj:validation).`

**Event + audit:**

- `WHEN a transition actually changes the status, THE SYSTEM SHALL persist the change, append a
  projeto_status_historico row (from/to/requestedBy), and emit exactly one ProjectStatusChanged.`
- `WHEN the caller is IMP or PUB, THE SYSTEM SHALL apply the change within the caller's EmpresaContext and
  the same request/transaction (in-process, ADR-001).`

---

## 8. Notes for the FE Specs phase

1. **T02 library** reads `GET /api/proj/projetos`; render the badge from the derived rule in §6.2
   (project status for rascunho/em_composicao; `ultimoEpubcheckStatus` once a publication exists).
2. **T08 download & history** reads `GET /api/proj/projetos/{id}` (header) and
   `GET /api/proj/projetos/{id}/publicacoes` (list). The download button calls §4.5 to get a signed URL
   and opens it directly — **never** fetch the bytes through the app (D-F). Disable the button when
   `arquivoUrl` is null (`erros_criticos`/`pendente`).
3. **Reopen** ("Ajustar metadados / layout") calls §4.7; status flips to `em_composicao`.
4. FE `ADR-PROJ-001` (server-authoritative state) is confirmed by this contract: the SPA re-fetches on
   (re)entry to the library/detail; there is no cross-module cache (no broker to invalidate).
