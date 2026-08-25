---
service: comp-service
module: COMP
displayName: Composição
stack: node/nestjs/prisma/postgres
phase: specs
authoritative_decisions:
  - "D-H: persisted MVP surface = Metadados + ConfiguracaoLayout + image-alignment overrides; structural edits (blank-page inserts) deferred (reconciles BE ADR-002 ↔ FE ADR-COMP-001, G5)"
  - "D-I: COMP↔PUB read contract = GetMetadados / GetConfiguracaoLayout in-process ports, fixed field sets + honoured stylesheet params (G2)"
  - "D-J: routes nested under /api/comp/projetos/{projetoId}/..."
  - "D-K: preview reads manuscript in-process read-only via ManuscriptContentPort; COMP returns preview data, client renders (FE ADR-COMP-001)"
  - "D-L: cover optional; jpeg/png/webp; ≤ 10 MB; behind FileStoragePort (G6)"
  - "D-M: two aggregates confirmed (not one composicao); lazy defaults on first PUT (G1, G7)"
---

# comp-service — Specs (entry point)

**Module:** COMP — Composição · **Service:** `comp-service` · **Stack:** Node 22 · NestJS 11 · Prisma ·
PostgreSQL 16 · `@cordele`. Bounded context inside the Cordelê modular monolith (shared `modular-monolith`).

Composition owns the book's identity and presentation configuration — `Metadados` and `ConfiguracaoLayout`
per project — so the book can be assembled without re-typing or re-diagramming and **without altering the
author's imported content** (IMP immutability holds end-to-end, ADR-002). COMP never touches the project
lifecycle: the project stays `em_composicao` throughout composition; status is PROJ's authority. This
document maps the contracts, specs, tests and diagrams produced by the Specs phase. Specs are implementable
without re-reading the Vision; every spec references an ADR.

## Authoritative decisions (resolved this phase)

- **D-H — Persisted MVP surface (G5; reconciles BE ADR-002 ↔ FE ADR-COMP-001).** COMP persists two
  parameter aggregates (`Metadados`, `ConfiguracaoLayout`) **plus image-alignment overrides**
  (`LayoutOverride tipo=imagem` referencing existing manuscript image nodes). Blank-page inserts
  (`tipo=em-branco`) and any page toolbar operation are **structural** and **deferred**
  (`comp.structuralEdits=false`) — the enum reserves `em-branco` but the API rejects it in the POC. Image
  alignment is a *parameter PUB honours*, not a content edit, so it stays. See `contracts/api-contract.md`
  §0 D-H, §4.6, `contracts/data-model.md` §2.3, `spec/backend/SPEC-03`.
- **D-I — COMP↔PUB read contract (G2).** PUB reads composition at export through two in-process ports
  COMP exports — `GetMetadadosUseCase.get` / `GetConfiguracaoLayoutUseCase.get` — with fixed field sets,
  non-stale overrides only, and a fixed honoured-parameter list. See `contracts/api-contract.md` §6.5, §7.3,
  `contracts/integration-contracts.md` §1, `spec/backend/SPEC-10`.
- **D-J — Nested routes.** Every COMP resource is a singleton child of a project; routes are nested under
  `/api/comp/projetos/{projetoId}/...`. See `contracts/api-contract.md` §0 D-J, §4.
- **D-K — Preview read.** The manuscript content tree is read **in-process, read-only** via
  `ManuscriptContentPort` (source of truth = IMP); COMP assembles a `preview-context` of data, and the
  client renders (FE ADR-COMP-001). The same port validates override references. See
  `contracts/api-contract.md` §4.7, `contracts/integration-contracts.md` §2.1, `spec/backend/SPEC-03`.
- **D-L — Cover (G6).** Optional; `image/jpeg`|`png`|`webp`; ≤ 10 MB; behind `FileStoragePort` (ADR-003),
  referenced by `capaUrl`. Mirrors IMP's storage-port + size-cap pattern. See `contracts/api-contract.md`
  §4.3, `spec/backend/SPEC-06`.
- **D-M — Two aggregates, lazy defaults (G1, G7).** Two separate aggregates (not one `composicao`);
  defaults materialized lazily on first `PUT` (COMP consumes no `ManuscriptImported`). See
  `contracts/api-contract.md` §0 D-M, `contracts/data-model.md` §1, `spec/backend/SPEC-05`.

## Map

| Area | File |
|---|---|
| API surface | `contracts/api-contract.md` (REST + inbound ports §6.5, bounds/honoured params §7) |
| Data model | `contracts/data-model.md` (canonical `sql` — `metadados`, `configuracao_layout`, `layout_override`) |
| Events | `contracts/event-contracts.md`, `events/event-catalog.md` |
| Hub / TechLab AI | `contracts/hub-integration.md` (N/A) |
| Integrations | `contracts/integration-contracts.md` (inbound export + outbound read/storage ports) |
| Specs | `spec/backend/SPEC-01..10.md` |
| BDD | `tests/cucumber/*.feature` + `spec/backend/SPEC-08-bdd-test-scenarios.md` |
| Diagrams | `diagrams/c4-{context,container,component}.puml` |
| Local setup | `setup-local.md` |

## ADRs referenced

- Shared: `docs/architecture/backend/adr/ADR-001-hexagonal-node.md`, `ADR-002-modular-monolith.md`,
  `ADR-003-multi-tenancy.md`.
- Local: `adr/ADR-001-service-boundary.md`,
  `adr/ADR-002-layout-overrides-not-manuscript-mutation.md`, `adr/ADR-003-cover-binary-storage-port.md`.

## Gaps closed / left

- **Closed:** G1 (lazy default policy), G2 (COMP↔PUB read contract + honoured params), G5 (persisted
  surface = parameters + image-alignment; structural deferred), G6 (cover formats/size), G7 (two aggregates).
- **Left to scaffold/infra:** G3 (LGPD cascade — COMP exposes `CompositionErasurePort`; the orchestration
  is PROJ's, SPEC-11 there), G4 (override reconciliation on re-import — MVP validates on write + flags
  `stale` on read; a full reconciliation policy is a later spec), G8/A1 (per-tenant schema provisioning —
  shared platform concern), A1 (single-tenant BA POC vs schema-per-tenant control plane — confirm before scaffold).

## Next

→ `/be-architect-backlog cordele COMP`
