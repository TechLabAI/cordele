# Backend API Cross-Link — PUB (Publicação)

> Single source of truth for the FE↔BE contract of PUB. The **authoritative** document is the BE
> contract; this file only **maps** FE facades/operations to it and records where the doc 05 DRAFT
> endpoints were **reconciled** against the ratified contract (M2 barrier). On any conflict, the BE
> contract wins.

**Authoritative BE contract:**
`docs/architecture/backend/services/pub-service/contracts/api-contract.md`
(supporting: `integration-contracts.md`, `data-model.md`, `event-contracts.md`).

## 1. Endpoint ↔ FE mapping (ratified)

| BE endpoint (api-contract) | Method | FE Service op | FE Facade | Notes |
|---|---|---|---|---|
| `.../projetos/{projetoId}/publicacoes` §4.1 | POST | `PublicacaoApiService.trigger()` | `ExportFacade` | Empty body. **202** new build / **200** in-flight (idempotent, D-R). Returns `PublicacaoStatus` (`status=gerando`) + `Location`. |
| `.../publicacoes/{publicacaoId}/status` §4.2 | GET | `PublicacaoApiService.getStatus()` | `ExportFacade` | **Poll target** until terminal (`publicado`/`com_erros`). `Retry-After` while non-terminal (D-N). |
| `.../projetos/{projetoId}/publicacoes` §4.3 | GET | `PublicacaoApiService.listByProjeto()` | `HistoryFacade` (+ T07 resume) | Newest-first history (T08); also the resume source on T07 re-entry. |
| `.../publicacoes/{publicacaoId}/download` §4.4 | GET | `ArtifactDownloadService.getSignedUrl()` | `HistoryFacade`/`ExportFacade` | Mints **short-TTL signed URL** `{ arquivoUrl, expiresAt }`; client opens directly. **Never streams bytes** (D-F/D-R). |
| `.../projetos/{projetoId}/publicacoes/stats` §4.5 | GET | `PublicacaoApiService.getStats()` | `HistoryFacade` | Live KPI projection `PublicationStats` (D-O). |
| `.../publicacoes/{publicacaoId}/validation-messages` §4.6 | GET | `PublicacaoApiService.getValidationMessages()` | `ExportFacade` | **Desbloqueado (INT-FE-PUB-004, 2026-09-03).** `ValidationMessageItem[]` ordered `ordem ASC`. Optional `severity` query param (`error\|warning\|info`). `location` nullable — rendered as "—". 404 on cross-tenant mismatch. Scope `pub:read`. |
| `/api/proj/projetos/{projetoId}` (PROJ) | GET | `PublicacaoApiService.getProjetoHeader()` | `HistoryFacade` | T08 header (name, "Publicado" chip, editora). Cross-context read — PROJ-owned. |
| COMP `GetMetadados` (`autor`) | GET | `PublicacaoApiService.getAutor()` | `HistoryFacade` | T08 subtitle. Cross-context read — COMP-owned. |

## 2. DRAFT → ratified reconciliation (doc 05 §2 was direction; this is binding)

| doc 05 DRAFT | Ratified in api-contract | FE resolution |
|---|---|---|
| `GET .../publicacoes/latest` (resume) | **Not present** | Resume via §4.3 history list, newest-first (index 0); §4.5 `ultimo*` may short-circuit. SPEC-04 §3. |
| `GET /api/pub/publicacoes/{id}` (poll, flat) | Nested `.../projetos/{projetoId}/publicacoes/{publicacaoId}/status` §4.2 | Poll the nested status endpoint; honour `Retry-After`. |
| `GET .../publicacoes/{id}/avisos` (warning list) | `.../publicacoes/{publicacaoId}/validation-messages` §4.6 (PUB-016) | **IMPLEMENTED (INT-FE-PUB-004, 2026-09-03).** Endpoint ratificado; `ValidationMessageItem[]` → `AvisoVM[]` via `toAvisoVM()`; `ExportFacade.avisos` populado após terminal; `WarningsDetailsComponent` renderiza lista detalhada. Gap §6 GAP 1 fechado. |
| `GET .../publicacoes/{id}/arquivo` (byte stream) | `.../publicacoes/{publicacaoId}/download` §4.4 (signed URL) | Mint a fresh signed URL and open it directly; never proxy bytes. SPEC-04 §4. |
| Progress percentage (`progresso: 0–100`) | **No percentage field** in `PublicacaoStatus` §6.1 | `gerando` is **indeterminate** (no numeric %); poll cadence driven by `Retry-After`. SPEC-03 §1. |
| BE scopes `pub:read`/`pub:export`/`pub:download` | Only **`pub:read`** + **`pub:write`** (§2) | `pub.export → pub:write`; `pub.view`/`pub.download → pub:read`. SPEC-05 §2. |
| `GET .../publicacoes/stats` (KPI) | **Newly ratified** §4.5 | Adopted for the T07/T08 KPI cards (D-O). |
| Re-export / reopen endpoint on PUB | **None** — reopen is PROJ's (`POST /api/proj/projetos/{id}/reopen`) | "Nova exportação" re-POSTs §4.1 (new `Publicacao`); "Ajustar metadados/layout" calls PROJ reopen → COMP (D-P). SPEC-01 §2. |

## 3. Request/response schemas consumed (api-contract §6)

- `PublicacaoStatus` §6.1 (`status`, `epubcheckStatus`, `sequencia`, `totalErros`, `totalAvisos`,
  `resumoErro`, `arquivoDisponivel`, `tamanhoBytes`, `totalCapitulos`, `totalImagens`, `iniciadaEm`,
  `concluidaEm`) → `ExportVM` + `PublicacaoVM` (SPEC-03 §1–§2). The last three (non-null iff
  `status=publicado`) feed `EpubSummaryVM` — ADR-004 / D-S, closes gap 2 below.
- `PublicacaoHistoryItem` §6.2 (`epubcheckStatus`, `totalErros`, `totalAvisos`, `erros`, `arquivoUrl`,
  `criadoEm`) → T08 history rows (SPEC-03 §2). This is the fixed field set PROJ also consumes.
- `PublicationStats` §6.3 → T07/T08 KPI cards (SPEC-03 §4).
- Download response §4.4 (`{ publicacaoId, arquivoUrl, expiresAt }`) → `ArtifactDownloadService`.

The FE declares matching `readonly` TypeScript interfaces in `libs/pub/data-access/models` that
structurally match the contract; drift is caught by the cross-link check (§7).

## 4. Error contract (api-contract §5)

RFC-7807 `application/problem+json`; `type` URN is the FE switch key; `traceId` mirrors
`X-Correlation-Id`. Full FE mapping in SPEC-07 §2. Codes: `manuscript-missing` (409),
`artifact-not-available` (409), `metadata-incomplete` (422), `status-advance-failed` (502),
`validation` (400), `unauthorized` (401), `forbidden` (403), `projeto-not-found` (404),
`publicacao-not-found` (404). The doc 05 DRAFT `illegal-status` is **not** in the contract — a wrong
project status is handled by `pubStatusGuard` (client) + the server's manuscript/metadata pre-flight.

> **Verdict is domain data, not an error:** a `200` whose `epubcheckStatus=erros_criticos` drives the
> red result banner + blocked download — never an HTTP error toast (SPEC-07 §1).

## 5. Tenancy & headers

- Tenant is resolved **server-side from the JWT empresa claim** (api-contract §2); the FE **also**
  sends `X-Empresa-Id` via the shared interceptor for correlation/observability only. The FE never puts
  empresa in path/query/body.
- `X-Correlation-Id` injected by `@cordele/shared/access-http-base`; echoed on every response and on
  every `ProblemDetail.traceId`. `Retry-After` (from §4.2 while non-terminal) drives the poll cadence.

## 6. Known contract gaps (raised to M4 — not in the ratified api-contract)

These FE behaviours reference data **not present** in `api-contract.md` §6; they are backlog items,
not FE inventions:

1. ~~**Per-warning detail list**~~ — **CLOSED (INT-FE-PUB-004, 2026-09-03).** `GET .../validation-messages`
   (api-contract §4.6, PUB-016 BE) ratificado e implementado. `ValidationMessageItem[]` (`{ id, severity, code,
   message, location: string|null, ordem }`) mapeado para `AvisoVM[]` via `toAvisoVM()` e exposto como
   `ExportFacade.avisos`. `WarningsDetailsComponent` renderiza a lista detalhada com `location: null` → "—".
   Scope `pub:read`; 404 cross-tenant guard ativo.
2. ~~**ePub summary KPIs**~~ — **CLOSED (ADR-004 / api-contract D-S, 2026-09-01).** `Tamanho`,
   `Capítulos`, `Imagens` now have a source: `PublicacaoStatus.tamanhoBytes` / `.totalCapitulos` /
   `.totalImagens` (§6.1), non-null iff `status=publicado`. `Páginas` is **not** a gap anymore either — it
   is permanently omitted from the BE contract by product decision (ePub reflowable has no fixed
   pagination); the FE tile stays hidden forever, not pending a future field. See PUB-021 (BE) /
   INT-FE-PUB-005 (FE, now unblocked).
3. **Project header + author subtitle** — read cross-context from PROJ (§4.x) / COMP (`GetMetadados`);
   whether `pub-service` proxies these or the FE calls PROJ/COMP directly is a scaffold-time decision
   (doc 05 §2). Either way PUB never writes those aggregates.

## 7. Drift guard

The FE `libs/pub/data-access/models` interfaces must structurally match api-contract §6. Any change to
the BE schema requires updating those models and this cross-link in the same change. ADR-PUB-001
records the server-authoritative, epubcheck-gated posture and the bounded-poll mechanism (D-N); it must
not be re-opened to SSE/streaming without a BE contract change.
