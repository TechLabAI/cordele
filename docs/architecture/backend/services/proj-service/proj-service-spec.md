---
service: proj-service
module: PROJ
displayName: Projetos
stack: node/nestjs/prisma/postgres
phase: specs
authoritative_decisions:
  - "D-D: status authority via advanceTo (idempotent, never regresses) + explicit reopen for revisions (G6)"
  - "D-E: publication history read from PUB via PublicationHistoryPort, fixed field set (ADR-003, G2)"
  - "D-F: ePub download is a short-TTL signed URL minted by PUB; SPA never proxies the bytes"
  - "D-G: deletion/LGPD erasure is an orchestrated leaf-first cross-context cascade (PUB→COMP→IMP→PROJ, G3)"
---

# proj-service — Specs (entry point)

**Module:** PROJ — Projetos · **Service:** `proj-service` · **Stack:** Node 22 · NestJS 11 · Prisma ·
PostgreSQL 16 · `@cordele`. Bounded context inside the Cordelê modular monolith (shared `modular-monolith`).

Projects is the coordinating context: it owns `ProjetoEditorial` and its authoritative lifecycle status,
so IMP/COMP/PUB all bind to one project identity and none of them owns the lifecycle. This document maps
the contracts, specs, tests and diagrams produced by the Specs phase. Specs are implementable without
re-reading the Vision; every spec references an ADR.

## Authoritative decisions (resolved this phase)

- **D-D — Status authority.** `AdvanceProjetoStatusUseCase.advanceTo({projetoId, targetStatus})` is the
  only forward/lateral, idempotent path for IMP (`em_composicao`) and PUB (`publicado`/`com_erros`); it
  **never regresses**. The single deliberate backward edge — reopen a `publicado`/`com_erros` project for
  a new revision (G6) — is `ReopenProjectForRevisionUseCase.reopen`, not an overload of `advanceTo`. Legal
  table + idempotency + illegal-transition error in `contracts/api-contract.md` §7, `spec/backend/SPEC-02`.
- **D-E — Publication history read-model (ADR-003, G2).** Assembled at read time from PUB's `Publicacao`
  via `PublicationHistoryPort`; fixed field set (`epubcheckStatus, totalErros, totalAvisos, erros,
  arquivoUrl, criadoEm`). No PROJ publication table. See `contracts/api-contract.md` §6.3,
  `contracts/integration-contracts.md` §2.3.
- **D-F — Signed-URL download.** `GET .../publicacoes/{id}/download` returns a short-TTL signed URL to the
  ePub in object storage; the SPA opens it directly — PROJ never proxies bytes. Only `valido|avisos`
  publications are downloadable. See `contracts/api-contract.md` §4.5, `spec/backend/SPEC-06`.
- **D-G — LGPD erasure cascade (G3).** `DELETE /api/proj/projetos/{id}` runs an orchestrated, leaf-first,
  idempotent purge (PUB → COMP → IMP: rows **and** binaries/artifacts) before deleting the identity row;
  DB `ON DELETE CASCADE` is the integrity backstop. See `spec/backend/SPEC-11`,
  `contracts/integration-contracts.md` §3.

## Map

| Area | File |
|---|---|
| API surface | `contracts/api-contract.md` (REST + inbound ports §6.5, transition table §7) |
| Data model | `contracts/data-model.md` (canonical `sql` — `projeto_editorial`, `projeto_status_historico`) |
| Events | `contracts/event-contracts.md`, `events/event-catalog.md` |
| Hub / TechLab AI | `contracts/hub-integration.md` (N/A) |
| Integrations | `contracts/integration-contracts.md` (inbound + read + erasure ports) |
| Specs | `spec/backend/SPEC-01..11.md` |
| BDD | `tests/cucumber/*.feature` + `spec/backend/SPEC-08-bdd-test-scenarios.md` |
| Diagrams | `diagrams/c4-{context,container,component}.puml` |
| Local setup | `setup-local.md` |

## ADRs referenced

- Shared: `docs/architecture/backend/adr/ADR-001-hexagonal-node.md`, `ADR-002-modular-monolith.md`,
  `ADR-003-multi-tenancy.md`.
- Local: `adr/ADR-001-service-boundary.md`, `adr/ADR-002-project-status-authority.md`,
  `adr/ADR-003-publication-history-read-model.md`.

## Gaps closed / left

- **Closed:** G1 (status audit → `projeto_status_historico`), G2 (`PublicationHistoryPort` field set),
  G3 (erasure cascade, SPEC-11), G4 (detail composition, SPEC-03), G6 (revision via `reopen`).
- **Left to scaffold/infra:** G5 (library pagination — reserved query params, POC returns all),
  G7/A1 (per-tenant schema provisioning — shared platform concern).

## Next

→ `/be-architect-backlog cordele PROJ`
