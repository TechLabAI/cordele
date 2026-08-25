# Hub / TechLab AI Integration — proj-service (Projetos)

**Status:** **Not applicable.** Cordelê has **no hub service** and **no TechLab AI dependency**
(`ai.hasAi = false`, doc 04 *Hub Service Dependencies*). Projects is pure lifecycle coordination.

## Why there is nothing to integrate

- **No shared "hub" service** in the Cordelê platform — it is a modular monolith (shared
  `modular-monolith`), not a microservice mesh with an infrastructure hub (no Eureka, no gateway, no
  service registry; `serviceDiscovery.enabled = false`, `apiGateway.enabled = false`).
- **No TechLab AI** — Projects performs deterministic lifecycle/persistence work only. There are no Feign
  clients, no `document_composition` / `orchestration` / `knowledge` / `analytics` calls, and no events
  consumed from TechLab AI.
- **No message broker** — `messaging.enabled = false`; cross-context signalling is in-process
  (`event-contracts.md`).

## Cross-context relationships (in-process, not a hub)

Projects' only cross-context relationships are **in-process module calls / events** inside the monolith,
documented in `integration-contracts.md` and `event-contracts.md`:

- Inbound ports PROJ exports: `CreateProjetoEditorialUseCase`, `ProjetoEditorialLookup`,
  `AdvanceProjetoStatusUseCase`, `ReopenProjectForRevisionUseCase` (called by IMP / PUB / editor).
- Outbound read ports PROJ imports: `ManuscriptSummaryPort` (IMP), `ProjectMetadataPort` (COMP),
  `PublicationHistoryPort` (PUB).
- Outbound erasure ports PROJ imports for the LGPD cascade: `PublicationErasurePort`,
  `CompositionErasurePort`, `ManuscriptErasurePort`.
- Published anchor event `ProjectCreated` (plus `ProjectStatusChanged`, `ProjectDeleted`), consumed
  in-process for read-model/telemetry only — never as the status driver (ADR-002).

## If this changes (post-POC)

Any future managed dependency (e.g. an AI-assisted project assistant, a cloud analytics sink) enters as a
**new infrastructure adapter behind a domain port** — no change to domain or application layers (doc 04
§External Integrations). At that point this document would carry the Feign/HTTP contract, propagation
headers (`correlationId`, `empresa`, `principalId`) and fallback strategy.
