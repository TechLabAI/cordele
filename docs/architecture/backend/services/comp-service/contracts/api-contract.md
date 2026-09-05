# API Contract — comp-service (Composição)

**Module:** COMP · **Service:** `comp-service` · **Stack:** Node 22 · NestJS 11 · Prisma · PostgreSQL 16
**Base path:** `/api/comp` (served through the single BFF — TECH-003; the frontend never reads storage or DB directly)
**Governing ADRs:** shared `docs/architecture/backend/adr/ADR-001-hexagonal-node.md` (hexagonal boundary),
`ADR-002-modular-monolith.md`, `ADR-003-multi-tenancy.md`; local `adr/ADR-001-service-boundary.md`,
`adr/ADR-002-layout-overrides-not-manuscript-mutation.md`, `adr/ADR-003-cover-binary-storage-port.md`.
EARS acceptance criteria per endpoint follow `docs/architecture/backend/standards/ears-notation.md`.

---

## 0. Authoritative decisions resolved in this contract

Six points were open at the end of the Vision phase (doc 06 gaps G1–G7, M1/M1.5 handoff warnings). They
are resolved here and are **binding on downstream phases** (Backlog, Scaffold) and on the FE Specs phase (M3).

### D-H — Persisted MVP surface: parameters + image-alignment overrides; structural edits deferred (closes G5, reconciles BE ADR-002 ↔ FE ADR-COMP-001)

The Vision left an apparent conflict: BE `ADR-002` models page/image adjustments as `LayoutOverride`
rows referencing the IMP content tree, while FE `ADR-COMP-001` deferred *structural edits*
(`comp.structuralEdits=false`) and persists only *parameters*. The two are reconciled by drawing the line
where it actually is — **presentation parameters vs. structural mutation**:

- **Persisted, writable in the MVP:** the two parameter aggregates `Metadados` and `ConfiguracaoLayout`
  (typography + margins + heading sizes) **plus image-alignment overrides** — a `LayoutOverride` of
  `tipo = imagem` that names an **existing** manuscript image node (`referenciaNo`) and gives it a
  presentation `alinhamento` (`full` | `centralizado` | `junto-esquerda` | `junto-direita`). An alignment
  is a *parameter the PUB stylesheet honours*, not a content edit — it fits ADR-COMP-001's "parameters,
  not rendered output".
- **Modelled but NOT writable in the MVP (deferred):** `LayoutOverride` of `tipo = em-branco` (inserted
  blank pages) and any page add/remove/insert-image toolbar operation. These are genuine *structural*
  changes to the page flow — exactly what FE `comp.structuralEdits=false` switches off. The enum reserves
  `em-branco` (mirroring IMP's D-B "field reserved, MVP never emits" pattern) so the async/structural path
  opens later **without** a schema or payload break; the API **rejects** creating an `em-branco` override
  in the POC (`422 urn:cordele:comp:structural-edit-deferred`).

> **Net:** COMP never mutates the manuscript (BE ADR-002 holds end-to-end); the FE's "structural edits off"
> maps precisely to "no blank-page inserts, no page toolbar". Image alignment is the one page-level knob
> that is a parameter, so it stays in the MVP and PUB honours it. FE Specs (M3) MUST treat the T06 toolbar
> as **alignment-only** (no add/remove page, no insert-image) and keep `structuralEdits=false`.

### D-I — COMP↔PUB read contract is two fixed in-process query ports (closes G2)

Publication reads composition at export time through two **in-process** inbound ports COMP exports —
`GetMetadadosUseCase.get(projetoId)` and `GetConfiguracaoLayoutUseCase.get(projetoId)` — never by touching
COMP tables (§6.5, `integration-contracts.md` §1). Their field sets, the override serialization, and
exactly which parameters the ePub stylesheet honours are **fixed here** (§6.2, §6.3, §7.3) and are binding
on PUB and on the T06 control set (the T06 panel exposes only parameters in the honoured list).

### D-J — Routes are nested under the project (closes point 3)

Every COMP resource is a **singleton child of a project** (one `Metadados`, one `ConfiguracaoLayout` per
`projetoId`) and is only ever addressed by `projetoId`; there is no cross-project `/metadados` collection
to list. Routes are therefore **nested**: `/api/comp/projetos/{projetoId}/metadados`,
`/api/comp/projetos/{projetoId}/layout`, `/api/comp/projetos/{projetoId}/capa`,
`/api/comp/projetos/{projetoId}/preview-context`. This expresses the ownership/scoping, matches the FE
route param `projetoId`, and follows the house style PROJ set for sub-resources
(`/api/proj/projetos/{projetoId}/...`).

### D-K — Preview reads the manuscript in-process, read-only; COMP returns preview *data*, the client renders (closes point 4)

The manuscript content tree is owned by IMP and is **read-only** to COMP. COMP reads it **in-process**
through the domain port `ManuscriptContentPort` (never over HTTP, never writing). COMP exposes
`GET /api/comp/projetos/{projetoId}/preview-context`, which `GetLayoutPreviewUseCase` (doc 04) assembles
from that read-only content tree + the project's `ConfiguracaoLayout` + its overrides and returns as
**data** (JSON), never as rendered HTML/canvas. **Pagination and visual rendering stay client-side**
(FE ADR-COMP-001: the preview is a client-side approximation; PUB owns authoritative fidelity). COMP does
not persist anything derived from the read, and does not proxy manuscript bytes for editing. The same
in-process `ManuscriptContentPort` is used server-side to **validate override references** (`referenciaNo`
must resolve to a live node — invariant, R2/G4).

### D-L — Cover is optional; formats {jpeg,png,webp}; ≤ 10 MB; behind FileStoragePort (closes G6)

`capaUrl` is **optional** — `titulo`, `autor`, `idioma` are the required identity fields (doc 06 A9); a
project may be composed and exported with no cover. When supplied, the cover is uploaded via
`POST .../capa` (multipart), validated (`image/jpeg` | `image/png` | `image/webp`, **≤ 10 MB** =
10485760 bytes), streamed to `FileStoragePort` (local ADR-003), and referenced by `capaUrl`. This mirrors
IMP's storage-port + size-cap pattern (IMP caps manuscripts at 50 MB; a single cover image is capped lower
at 10 MB). Rejections mirror IMP's shapes (`415`/`413`).

### D-M — Two aggregates, lazy defaults (closes G1, G7)

Composition stays **two aggregates** — `Metadados` and `ConfiguracaoLayout` — not one folded `composicao`
row (G7): they have independent lifecycles (metadata filled in T05, layout in T06), independent PUB read
ports (D-I), and independent idempotent upserts. Defaults are created **lazily** (G1): COMP does **not**
consume `ManuscriptImported` (`messaging.enabled=false`; the brief gives COMP no event consumption). A
`GET` on an absent aggregate returns a synthesized **default representation** (`200`, `materialized:false`)
so the form always renders; the row is **materialized on the first `PUT`** (idempotent upsert). This
matches the FE pessimistic-save model (nothing persisted until the editor advances/exports).

---

## 1. Conventions

- **Media type:** `application/json` for requests and responses; `multipart/form-data` for the cover upload.
- **IDs:** UUID v4 (server-generated). Never client-supplied.
- **Timestamps:** RFC 3339 / ISO-8601 UTC (`atualizadoEm`).
- **Errors:** RFC 7807 `application/problem+json` (see §5).
- **Idempotency:** `PUT` metadados / `PUT` layout are **idempotent upserts** keyed by `projetoId`
  (re-sending the same body is a safe no-op that returns the current representation).
- **Project binding:** COMP never creates or writes `projeto_editorial` and never changes its status
  (local ADR-002 boundary / M1 handoff); it is keyed to a `projetoId` PROJ owns. A `projetoId` that does
  not exist in the active empresa yields `404`.

## 2. Authentication, authorization, tenancy

- **Auth:** OAuth2 Bearer JWT (`Authorization: Bearer <token>`). Unauthenticated → `401`.
- **Scopes:** `comp:read` (get metadata, get layout, preview-context), `comp:write` (upsert metadata,
  upload/delete cover, upsert layout).
- **Tenant:** the owning `empresa` is taken **from the JWT claim** and applied via `EmpresaContext`
  (AsyncLocalStorage, RULE-07 / ADR-003). It is **never** read from the path, query or body — including on
  the in-process `GetMetadados`/`GetConfiguracaoLayout` ports, which inherit the caller's `EmpresaContext`.
  - **EARS:** `THE SYSTEM SHALL resolve the tenant schema exclusively from the authenticated principal's
    empresa claim.`
  - **EARS:** `IF a caller references a projetoId that belongs to another empresa, THEN THE SYSTEM SHALL
    respond 404 (never revealing cross-tenant existence).`

## 3. Required headers

| Header | Direction | Notes |
|---|---|---|
| `Authorization: Bearer <jwt>` | request | required on every endpoint |
| `X-Correlation-Id` | request (optional) / response (always) | propagated to logs and pipeline events; generated if absent |
| `Content-Type: application/json` | request | metadata / layout upsert |
| `Content-Type: multipart/form-data` | request | cover upload only |
| `Content-Type: application/problem+json` | response | error responses |

---

## 4. Resources

### 4.1 `GET /api/comp/projetos/{projetoId}/metadados` — read editorial metadata (T05)

Returns the project's `Metadados`. If none has been materialized yet (D-M), returns a **default**
representation (`materialized:false`) so the T05 form renders with empty/typed defaults.

**Scope:** `comp:read` · **Success — `200 OK`**, body = `Metadados` (§6.1).

Acceptance criteria (EARS):

- `WHEN an authenticated editor reads metadata for a project of the active empresa, THE SYSTEM SHALL
  return its Metadados, or a default representation with materialized=false if none exists yet.`
- `IF the projetoId does not exist in the active empresa, THEN THE SYSTEM SHALL respond 404
  (urn:cordele:comp:projeto-not-found).`

### 4.2 `PUT /api/comp/projetos/{projetoId}/metadados` — upsert editorial metadata (T05)

Creates or updates the project's `Metadados` (idempotent upsert keyed by `projetoId`), validates required
fields and the `idioma` enum, persists, and emits `MetadataUpdated`. This backs T05 "advance to layout"
(the FE persists pessimistically before navigating to T06). COMP does **not** change project status.

**Scope:** `comp:write` · **Request:** `application/json`

```json
{ "titulo": "Romance das Cidades", "autor": "Eliana Moraes",
  "isbn": null, "idioma": "pt", "categoria": null }
```

- `titulo` — **required**, non-empty, ≤ 300 chars. `autor` — **required**, non-empty, ≤ 300 chars.
  `idioma` — **required**, ∈ `{pt, en, es, fr}`. `isbn`, `categoria` — optional (`source: mock`, no
  registry lookup). `capaUrl` is **not** set here — it is set only by the cover endpoints (§4.3).
  `editoraNome` is a denormalized display resolved server-side, not client-supplied.

**Success — `200 OK`**, body = `Metadados` (§6.1) with `materialized:true`.

Acceptance criteria (EARS):

- `WHEN an authenticated editor PUTs valid metadata, THE SYSTEM SHALL upsert the Metadados for the project,
  set atualizadoEm=now(), emit MetadataUpdated, and respond 200 with the persisted Metadados.`
- `IF titulo or autor is missing or blank, OR idioma is not in {pt,en,es,fr}, THEN THE SYSTEM SHALL respond
  400 (urn:cordele:comp:validation) and persist nothing.`
- `THE SYSTEM SHALL treat re-sending an identical body as an idempotent no-op returning the current
  Metadados.`
- `THE SYSTEM SHALL NOT write projeto_editorial or change project status on any metadata operation.`

### 4.3 `POST /api/comp/projetos/{projetoId}/capa` — upload cover image (T05, D-L)

Streams the cover binary to `FileStoragePort`, validates type and size, repoints `capaUrl`, persists (the
`Metadados` row is materialized if it did not exist), and emits `MetadataUpdated`. Replacing a cover writes
a new object and repoints `capaUrl` (the previous object is left for the cleanup routine — R5/ADR-003).

**Scope:** `comp:write` · **Request:** `multipart/form-data`

| Part | Type | Required | Notes |
|---|---|---|---|
| `file` | binary | yes | `image/jpeg` \| `image/png` \| `image/webp`; **≤ 10 MB** (10485760 bytes) |

**Success — `201 Created`**, body = `{ "capaUrl": "…", "atualizadoEm": "…" }`.

Acceptance criteria (EARS):

- `WHEN a supported image within the size cap is uploaded, THE SYSTEM SHALL store it via FileStoragePort,
  set capaUrl, emit MetadataUpdated, and respond 201.`
- `IF the file media type is not jpeg/png/webp, THEN THE SYSTEM SHALL respond 415
  (urn:cordele:comp:unsupported-cover-format) and store nothing.`
- `IF the file exceeds 10 MB, THEN THE SYSTEM SHALL respond 413 (urn:cordele:comp:cover-too-large) and
  store nothing.`
- `THE SYSTEM SHALL keep the cover binary out of the relational row (capaUrl reference only, ADR-003).`

### 4.4 `DELETE /api/comp/projetos/{projetoId}/capa` — remove cover (T05)

Clears `capaUrl` (sets it null) and schedules the stored object for cleanup. Idempotent.

**Scope:** `comp:write` · **Success — `204 No Content`**.

- `WHEN an editor removes the cover, THE SYSTEM SHALL set capaUrl=null and emit MetadataUpdated.`
- `IF there is no cover, THE SYSTEM SHALL respond 204 (idempotent no-op).`

### 4.5 `GET /api/comp/projetos/{projetoId}/layout` — read layout configuration (T06)

Returns the project's `ConfiguracaoLayout` (typography + margins + heading sizes + image-alignment
overrides). Returns a **default** representation (`materialized:false`) if none exists yet (D-M).

**Scope:** `comp:read` · **Success — `200 OK`**, body = `ConfiguracaoLayout` (§6.2).

- `WHEN an editor reads layout for a project of the active empresa, THE SYSTEM SHALL return its
  ConfiguracaoLayout, or a default representation (materialized=false) if none exists yet.`
- `IF the projetoId does not exist in the active empresa, THEN THE SYSTEM SHALL respond 404.`

### 4.6 `PUT /api/comp/projetos/{projetoId}/layout` — upsert layout configuration (T06, D-H)

Creates or updates the project's `ConfiguracaoLayout` (idempotent upsert keyed by `projetoId`): typography
within bounds (§7.2), heading sizes, side margin, and the full set of **image-alignment** overrides.
Validates every override's `referenciaNo` against the current manuscript content tree (D-K); rejects
`tipo=em-branco` (structural, deferred — D-H). Persists, emits `LayoutUpdated`. Backs T06 "export" (the FE
persists pessimistically before navigating to PUB). COMP does **not** change project status.

**Scope:** `comp:write` · **Request:** `application/json` (see `ConfiguracaoLayout` §6.2)

**Success — `200 OK`**, body = `ConfiguracaoLayout` (§6.2) with `materialized:true`.

Acceptance criteria (EARS):

- `WHEN an editor PUTs a valid layout, THE SYSTEM SHALL upsert the ConfiguracaoLayout and its overrides,
  set atualizadoEm=now(), emit LayoutUpdated, and respond 200 with the persisted ConfiguracaoLayout.`
- `IF any typography value is outside its bound (§7.2), THEN THE SYSTEM SHALL respond 400
  (urn:cordele:comp:validation) and persist nothing.`
- `IF an override references a manuscript node that does not exist in the current content tree, THEN THE
  SYSTEM SHALL respond 422 (urn:cordele:comp:override-ref-not-found) and persist nothing.`
- `IF an override has tipo=em-branco (structural insertion), THEN THE SYSTEM SHALL respond 422
  (urn:cordele:comp:structural-edit-deferred) — blank-page inserts are deferred in the POC (D-H).`
- `THE SYSTEM SHALL NOT mutate the manuscript content tree on any layout operation (read-only, ADR-002).`

### 4.7 `GET /api/comp/projetos/{projetoId}/preview-context` — preview data for the client renderer (T06, D-K)

Assembles the read-only manuscript content tree (via `ManuscriptContentPort`, in-process) + the project's
`ConfiguracaoLayout` + its overrides into a single **data** payload the SPA renders client-side. Returns
no rendered HTML/canvas and persists nothing. Overrides whose `referenciaNo` no longer resolves in the
current tree are returned with `stale:true` and are excluded from what PUB honours (R2/G4).

**Scope:** `comp:read` · **Success — `200 OK`**, body = `PreviewContext` (§6.4).

- `WHEN an editor opens the preview, THE SYSTEM SHALL return the read-only manuscript content tree, the
  current ConfiguracaoLayout and its overrides as data for client-side rendering.`
- `THE SYSTEM SHALL mark any override whose referenciaNo is absent from the current content tree with
  stale=true and exclude it from the honoured set.`
- `IF the project has no manuscript imported yet, THEN THE SYSTEM SHALL respond 409
  (urn:cordele:comp:manuscript-missing) — there is nothing to preview.`

---

### 4.8 `POST /api/v1/comp/metadata/batch` — batch author metadata query (COMP-017)

**Controller:** `MetadataBatchController` (`src/modules/comp/metadata-batch.controller.ts`).
**Rationale for separate controller:** `CompController` uses `@Controller({ path: 'comp/projetos/:projetoId', … })`
which binds `:projetoId` to every route. The batch endpoint accepts a body list and has no single `projetoId`
in the path, so a dedicated controller at `comp/metadata` is the cleanest solution — it avoids breaking the
7 existing routes.

**Scope:** `comp:read` · **Success — `200 OK`**

**Request body:**
```json
{ "projetoIds": ["<uuid>", "..."] }
```

**Response body:** array of items — only for projects that have a persisted `Metadados` row:
```json
[{ "projetoId": "<uuid>", "autor": "Eliana Moraes" }]
```

**Omission semantics:** projects with no `Metadados` row are absent from the array. The consumer
(`proj-service/CompProjectMetadataAdapter`) indexes the array by `projetoId` and treats a missing entry
as "no metadata" — distinct from a present entry with `autor: null` (row exists, author field blank).
Empty `projetoIds: []` → `[]` (no DB call). Unknown IDs → omitted.

**Batch guarantee:** one `findMany` query via `ProjectMetadataUseCase` regardless of list size (no N+1).
**Multi-empresa:** tenant routing via `EmpresaContextInterceptor` (ALS set from JWT `empresaId`).
**Batch limit:** máximo **50 IDs** por requisição (padrão cross-módulo). Enviar 51+ retorna
`400 Bad Request` com `type: urn:cordele:comp:validation`. O consumidor deve fatiar listas
maiores em blocos de até 50.

- `WHEN PROJ requests batch author metadata, THE SYSTEM SHALL return only projects with a persisted Metadados row in a single query.`
- `WHEN projetoIds is empty, THE SYSTEM SHALL return an empty array without querying the database.`
- `THE SYSTEM SHALL omit projects with no Metadados row rather than returning null-author entries.`
- `WHEN the projetoIds list exceeds 50 items, THE SYSTEM SHALL return 400 with type urn:cordele:comp:validation.`

---

## 5. Errors (RFC 7807 ProblemDetail)

All errors use `application/problem+json`. `type` is a stable URN; `traceId` mirrors `X-Correlation-Id`.

| `type` (URN) | HTTP | When |
|---|---|---|
| `urn:cordele:comp:validation` | 400 | missing/blank titulo or autor, bad idioma, out-of-bounds layout value |
| `urn:cordele:comp:unauthorized` | 401 | missing/invalid token |
| `urn:cordele:comp:forbidden` | 403 | valid token lacking the required scope |
| `urn:cordele:comp:projeto-not-found` | 404 | projetoId not in the active empresa |
| `urn:cordele:comp:manuscript-missing` | 409 | preview requested but no manuscript imported yet |
| `urn:cordele:comp:cover-too-large` | 413 | cover image > 10 MB |
| `urn:cordele:comp:unsupported-cover-format` | 415 | cover is not jpeg/png/webp |
| `urn:cordele:comp:override-ref-not-found` | 422 | override referenciaNo not in the current content tree |
| `urn:cordele:comp:structural-edit-deferred` | 422 | tipo=em-branco (blank-page insert) — deferred (D-H) |

Example:

```json
{
  "type": "urn:cordele:comp:override-ref-not-found",
  "title": "Layout override references a manuscript node that no longer exists",
  "status": 422,
  "detail": "Override referenciaNo 'img-042' is not present in the current manuscript content tree.",
  "instance": "/api/comp/projetos/2f1c.../layout",
  "traceId": "8b1f...c2"
}
```

---

## 6. Schemas

### 6.1 `Metadados`

```json
{
  "projetoId": "uuid",
  "titulo": "Romance das Cidades",
  "autor": "Eliana Moraes",
  "isbn": null,
  "idioma": "pt",
  "categoria": null,
  "capaUrl": "https://storage.../capa-romance.jpg | null",
  "editoraNome": "Editora Aetós | null",
  "atualizadoEm": "2026-08-25T14:31:46Z",
  "materialized": true
}
```

- `idioma ∈ {pt, en, es, fr}` (required; default `pt`). `titulo`, `autor` required.
- `isbn`, `categoria`, `editoraNome` are `source: mock` (BA) — no external registry in the POC.
- `capaUrl` is the `FileStoragePort` reference (ADR-003), `null` when there is no cover (optional, D-L).
- `materialized` is `false` on a default (never-saved) representation (D-M); `true` once persisted.
- **This is exactly the field set `GetMetadadosUseCase` returns to PUB** (D-I), minus `materialized`
  (PUB reads only persisted metadata; §6.5).

### 6.2 `ConfiguracaoLayout`

```json
{
  "projetoId": "uuid",
  "fonteCorpoFamilia": "serif",
  "fonteCorpoTamanho": 12,
  "espacamentoLinha": 1.5,
  "margemLateral": 20,
  "h1Tamanho": 28,
  "h2Tamanho": 22,
  "h3Tamanho": 18,
  "overrides": [
    { "id": "uuid", "referenciaNo": "img-017", "tipo": "imagem",
      "alinhamento": "centralizado", "ordem": 1, "stale": false }
  ],
  "atualizadoEm": "2026-08-25T14:40:00Z",
  "materialized": true
}
```

- Typography bounds in §7.2. `overrides` is the image-alignment set (D-H); MVP `tipo` is always `imagem`.
- On **write** (`PUT`), each override supplies `referenciaNo`, `tipo=imagem`, `alinhamento`, `ordem`
  (`id` is server-assigned). On **read**, `stale` flags overrides whose `referenciaNo` no longer resolves.
- **This is exactly the field set `GetConfiguracaoLayoutUseCase` returns to PUB** (D-I), minus
  `materialized`/`stale` (§6.5); PUB receives only non-stale overrides.

### 6.3 `LayoutOverride` (child of `ConfiguracaoLayout`)

```json
{ "id": "uuid", "referenciaNo": "img-017", "tipo": "imagem",
  "alinhamento": "centralizado", "ordem": 1, "stale": false }
```

- `referenciaNo` — a **read reference** to a node in IMP's content tree (never a write, ADR-002).
- `tipo ∈ {imagem, em-branco}` — `em-branco` reserved for a post-POC structural path; the MVP writes only
  `imagem` and rejects `em-branco` on write (D-H).
- `alinhamento ∈ {full, centralizado, junto-esquerda, junto-direita}` — the presentation parameter PUB's
  stylesheet honours (§7.3); nullable only for `em-branco` (deferred).
- `ordem` — position in the page sequence (int ≥ 0).

### 6.4 `PreviewContext` (client-side render input — D-K)

```json
{
  "projetoId": "uuid",
  "manuscrito": {
    "manuscritoId": "uuid",
    "estrutura": [ "read-only content tree nodes from IMP (chapters → paragraphs, image nodes)" ]
  },
  "layout": { "…": "ConfiguracaoLayout §6.2 (honoured, non-stale overrides applied)" },
  "staleOverrides": [ "LayoutOverride[] whose referenciaNo no longer resolves" ]
}
```

- `manuscrito.estrutura` is the **read-only** content tree obtained via `ManuscriptContentPort`; COMP never
  copies or mutates it. The client paginates and renders (FE ADR-COMP-001); COMP returns data, not pixels.

### 6.5 Inbound application ports exported by COMP (in-process; not REST)

The public surface other contexts call in-process (ADR-001 / D-I / G3). These are **not** HTTP endpoints;
they are exported NestJS providers injected by DI token. Contract detail in `integration-contracts.md`.

| Port | Signature | Caller | Semantics |
|---|---|---|---|
| `GetMetadadosUseCase` | `get(projetoId): Promise<MetadadosRead \| null>` | PUB (export) | persisted `Metadados` (§6.1 minus `materialized`); `null` if never composed |
| `GetConfiguracaoLayoutUseCase` | `get(projetoId): Promise<LayoutRead \| null>` | PUB (export) | persisted `ConfiguracaoLayout` (§6.2), **honoured non-stale overrides only**; `null` if never composed |
| `ProjectMetadataPort` | `metadata(projetoIds): Promise<Map<projetoId, { autor?: string }>>` | PROJ (library/detail) | batched author lookup for T02/T08 cards |
| `CompositionErasurePort` | `purge(projetoId): Promise<void>` | PROJ (LGPD cascade, G3) | idempotent delete of `Metadados`/`ConfiguracaoLayout`/overrides **+** cover binary |

- **EARS:** `WHEN PUB reads composition at export, THE SYSTEM SHALL return the persisted Metadados and
  ConfiguracaoLayout through GetMetadados / GetConfiguracaoLayout, never exposing COMP tables.`
- **EARS:** `WHEN GetConfiguracaoLayout is called, THE SYSTEM SHALL return only non-stale overrides whose
  referenciaNo resolves in the current content tree.`
- **EARS:** `WHEN PROJ purges a project (LGPD), THE SYSTEM SHALL delete COMP rows and the cover binary
  idempotently (purging already-absent data is a no-op).`

---

## 7. Validation, bounds and honoured parameters

### 7.1 Required metadata (doc 06 A9)

- **EARS:** `THE SYSTEM SHALL require titulo, autor and idioma; isbn, categoria and capa are optional.`
- **EARS:** `IF idioma is not in {pt, en, es, fr}, THEN THE SYSTEM SHALL reject with 400.`

### 7.2 Layout bounds (T06 panel; enforced in the domain value objects)

| Field | Type | Bound | Default |
|---|---|---|---|
| `fonteCorpoFamilia` | enum | `serif` \| `sans-serif` | `serif` |
| `fonteCorpoTamanho` | int (px) | 12 – 20 | 12 |
| `espacamentoLinha` | decimal | 1.2 – 2.0 | 1.5 |
| `margemLateral` | int (mm) | 10 – 40 | 20 |
| `h1Tamanho` | int (px) | 14 – 48 | 28 |
| `h2Tamanho` | int (px) | 14 – 48 | 22 |
| `h3Tamanho` | int (px) | 14 – 48 | 18 |

- **EARS:** `THE SYSTEM SHALL reject any layout value outside its bound with 400.`
- **EARS:** `THE SYSTEM SHALL require h1Tamanho ≥ h2Tamanho ≥ h3Tamanho.`

### 7.3 Parameters the PUB ePub stylesheet honours (D-I / G2)

The T06 control set is restricted to exactly these — no control is offered that PUB would ignore
(ADR-COMP-001 mitigation):

- **Typography/margins:** `fonteCorpoFamilia`, `fonteCorpoTamanho`, `espacamentoLinha`, `margemLateral`,
  `h1Tamanho`, `h2Tamanho`, `h3Tamanho`.
- **Per-image presentation:** `LayoutOverride.alinhamento` for `tipo=imagem` (`full` | `centralizado` |
  `junto-esquerda` | `junto-direita`).
- **Not honoured / not offered in the MVP:** blank-page inserts (`tipo=em-branco`, deferred D-H), any
  rendered snapshot, any per-page pixel layout. PUB reproduces the parameters, not a browser render.

- **EARS:** `THE SYSTEM SHALL expose in T06 only parameters PUB's stylesheet honours (§7.3).`
