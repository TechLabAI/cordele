# SPEC-04 — Data Access — PROJ (Projetos) — Frontend

> Reconciled with `proj-service/contracts/api-contract.md` §4/§6 (M3). All I/O goes through
> `ProjetoApiService` (`libs/proj/data-access`) over `@cordele/shared/access-http-base`; components never
> touch `HttpClient`. Facades map responses into the VMs of SPEC-03 and publish `signal<T>` via
> `.asReadonly()`. Tenancy is server-resolved from the JWT `empresa` claim (§2) — PROJ sends **no**
> empresa param on the wire.

## 1. Resource master table

| Resource | Endpoint | Service | Facade | Operations | Cache? |
|---|---|---|---|---|---|
| `ProjetoCard[]` (library) | `GET /api/proj/projetos` | `ProjetoApiService.listProjetos()` | `LibraryFacade` | list | no (re-fetch on entry, ADR-PROJ-001) |
| `ProjetoDetail` | `GET /api/proj/projetos/{projetoId}` | `ProjetoApiService.getProjeto(id)` | `HistoryFacade` | get | no |
| `PublicacaoHistoryItem[]` | `GET /api/proj/projetos/{projetoId}/publicacoes` | `ProjetoApiService.listPublicacoes(id)` | `HistoryFacade` | list | no |
| Signed download URL | `GET /api/proj/projetos/{projetoId}/publicacoes/{publicacaoId}/download` | `ProjetoApiService.resolveDownloadUrl(id, pid)` | both facades | get | no (short-TTL, minted per click) |
| Reopen | `POST /api/proj/projetos/{projetoId}/reopen` | `ProjetoApiService.reopen(id)` | `HistoryFacade` | write | n/a |
| Delete / LGPD erasure | `DELETE /api/proj/projetos/{projetoId}` | `ProjetoApiService.deleteProjeto(id)` | — | write | n/a (**UI deferred**, capability only) |

No client cache of the list or history: the library must be truthful on return from IMP/COMP/PUB and
there is no broker to invalidate a cache (ADR-PROJ-001 / doc 05 §3).

## 2. Facade state machines

### `LibraryFacade`

```
                 listProjetos()
   [loading] ───────────────────► 200 ProjetoCard[]  ── length>0 ─► [ready]
      │                                    └─────────── length===0 ─► [empty]
      │                                    └─ degraded:true ─────────► [ready] (degraded=true)
      └─ 5xx / network ────────────────────────────────────────────► [error] ──retry──► [loading]
   empresa claim change / route re-entry ─► cancel in-flight ─► [loading] (re-fetch)
```

- The in-flight list request is **cancelled and re-issued** on empresa change and on re-entry
  (`switchMap`/`takeUntilDestroyed` at the facade edge; the rest is signals).

### `HistoryFacade`

```
   [loading] ─ getProjeto(id) ⋈ listPublicacoes(id) ─► 200/200 ─► [ready]
      │                                             └─ 404 ─────► [not-found]
      │                                             └─ PUB degraded ─► [ready] (publications=[], degraded=true)
      └─ 5xx / network ──────────────────────────────────────────► [error] ──retry──► [loading]

   reopen(id):  reopenPending=true ─ POST .../reopen ─► 200 ProjetoDetail ─► route to COMP; on re-entry re-fetch
                                                       └─ 409 illegal ─────► reopenPending=false; defensive toast
```

- `getProjeto` and `listPublicacoes` are issued in parallel (`forkJoin`) and both feed the VM; a `404`
  from either → `not-found`. Reopen is **pessimistic**: no optimistic status flip (ADR-PROJ-001).

## 3. Download resolution (D-F — never proxy bytes)

`resolveDownloadUrl(projetoId, publicacaoId)` calls the signed-URL endpoint and returns
`{ arquivoUrl, expiresAt }`. The caller opens `arquivoUrl` directly (`window.open(arquivoUrl, '_blank')`
/ anchor with `target=_blank`), so **object storage** serves the bytes; the SPA never fetches, buffers,
or streams the artifact (doc 02 §1, doc 06 R5). The affordance is only rendered when `arquivoUrl != null`
in the history item; the resolve call is made lazily **on click** (the list item's `arquivoUrl` MAY be a
placeholder marker — the authoritative minting path is §4.5).

## 4. DTOs

FE mirrors the api-contract §6 shapes verbatim; the facade maps DTO → VM (adds computed fields):

- `ProjetoCard` (§6.2) → `ProjetoCardVM` (SPEC-03 §1) — adds `badge`, `canQuickDownload`, `openTarget`.
- `ProjetoDetail` (§6.1) → `ProjectHeaderVM` (+ `manuscriptSummary`/`metadata` used for the header line).
- `PublicacaoHistoryItem` (§6.3) → `PublicacaoRowVM` — adds `isCurrent`, `canDownload`, `statusLabel`.
- `{ arquivoUrl, expiresAt }` (§4.5) → consumed transiently, not stored in a VM.

## 5. Error mapping

BE `ProblemDetail` (RFC 7807) → normalized `AppError` by the ErrorNormalize interceptor → facade sets
the relevant `status`/`degraded`/`reopenPending`. The URN → UI mapping is authoritative in SPEC-07.

## Criterios de aceite (EARS)

- `WHEN /biblioteca-de-projetos is entered or re-entered, THE SYSTEM SHALL issue GET /api/proj/projetos and SHALL NOT serve the list from a client cache [proj-list-refetch].`
- `WHEN the active empresa claim changes, THE SYSTEM SHALL cancel the in-flight list request and re-issue it for the new empresa [proj-empresa-switch].`
- `WHEN /projetos/{projetoId}/historico is entered, THE SYSTEM SHALL issue GET /api/proj/projetos/{projetoId} and GET /api/proj/projetos/{projetoId}/publicacoes in parallel [proj-history-load].`
- `WHEN a download is requested for a publication whose arquivoUrl is non-null, THE SYSTEM SHALL resolve a signed URL via the download endpoint and open it directly, and SHALL NOT fetch or buffer the artifact bytes [proj-download-signed].`
- `WHEN the editor confirms "Ajustar metadados" or "Ajustar layout", THE SYSTEM SHALL POST /api/proj/projetos/{projetoId}/reopen and, on 200, navigate to the COMP route [proj-reopen-post].`
- `IF the reopen responds 409, THEN THE SYSTEM SHALL leave the visible status unchanged and surface a defensive message [proj-reopen-illegal].`
- `IF a cross-context read port is unavailable, THEN THE SYSTEM SHALL still render the projects' own identity and status and set degraded true rather than failing the view [proj-degrade-not-fail].`
