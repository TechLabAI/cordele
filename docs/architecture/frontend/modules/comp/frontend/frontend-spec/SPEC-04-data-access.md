# SPEC-04 — Data Access — COMP (Composição) — Frontend

> Reconciled with `comp-service/contracts/api-contract.md` §4/§6 (M3). All I/O goes through
> `MetadadosApiService` and `LayoutApiService` (`libs/comp/data-access`) over
> `@cordele/shared/access-http-base`; components never touch `HttpClient`. Facades map responses into the
> VMs of SPEC-03 and publish `signal<T>` via `.asReadonly()`. Tenancy is server-resolved from the JWT
> `empresa` claim (§2) — COMP sends **no** empresa param on the wire.

## 1. Resource master table

| Resource | Endpoint | Service | Facade | Operations | Cache? |
|---|---|---|---|---|---|
| `Metadados` | `GET·PUT /api/comp/projetos/{projetoId}/metadados` | `MetadadosApiService.getMetadados(id)` · `.upsertMetadados(id, body)` | `MetadataFacade` | get, upsert | no (re-fetch on entry) |
| Cover | `POST·DELETE /api/comp/projetos/{projetoId}/capa` | `MetadadosApiService.uploadCapa(id, file)` · `.removeCapa(id)` | `MetadataFacade` | upload, remove | n/a |
| `ConfiguracaoLayout` | `GET·PUT /api/comp/projetos/{projetoId}/layout` | `LayoutApiService.getLayout(id)` · `.upsertLayout(id, body)` | `LayoutFacade` | get, upsert | no |
| `PreviewContext` | `GET /api/comp/projetos/{projetoId}/preview-context` | `LayoutApiService.getPreviewContext(id)` | `LayoutFacade` | get | no (loaded once on entry) |

No client cache: composition edits must reflect what the backend actually stored (a reopen from PROJ may
have loaded a previously published project's values), and there is **no broker** to invalidate a cache
(`messaging.enabled=false`, doc 05 §3). The **live-preview** state is intentionally client-only and ephemeral
until persisted — it is the in-flight edit, not a cache of server data.

> **M3 reconciliation of the Vision draft (doc 05).** The Vision listed a separate
> `GET /api/comp/projetos/{projetoId}/manuscrito/estrutura` fed by a `ManuscriptReadService`. That endpoint
> **does not exist** in the contract. Per api-contract §0 D-K, the SPA reads the whole preview payload
> (content tree + layout + overrides) from **one** endpoint, `GET .../preview-context`, and renders it
> client-side; the manuscript tree is joined server-side in-process via `ManuscriptContentPort`. The FE
> therefore has **no** manuscript-structure service and makes **no** call to `imp-service`. Doc 05 is
> updated by `contracts/backend-api-cross-link.md` §2.

## 2. Facade state machines

### `MetadataFacade` (T05)

```
                 getMetadados(id)
   [loading] ───────────────────────► 200 Metadados (materialized true|false) ─► [ready]
      │                                                              (form hydrated; §6.1)
      └─ 5xx / network ─────────────────────────────────────────────► [error] ──retry──► [loading]

   uploadCapa(id,file): cover.uploading=true ─ POST .../capa ─► 201 {capaUrl} ─► swap objectUrl→capaUrl
                                                              └─ 413/415 ───────► cover.error (inline), form intact
   removeCapa(id):      DELETE .../capa ─► 204 ─► capaUrl=null (idempotent)

   onAdvanceToLayout(): status=saving ─ PUT .../metadados ─► 200 Metadados ─► navigate T06
                                                          └─ 400 validation ─► status=ready, inline field errors (defensive)
                                                          └─ 5xx / network ──► status=ready, error toast, edits preserved
```

### `LayoutFacade` (T06)

```
   [loading] ─ getLayout(id) ⋈ getPreviewContext(id) ─► 200 / 200 ─► [ready]  (panel + single-page canvas)
      │                                               └─ 409 manuscript-missing ─► [empty] (preview empty state)
      └─ 5xx / network ───────────────────────────────────────────────────────► [error] ──retry──► [loading]

   onStyleChange / onAlignmentChange: local signal update only — NO network (live repaint)

   onExport(): saving=true ─ PUT .../layout {params + non-stale overrides} ─► 200 ─► navigate PUB /exportacao-e-validacao
                                       └─ 400 validation ────────────► saving=false (defensive; client clamps §7.2)
                                       └─ 422 override-ref-not-found ─► saving=false, toast, edits preserved
                                       └─ 5xx / network ─────────────► saving=false, error toast, edits preserved
```

- `getLayout` and `getPreviewContext` are issued in parallel on entry (`forkJoin`); a `409` on the preview →
  `empty` state (the panel is still shown so hydration of layout params is not lost). Both facades cancel the
  in-flight request on route leave / empresa change (`switchMap`/`takeUntilDestroyed` at the facade edge).

## 3. Writes and optimistic updates

**No optimistic updates — pessimistic, upsert-idempotent (keyed by `projetoId`).** COMP has exactly two write
aggregates plus the cover:

- **Metadata upsert** (`PUT .../metadados`) on advance: await `200`, then navigate to T06; on failure the
  advance halts and local edits are preserved (nothing to roll back — doc 05 §4).
- **Layout upsert** (`PUT .../layout`) on export: the body carries the typography params **and** the current
  **non-stale** image-alignment overrides (`tipo=imagem` only — the FE never sends `tipo=em-branco`,
  api-contract §0 D-H); await `200`, then navigate to PUB. Stale overrides are dropped from the payload.
- **Cover** (`POST/DELETE .../capa`): resolves a durable `capaUrl` (swapping the transient object-URL) or a
  `204` clear; failures are inline on the drop zone and never block the rest of the form (cover optional, D-L).

Idempotency means a retried save never duplicates an aggregate. Any future auto-save/debounced-persist is
deliberately **out** of the MVP (the write model stays pessimistic).

## 4. Error mapping

BE `ProblemDetail` (RFC 7807) → normalized `AppError` by the ErrorNormalize interceptor → the facade sets the
relevant `status`/`cover.error`/`saving`. The URN → UI mapping is authoritative in SPEC-07.

## Criterios de aceite (EARS)

- `WHEN /projetos/{projetoId}/config is entered or re-entered, THE SYSTEM SHALL issue GET /api/comp/projetos/{projetoId}/metadados and SHALL NOT serve it from a client cache [comp-meta-refetch].`
- `WHEN /projetos/{projetoId}/editor-de-layout-preview is entered, THE SYSTEM SHALL issue GET layout and GET preview-context in parallel and SHALL NOT serve them from a client cache [comp-layout-refetch].`
- `WHEN the editor advances from T05 with valid required fields, THE SYSTEM SHALL PUT the metadata, await 200, and only then navigate to T06 [comp-advance-persist].`
- `IF the metadata PUT fails, THEN THE SYSTEM SHALL halt the advance and preserve the local edits [comp-advance-persist-fail].`
- `WHEN the editor exports from T06, THE SYSTEM SHALL PUT the layout with its non-stale image-alignment overrides, await 200, and only then navigate to PUB [comp-export-persist].`
- `IF the layout PUT fails on export, THEN THE SYSTEM SHALL halt the navigation and preserve the local edits [comp-export-persist-fail].`
- `WHEN a supported cover within the size cap is selected, THE SYSTEM SHALL POST it as multipart and swap the transient object-URL for the returned capaUrl [comp-cover-upload].`
- `WHEN the editor removes the cover, THE SYSTEM SHALL DELETE the cover and clear capaUrl idempotently [comp-cover-remove].`
- `THE SYSTEM SHALL update the live preview and image alignment locally without any network call and SHALL persist only pessimistically on advance/export [comp-no-optimistic].`
- `WHEN the editor changes an image alignment, THE SYSTEM SHALL update the local override set and SHALL write it back only with the layout upsert on export [comp-alignment-writeback].`
