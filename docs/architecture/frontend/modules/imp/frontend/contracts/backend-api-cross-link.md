# Backend API Cross-Link — IMP (Importação)

> Single source of truth for the FE↔BE contract of IMP. The **authoritative** document is the BE
> contract; this file only **maps** FE facades/operations to it. On any conflict, the BE contract
> wins (M2 barrier, decision D-A/D-B/D-C).

**Authoritative BE contract:**
`docs/architecture/backend/services/imp-service/contracts/api-contract.md`
(supporting: `integration-contracts.md`, `data-model.md`, `event-contracts.md`).

## 1. Endpoint ↔ FE mapping

| BE endpoint (api-contract) | Method | FE Service op | FE Facade | Notes |
|---|---|---|---|---|
| `/api/imp/manuscripts` §4.1 | POST (multipart) | `ManuscriptApiService.upload()` | `ImportFacade` | **Synchronous parse** — 201 returns full `ManuscritoDetail` incl. `estrutura`. No `parseJobId`, no 202, no polling (D-A). |
| `/api/imp/manuscripts/{id}` §4.2 | GET | `ManuscriptApiService.getById()` | `ReviewFacade` | Reload / deep-link / T04 hydration on fresh load. **Not** a readiness probe. |
| `/api/imp/manuscripts/{id}/estrutura` §4.3 | GET | `ManuscriptApiService.getEstrutura()` | `ReviewFacade` | Content-tree-only refetch for oversized trees. |
| `/api/imp/projetos/{projetoId}/manuscritos` §4.4 | GET | `ManuscriptApiService.listByProjeto()` | `ImportFacade` | Immutable import history (newest first). |

## 2. Request contract — `POST /api/imp/manuscripts` (D-C project binding)

`multipart/form-data` parts:

| Part | Required | FE source |
|---|---|---|
| `file` | yes | selected `File` (validated: ext ∈ {.docx,.md}, ≤ 50 MB) |
| `projetoTitulo` | **exactly one of** | `UploadVM.binding.kind='create'` (flat `/imp/upload`) |
| `projetoId` | **exactly one of** | `UploadVM.binding.kind='existing'` (nested `/imp/projetos/:id/importar`) |

The FE enforces the exactly-one rule **client-side** before sending (mirrors server `400
invalid-project-binding`). IMP never creates a project via a separate call — `projetoTitulo` triggers
the server's in-process PROJ `CreateProjetoEditorialUseCase` (integration-contracts §3).

## 3. Response schemas consumed (api-contract §6)

- `ManuscritoDetail` §6.1 → `StructureReviewVM` (SPEC-03 §3).
- `ContentTree` §6.2 (schemaVersion `1.0`; forest chapter→section→block; block =
  `paragraph|image|unparsed`) → chapter ToC + pending panel.
- `UnparsedSegment.reason` closed enum §6.3 (7 reasons) → `TrechoVM.tipo/descricao` (SPEC-03 §4).
- `ManuscritoSummary` §6.4 → import-history list.

## 4. Error contract (api-contract §5)

RFC-7807 `application/problem+json`; `type` URN is the FE switch key; `traceId` mirrors
`X-Correlation-Id`. Full FE mapping in SPEC-07 §2. Codes:
`unsupported-format` (415), `file-too-large` (413), `invalid-project-binding` (400),
`projeto-not-found` (422), `parse-failed` (422), `validation` (400), `unauthorized` (401),
`forbidden` (403), `not-found` (404).

## 5. Tenancy & headers

- Tenant is resolved **server-side from the JWT empresa claim** (api-contract §2); the FE **also**
  sends `X-Empresa-Id` via the shared interceptor for correlation/observability. The FE never puts
  empresa in path/query/body.
- `X-Correlation-Id` injected by `@cordele/shared/access-http-base`; echoed on every response and on
  every `ProblemDetail.traceId`.

## 6. Known contract gaps (raised to M4 — not in the ratified api-contract)

These FE behaviours reference endpoints **not present** in `api-contract.md`; they are backlog items,
not FE inventions:

1. **Ignore fragment persistence** — no `POST .../fragments/{id}/ignore` in the contract. FE ignore is
   client-only/optimistic in the MVP (SPEC-04 §5). If/when a BE endpoint lands, wire the rollback.
2. **Confirm structure** — no `POST .../confirm` in the contract. FE confirm performs the COMP
   navigation handoff; the authoritative project-status advance (`rascunho → em_composicao`) needs a
   BE endpoint. Flagged for M4 + BE contract addendum.

## 7. Drift guard

The FE `libs/imp/data-access/models` interfaces must structurally match api-contract §6. Any change to
the BE schema requires updating those models and this cross-link in the same change. ADR-IMP-001
records the transport decision (synchronous single-POST) and must not be re-opened to polling without
a BE contract change.
