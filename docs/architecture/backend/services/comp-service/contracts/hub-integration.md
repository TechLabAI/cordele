# Hub / TechLab AI Integration — comp-service (Composição)

**Status:** **Not applicable.** Cordelê has **no hub service** and **no TechLab AI dependency**
(`ai.hasAi = false`, doc 04 *Hub Service Dependencies*). Composition is deterministic configuration +
validation + a read-only preview over IMP's content.

## Why there is nothing to integrate

- **No shared "hub" service** in the Cordelê platform — it is a modular monolith (shared
  `modular-monolith`), not a microservice mesh with an infrastructure hub (no Eureka, no gateway, no
  service registry; `serviceDiscovery.enabled = false`, `apiGateway.enabled = false`).
- **No TechLab AI** — Composition performs no AI-assisted metadata or layout suggestions. There are no
  Feign clients, no `document_composition` / `orchestration` / `knowledge` / `analytics` calls, and no
  events consumed from TechLab AI. `isbn`/`categoria`/`editoraNome` are `source: mock` — no external
  metadata API in the POC.
- **No message broker** — `messaging.enabled = false`; cross-context signalling is in-process
  (`event-contracts.md`).

## Cross-context relationships (in-process, not a hub)

Composition's only cross-context relationships are **in-process module calls / events** inside the
monolith, documented in `integration-contracts.md` and `event-contracts.md`:

- Inbound ports COMP exports: `GetMetadadosUseCase`, `GetConfiguracaoLayoutUseCase` (called by PUB at
  export), `ProjectMetadataPort` (called by PROJ for the library), `CompositionErasurePort` (called by
  PROJ in the LGPD cascade).
- Outbound ports COMP imports: `ManuscriptContentPort` (IMP, read-only content tree for preview + override
  validation), `FileStoragePort` (cover binary; infrastructure, disk/S3).
- Published anchor event `CompositionUpdated`, realized as `MetadataUpdated` / `LayoutUpdated`, consumed
  in-process for preview/UI/read-model refresh only — never as a status driver (COMP never touches PROJ
  status).

## If this changes (post-POC)

Any future managed dependency (e.g. an AI cover/blurb generator, an ISBN registry lookup, a cloud
analytics sink) enters as a **new infrastructure adapter behind a domain port** — no change to domain or
application layers (doc 04 §External Integrations). At that point this document would carry the Feign/HTTP
contract, propagation headers (`correlationId`, `empresa`, `principalId`) and fallback strategy.
