<!-- OUTPUT-SCHEMA
- Status
- Contexto
- Decisão
- Consequências
-->

# ADR-001 — Projects as a single bounded-context module

## Status
accepted (2026-08-25) · Scope: the Projects (PROJ) context of Cordelê

## Contexto
Projects is one of four backend contexts (IMP, COMP, PUB, PROJ). At the project level the platform is a
modular monolith (shared `modular-monolith`) with one NestJS `@Module` per bounded context (shared
`hexagonal-node`). The open question for this context is whether Projects should be decomposed — e.g. a
separate "project registry" service and a separate "lifecycle/status" service, or an independently
deployed `proj-service` — or kept as one module.

Forces: PROJ is the coordination hub the other three contexts depend on synchronously and in-process
(IMP and PUB call its `advanceTo` port; nobody else writes `projeto_editorial`). Splitting registry from
lifecycle would put a network hop in the middle of a single short transaction and force distributed
consistency on the one piece of state that must stay authoritative. The POC has a single team and no
message broker (`messaging.enabled = false`), so an independent deployment adds operational cost with no
scaling need. The `proj-service` naming in the docs is a documentation convention, not a deployment
mandate.

## Decisão
Projects is a **single bounded-context NestJS module** (`proj`) inside the Cordelê modular monolith, not
decomposed and not independently deployed in the POC. Its only public surface is the exported inbound
ports — `CreateProjectUseCase`, `AdvanceProjetoStatusUseCase`, `ListProjectsUseCase`,
`GetProjectDetailUseCase` — plus the in-process `ProjectCreated` / `ProjectStatusChanged` events.
Persistence of `ProjetoEditorial` and the publication-history read adapter are internal collaborators of
this one module, wired through domain ports. No other context reads Projects' tables or internal
providers.

## Consequências
Positive: minimal moving parts; project identity and status share one transaction boundary and stay
authoritative; the whole lifecycle is testable in-process; IMP/PUB couple only to a port. The port-based
boundary keeps the door open to extract a separate service later without a domain change.

Negative / trade-offs: no independent scaling or deployment of Projects in the POC; IMP/PUB are
latency-coupled to PROJ through the in-process call (risk R7 in doc 06). If tenant or project volume
grows, or a broker is enabled, revisit and consider fronting `advanceTo` with a command message
(assumption A5); that revision supersedes this ADR rather than editing it.
