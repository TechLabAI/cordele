---
service: pub-service
module: PUB
displayName: Publicação
stack: node/nestjs/prisma/postgres
phase: specs
authoritative_decisions:
  - "D-N: generation progress via bounded status-polling (202 + poll; no SSE, no broker)"
  - "D-O: FE KPIs computed live from PUB's own publication read model (no analytics store)"
  - "D-P: re-export = new Publicacao; reopen-for-edit is PROJ's job, PUB never calls reopen"
  - "D-Q: build status and epubcheck verdict are two fields; warnings (avisos) still publish"
  - "D-R: at most one non-terminal build per project; trigger is idempotent; signed download URL"
---

# pub-service — Specs (entry point)

**Module:** PUB — Publicação · **Service:** `pub-service` · **Stack:** Node 22 · NestJS 11 · Prisma ·
PostgreSQL 16 · `@cordele`. Bounded context inside the Cordelê modular monolith (ADR-002).

Publication is the only context that produces a distributable file, and it never ships one epubcheck has
not accepted; a failed build is a first-class recorded outcome (`com_erros`), not a discarded error. It
assembles an ePub 3 from IMP's manuscript content tree + COMP's metadata/layout (read in-process), validates
it with **epubcheck**, stores the artifact behind `FileStoragePort`, requests the terminal project status
from PROJ (`advanceTo`), and exposes the publication history + download. This document maps the contracts,
specs, tests and diagrams produced by the Specs phase. Specs are implementable without re-reading the
Vision; every spec references an ADR.

## Authoritative decisions (resolved this phase)

- **D-N — Progress by polling.** `POST .../publicacoes` returns `202` + `publicacaoId`; the client polls
  `GET .../status` until terminal. No SSE, no broker (`messaging.enabled=false`). See
  `contracts/api-contract.md` §0/§4.1/§4.2 and `adr/ADR-002-async-build-status-machine.md`.
- **D-O — KPIs from the publication read model.** T07/T08 KPI cards are a live projection of `Publicacao` +
  `validation_message` (`GET .../stats`, `PublicationHistoryPort`), never a separate analytics store.
- **D-P — Re-export vs reopen.** Re-generating creates a **new** `Publicacao` (next `sequencia`) and calls
  `advanceTo(publicado|com_erros)`; reopening a project to `em_composicao` for edits is **PROJ**'s
  `ReopenProjectForRevisionUseCase` (editor via T08), never a PUB call. PUB never writes `projeto_editorial`.
- **D-Q — Two status fields.** `status` (build machine: `gerando|validando|publicado|com_erros`) and
  `epubcheckStatus` (verdict: `valido|avisos|erros_criticos|pendente`). Warnings still publish
  (`avisos → publicado`, downloadable). epubcheck is authoritative (ADR-003).
- **D-R — Single in-flight + idempotent trigger.** At most one non-terminal `Publicacao` per project
  (partial unique index); re-trigger in flight returns the existing one. Download is a short-TTL signed URL
  minted by PUB (D-F); bytes are never proxied.

## Map

| Area | File |
|---|---|
| API surface | `contracts/api-contract.md` (trigger/poll/history/download/stats; §6 schemas; §0 D-N..D-R) |
| Data model | `contracts/data-model.md` (canonical `sql` — `publicacao`, `validation_message`) |
| Events | `contracts/event-contracts.md`, `events/event-catalog.md` (in-process, best-effort) |
| Hub / TechLab AI | `contracts/hub-integration.md` (N/A) |
| Integrations | `contracts/integration-contracts.md` (epubcheck, storage, IMP/COMP reads, PROJ advanceTo, exported ports) |
| Specs | `spec/backend/SPEC-01..11.md` |
| BDD | `tests/cucumber/*.feature` + `spec/backend/SPEC-08-bdd-test-scenarios.md` |
| Diagrams | `diagrams/c4-{context,container,component}.puml` |
| Local setup | `setup-local.md` |

## ADRs referenced

- Shared: `docs/architecture/backend/adr/ADR-001-hexagonal-node.md`, `ADR-002-modular-monolith.md`,
  `ADR-003-multi-tenancy.md`.
- Local: `adr/ADR-001-service-boundary.md`, `adr/ADR-002-async-build-status-machine.md`,
  `adr/ADR-003-epubcheck-validation-port.md`.

## Next

→ `/be-architect-backlog cordele PUB`
