# Backend API Cross-Link — PROJ (Projetos)

> Single source of truth for the FE↔BE contract of PROJ. The **authoritative** document is the BE
> contract; this file only **maps** FE facades/operations to it. On any conflict, the BE contract wins
> (M2 barrier; decisions D-D/D-E/D-F/D-G). This mapping is the M3 reconciliation of the DRAFT endpoints
> that the FE Vision (doc 05) carried before the contract existed.

**Authoritative BE contract:**
`docs/architecture/backend/services/proj-service/contracts/api-contract.md`
(supporting: `integration-contracts.md`, `data-model.md`, `event-catalog.md`).

## 1. Endpoint ↔ FE mapping

| BE endpoint (api-contract) | Method | Scope | FE Service op | FE Facade | Notes |
|---|---|---|---|---|---|
| `/api/proj/projetos` §4.2 | GET | `proj:read` | `ProjetoApiService.listProjetos()` | `LibraryFacade` | T02 — returns composed `ProjetoCard[]` (§6.2), ordered by `ultimaAtividadeEm` desc. Re-fetch on entry (ADR-PROJ-001). |
| `/api/proj/projetos/{projetoId}` §4.3 | GET | `proj:read` | `ProjetoApiService.getProjeto(id)` | `HistoryFacade` | T08 header — `ProjetoDetail` (§6.1) incl. `manuscriptSummary`, `metadata`, `publicationHistory`, `degraded`. |
| `/api/proj/projetos/{projetoId}/publicacoes` §4.4 | GET | `proj:read` | `ProjetoApiService.listPublicacoes(id)` | `HistoryFacade` | T08 list — `PublicacaoHistoryItem[]` (§6.3), `criadoEm` desc. |
| `/api/proj/projetos/{projetoId}/publicacoes/{publicacaoId}/download` §4.5 | GET | `proj:read` | `ProjetoApiService.resolveDownloadUrl(id, pid)` | both | Signed URL `{ arquivoUrl, expiresAt }` (D-F). SPA opens it directly — **never proxies bytes**. `409` if `epubcheckStatus ∈ {erros_criticos, pendente}`. |
| `/api/proj/projetos/{projetoId}/reopen` §4.7 | POST | `proj:write` | `ProjetoApiService.reopen(id)` | `HistoryFacade` | T08 "Ajustar metadados / Ajustar layout" → `publicado\|com_erros → em_composicao`, returns `ProjetoDetail`. Pessimistic; `409` from `rascunho`. |
| `/api/proj/projetos/{projetoId}` §4.6 | DELETE | `proj:delete` | `ProjetoApiService.deleteProjeto(id)` | — | LGPD erasure (orchestrated leaf-first cascade, D-G). **No UI affordance in the T02/T08 prototype** — capability declared, UI deferred. |

## 2. Reconciliation of the FE DRAFT endpoints (M3)

The Vision-phase doc 05 endpoints were DRAFT direction (`api-contract pending, M2`). Corrected here:

| DRAFT (doc 05, pre-contract) | Authoritative (api-contract) | Resolution |
|---|---|---|
| `GET /api/proj/publicacoes/{publicacaoId}/download` (flat) | `GET /api/proj/projetos/{projetoId}/publicacoes/{publicacaoId}/download` (nested) | **Corrected** — path is nested under the project. |
| List returns `ProjetoEditorial[]` + counters | List returns composed `ProjetoCard[]` (§6.2) | **Refined** — the composed card (badge, counters, author, `ultimoEpubcheckStatus`) is the contract shape. |
| Tenancy via `X-Empresa-Id` header | Tenancy from the JWT `empresa` claim (§2/§3); `X-Empresa-Id` not required | **Corrected** — empresa is server-resolved from the token, not a header. |
| "PROJ issues no writes in the MVP" | `reopen` (write, §4.7) + `delete` (§4.6) exist | **Corrected** — PROJ has one editor write (reopen); create is IMP's via navigation (D-C). |
| Badge = raw `ProjetoEditorial.status` (open gap) | Badge derived, folding `ultimoEpubcheckStatus` (§6.2) | **Resolved** — see SPEC-03 badge rule. |

## 3. Cross-context read composition (no N+1)

`ProjetoCard[]` and `ProjetoDetail` are composed by the BE from PROJ's aggregate + outbound read ports
(`ManuscriptSummaryPort` from IMP, `ProjectMetadataPort` from COMP, `PublicationHistoryPort` from PUB),
batched by `projetoId` set (api-contract §6.4). **The FE makes a single call per screen** — it never
fans out per card; the composition and any `degraded:true` fallback are entirely server-side.

## 4. Error contract (RFC 7807)

FE consumes `application/problem+json`; the `type` URN drives the UI mapping (SPEC-07). URNs:
`urn:cordele:proj:{validation|illegal-status-transition|artifact-not-available|erasure-failed|unauthorized|forbidden|not-found}`.
`traceId` mirrors `X-Correlation-Id`.

## 5. Confirmed FE assumptions

- **ADR-PROJ-001 (server-authoritative, re-fetch on entry, no cross-module cache)** — confirmed by
  api-contract §8.4.
- **Download never proxied** (D-F) — confirmed; the SPA opens the signed URL directly.
- **T08 "Ajustar metadados / layout" → `reopen`** — confirmed (§4.7 / integration-contracts §1.4); the
  BE marked this as pending FE validation and it is now wired in SPEC-04/SPEC-05.
