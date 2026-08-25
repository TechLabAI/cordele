# Backend API Cross-Link — COMP (Composição)

> Single source of truth for the FE↔BE contract of COMP. The **authoritative** document is the BE contract;
> this file only **maps** FE facades/operations to it. On any conflict, the BE contract wins (M2 barrier;
> decisions D-H … D-M). This mapping is the M3 reconciliation of the DRAFT endpoints the FE Vision (doc 05)
> carried before the contract existed.

**Authoritative BE contract:**
`docs/architecture/backend/services/comp-service/contracts/api-contract.md`
(supporting: `data-model.md`, `event-contracts.md`, `integration-contracts.md`).

## 1. Endpoint ↔ FE mapping

| BE endpoint (api-contract) | Method | Scope | FE Service op | FE Facade | Notes |
|---|---|---|---|---|---|
| `/api/comp/projetos/{projetoId}/metadados` §4.1 | GET | `comp:read` | `MetadadosApiService.getMetadados(id)` | `MetadataFacade` | T05 — `Metadados` (§6.1); default representation `materialized:false` when never saved (D-M). |
| `/api/comp/projetos/{projetoId}/metadados` §4.2 | PUT | `comp:write` | `MetadadosApiService.upsertMetadados(id, body)` | `MetadataFacade` | T05 advance — idempotent upsert; `400 validation`; never writes `projeto_editorial`/status. |
| `/api/comp/projetos/{projetoId}/capa` §4.3 | POST | `comp:write` | `MetadadosApiService.uploadCapa(id, file)` | `MetadataFacade` | Multipart; `image/jpeg\|png\|webp` ≤ 10 MB → `{capaUrl}` (D-L); `413`/`415`. Cover **optional**. |
| `/api/comp/projetos/{projetoId}/capa` §4.4 | DELETE | `comp:write` | `MetadadosApiService.removeCapa(id)` | `MetadataFacade` | Clears `capaUrl`; idempotent (`204`). |
| `/api/comp/projetos/{projetoId}/layout` §4.5 | GET | `comp:read` | `LayoutApiService.getLayout(id)` | `LayoutFacade` | T06 — `ConfiguracaoLayout` (§6.2); default representation `materialized:false` (D-M). |
| `/api/comp/projetos/{projetoId}/layout` §4.6 | PUT | `comp:write` | `LayoutApiService.upsertLayout(id, body)` | `LayoutFacade` | T06 export — typography + **non-stale** image-alignment overrides (`tipo=imagem` only, D-H); `400`/`422`. |
| `/api/comp/projetos/{projetoId}/preview-context` §4.7 | GET | `comp:read` | `LayoutApiService.getPreviewContext(id)` | `LayoutFacade` | T06 — `PreviewContext` (§6.4): read-only content tree + layout + overrides as **data**; client renders (D-K); `409` if no manuscript. |

**In-process ports (not FE-consumed).** `GetMetadadosUseCase`, `GetConfiguracaoLayoutUseCase` (PUB reads at
export), `ProjectMetadataPort` (PROJ author lookup) and `CompositionErasurePort` (PROJ LGPD cascade) are
**in-process** NestJS providers (api-contract §6.5) — the SPA never calls them over HTTP.

## 2. Reconciliation of the FE DRAFT endpoints (M3)

The Vision-phase doc 05 endpoints were DRAFT direction (`api-contract pending, M2`). Corrected here:

| DRAFT (doc 05, pre-contract) | Authoritative (api-contract) | Resolution |
|---|---|---|
| `GET /api/comp/projetos/{id}/manuscrito/estrutura` via `ManuscriptReadService` | `GET /api/comp/projetos/{id}/preview-context` (§4.7) — one payload | **Corrected** — no manuscript-structure endpoint and **no** call to `imp-service`; COMP joins the IMP tree in-process and returns tree+layout+overrides as data (D-K). Doc 05 §2 aligned. |
| Preview reads manuscript structure (chapters/paragraphs/image count) | Preview reads the **full content tree** + applied layout + overrides as `PreviewContext` (§6.4) | **Refined** — the client paginates/renders (approximation); PUB owns authoritative fidelity (ADR-COMP-001). |
| `409 urn:cordele:comp:illegal-status` on write to a non-composing project | **No such error** in api-contract §5 | **Corrected** — COMP writes are status-agnostic on the wire; the `em_composicao` gate is an **FE-only** `compStatusGuard` UX affordance (SPEC-07 §2), not a BE rejection. |
| Cover possibly required, limits unspecified | Cover **optional**, `image/jpeg\|png\|webp`, ≤ 10 MB (D-L) | **Resolved** — `titulo`/`autor`/`idioma` are the required identity fields; cover failures never block advance. |
| Route shape flat vs nested (open) | Nested under the project (§0 D-J) | **Resolved** — FE routes parameterized by `:projetoId` (SPEC-01). |
| Tenancy via `X-Empresa-Id` header | Tenancy from the JWT `empresa` claim (§2/§3); `X-Empresa-Id` observability-only | **Corrected** — empresa server-resolved from the token, not a header. |

## 3. The COMP↔FE↔PUB boundary (no status write)

COMP's only writes are its **two aggregates** (`Metadados`, `ConfiguracaoLayout`) + the cover. It **never**
calls `advanceTo`, never writes `projeto_editorial`, and never changes status (api-contract §0 D-M / §2 /
§4.2 / §4.6). T06 "Exportar" is **navigation** to PUB `/exportacao-e-validacao` carrying `projetoId`; PUB (via
PROJ's `AdvanceProjetoStatusUseCase`) authors the status change. The T06 control surface is restricted to the
parameters the PUB stylesheet honours (§7.3) so nothing the editor sets is silently ignored downstream.

## 4. Error contract (RFC 7807)

FE consumes `application/problem+json`; the `type` URN drives the UI mapping (SPEC-07). URNs:
`urn:cordele:comp:{validation|unauthorized|forbidden|projeto-not-found|manuscript-missing|cover-too-large|unsupported-cover-format|override-ref-not-found|structural-edit-deferred}`.
`traceId` mirrors `X-Correlation-Id`.

## 5. Confirmed FE assumptions

- **ADR-COMP-001 (preview is a client-side approximation; parameters, not rendered output)** — confirmed by
  api-contract §0 D-K / §4.7 (COMP returns data, the client renders; PUB owns fidelity).
- **Pessimistic writes, lazy defaults** — confirmed (§0 D-M): `GET` synthesizes a default, the row
  materializes on the first `PUT`; the FE persists on advance/export only.
- **`structuralEdits=false` maps exactly to "no blank-page inserts, no page toolbar"** — confirmed (§0 D-H):
  the FE keeps only image alignment and never emits `tipo=em-branco`.
