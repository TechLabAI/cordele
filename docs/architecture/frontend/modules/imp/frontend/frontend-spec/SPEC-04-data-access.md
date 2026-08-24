# SPEC-04 — Data Access — IMP (Importação) — Frontend

> All I/O goes through `ManuscriptApiService` (`libs/imp/data-access`) built on
> `@cordele/shared/access-http-base` (interceptors inject `X-Correlation-Id` + `X-Empresa-Id` and
> normalize `ProblemDetail` → `AppError`). Components never touch `HttpClient`. Endpoints, methods
> and schemas are **owned by** `api-contract.md` — this spec references them, it does not redefine
> them. Cross-link: `contracts/backend-api-cross-link.md`.

## 1. Resource master table

| Resource | Endpoint | Service | Facade | Operations | Cache? |
|---|---|---|---|---|---|
| Manuscript (upload+parse) | `POST /api/imp/manuscripts` (`multipart/form-data`) | `ManuscriptApiService.upload()` | `ImportFacade` | create (synchronous parse) | no |
| Manuscript (read one) | `GET /api/imp/manuscripts/{manuscritoId}` | `ManuscriptApiService.getById()` | `ReviewFacade` | get (reload/deep-link only) | no |
| Content tree | `GET /api/imp/manuscripts/{manuscritoId}/estrutura` | `ManuscriptApiService.getEstrutura()` | `ReviewFacade` | get (large-tree refetch) | no |
| Import history | `GET /api/imp/projetos/{projetoId}/manuscritos` | `ManuscriptApiService.listByProjeto()` | `ImportFacade` (re-import context) | list | no |

There is **no** `POST .../fragments/{id}/ignore` and **no** `POST .../confirm` endpoint in
`api-contract.md`. See §5 for how ignore/confirm are handled given the current contract.

## 2. Upload operation (the load-bearing one — ADR-IMP-001)

```ts
// ManuscriptApiService (libs/imp/data-access)
upload(input: {
  file: File;
  projetoTitulo?: string;   // exactly one of these two (D-C)
  projetoId?: string;
}): Observable<HttpEvent<ManuscritoDetail>>;   // reportProgress:true, observe:'events'
```

- Builds `FormData` with `file` + **exactly one** of `projetoTitulo` | `projetoId`. If the caller
  supplies neither or both, the **facade** rejects locally before any request (mirrors the server's
  `400 invalid-project-binding`, saving a round-trip).
- Uses `observe: 'events'` + `reportProgress: true` so `ImportFacade` can drive the two-phase
  indicator: `HttpEventType.UploadProgress` → `state='uploading'`, `progressPct = 100*loaded/total`;
  once upload reaches 100% but no response yet → `state='parsing'` (indeterminate); `HttpResponse`
  (201) → `state='done'`, capture `manuscritoId`+`projetoId`, hand the body to `ReviewFacade`.
- **Timeout:** a generous per-request timeout (`~120 s`, config token `IMP_UPLOAD_TIMEOUT_MS`)
  overrides any shorter default; on timeout the facade maps to the same `error` state as `5xx`.
- **Cancellation:** the subscription is torn down on empresa switch or navigation-away (the Access
  Layer also cancels in-flight requests scoped to the previous empresa).
- **No polling, no `parseJobId`** — the `201` body **is** the parse result.

### `ImportFacade` state machine

```
idle --submit(valid)--> uploading --(upload 100%, awaiting response)--> parsing --201--> done --> navigate T04
idle --submit(invalid binding)--> error(local, no request)
uploading|parsing --4xx/5xx/timeout--> error --retry()--> idle
```

Upload is **not** optimistic — it waits for the server (state-advancing, authoritative).

## 3. Read operations (T04 hydration)

- **Happy path:** T04 is hydrated **directly** from the `POST` response via
  `ReviewFacade.hydrateFrom(detail)` — **zero** additional requests.
- **Deep-link / reload:** entering `/imp/manuscritos/:manuscritoId/revisao` with no in-memory state
  triggers **one** `ReviewFacade.load(manuscritoId)` → `GET /api/imp/manuscripts/{manuscritoId}`
  (`status='loading' → 'ready'`). This is a plain read, **never** a poll.
- `getEstrutura()` is reserved for refetching an oversized tree separately from the summary; not on
  the default T04 path.

## 4. DTOs

Consumed as-is from `api-contract.md` §6: `ManuscritoDetail` (§6.1), `ContentTree` + `Block` union
(§6.2), `UnparsedSegment` taxonomy (§6.3), `ManuscritoSummary` (§6.4). FE mapping to VMs is in
SPEC-03 §3–§4. FE declares matching `readonly` TypeScript interfaces in `libs/imp/data-access/models`
that structurally match the contract; drift is caught by the cross-link check.

## 5. Ignore / Confirm — reconciled with the current contract

`api-contract.md` exposes **no** ignore or confirm endpoint. Until the BE contract adds them (flagged
to M4/backlog), the FE behaviour is:

- **`ignoreFragment(id)`** is a **client-only, optimistic** state change on `TrechoVM.ignorado`
  (marks the fragment ignored in the review VM). There is no server call in the MVP; the "rollback"
  path is therefore inert unless/until a server endpoint exists. This is recorded as a **gap for
  M4** (see SPEC-08 and the warnings): the editor's ignore decision is not yet persisted server-side.
- **`confirmStructure()`** likewise has no `POST .../confirm` in the contract. In the MVP the confirm
  action performs the **navigation handoff to COMP** (passing `projetoId`); the authoritative
  project-status advance (`rascunho → em_composicao`) belongs to a BE endpoint **not yet contracted**
  and is a **gap for M4**. The FE must not fabricate a call to a non-existent endpoint.

> This keeps SPEC-04 honest against the authoritative contract (command rule: "não redefinir
> contratos do BE — apenas referenciá-los"). Doc 05 §2 previously drafted ignore/confirm endpoints;
> those drafts are **not** in the ratified `api-contract.md` and are downgraded to M4 backlog items.

## Criterios de aceite (EARS)

- `WHEN the editor submits a valid import, THE SYSTEM SHALL send exactly one POST to /api/imp/manuscripts with the file and exactly one of projetoTitulo or projetoId [imp-sync-post].`
- `IF the upload request carries neither projetoTitulo nor projetoId, OR carries both, THEN THE SYSTEM SHALL reject it client-side and SHALL NOT send the request [imp-invalid-binding].`
- `WHILE the upload bytes are transferring, THE SYSTEM SHALL update progressPct from HttpClient upload-progress events [imp-sync-post].`
- `WHEN the upload bytes have fully transferred but the response has not arrived, THE SYSTEM SHALL switch to the indeterminate parsing indicator without issuing any further request [imp-parse-indeterminate].`
- `WHEN the upload responds 201, THE SYSTEM SHALL hydrate the review view-model directly from the response body without issuing a follow-up GET [imp-hydrate-direct].`
- `IF the upload request exceeds the configured client timeout, THEN THE SYSTEM SHALL transition to the error state with a retry affordance and SHALL cancel the request [imp-timeout].`
- `WHEN the review route is entered without in-memory state, THE SYSTEM SHALL issue exactly one GET on the manuscritoId to hydrate and SHALL NOT poll [imp-deeplink-single-get].`
- `WHEN the active empresa changes during an in-flight upload, THE SYSTEM SHALL cancel the request and SHALL NOT hydrate the review view-model from its late response [imp-empresa-cancel].`
- `WHEN the editor ignores a fragment, THE SYSTEM SHALL mark it ignored optimistically in the review view-model [imp-ignore-optimistic].`
- `IF a server ignore endpoint exists and rejects the ignore, THEN THE SYSTEM SHALL revert the fragment to not-ignored and surface a feedback toast [imp-ignore-rollback].`
