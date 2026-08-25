# Hub / TechLab AI Integration — pub-service (Publicação)

**Status:** **Not applicable.** Cordelê has **no hub service** and **no TechLab AI dependency**
(`ai.hasAi = false`, doc 04 *Hub Service Dependencies*). Publication runs fully local and deterministic;
its only external tool is the bundled **epubcheck** validator, reached as an adapter behind a domain port
(`integration-contracts.md`), not a hub/service dependency.

## Why there is nothing to integrate

- **No shared "hub" service** in the Cordelê platform — it is a modular monolith (ADR-002), not a
  microservice mesh with an infrastructure hub (no Eureka, no gateway, no service registry;
  `serviceDiscovery.enabled = false`, `apiGateway.enabled = false`).
- **No TechLab AI** — the POC performs deterministic ePub assembly + validation only (doc 04 §Stack,
  §External Integrations). There are no Feign clients, no `document_composition` / `orchestration` /
  `knowledge` / `analytics` calls, and no events consumed from TechLab AI. AI-assisted error remediation is
  explicitly out of scope (`_brief.md` item 5).
- **No message broker** — `messaging.enabled = false`; cross-context signalling is in-process
  (`event-contracts.md`).

## Cross-context relationships (in-process, not a hub)

Publication's cross-context relationships are **in-process module calls / events** inside the monolith,
documented in `integration-contracts.md`:

- Outbound in-process reads: **IMP** `ManuscriptContentPort`, **COMP** `GetMetadadosUseCase` /
  `GetConfiguracaoLayoutUseCase` at assembly time.
- Outbound in-process call: **PROJ** `AdvanceProjetoStatusUseCase.advanceTo` for the terminal project
  status (`publicado` / `com_erros`).
- Inbound ports **exported** by PUB: `PublicationHistoryPort`, `PublicationErasurePort` (called by PROJ).
- Anchor events `PublicationSucceeded` / `PublicationFailed` dispatched in-process → `event-contracts.md`.

The only genuinely external tool — **epubcheck** (a Java CLI/JAR) — is an infrastructure adapter behind
`EpubValidationPort`, and the `.epub` binary lives behind `FileStoragePort`; both are covered in
`integration-contracts.md`, not here.

## If this changes (post-POC)

Any future managed dependency (e.g. a hosted validation service, AI-assisted remediation, distribution to
stores) enters as a **new infrastructure adapter behind a domain port** — no change to domain or
application layers (doc 04 §External Integrations). At that point this document would carry the Feign/HTTP
contract, propagation headers (`correlationId`, `empresa`, `principalId`) and fallback strategy.
