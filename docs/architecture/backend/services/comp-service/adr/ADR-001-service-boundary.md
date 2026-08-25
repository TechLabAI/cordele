<!-- OUTPUT-SCHEMA
- Status
- Contexto
- Decisão
- Consequências
-->

# ADR-001 — Composition as a single bounded-context module

## Status
accepted (2026-08-25) · Scope: the Composition (COMP) context of Cordelê

## Contexto
Composition owns two configurations for a project — editorial metadata and layout — that are edited by
the same persona (the editorial coordinator), in the same step of the pipeline, against the same
`projetoId`. It reads the manuscript content tree from Import to render a preview and exposes its
configuration to Publication at export. The project is a modular monolith (shared `modular-monolith`) with
messaging disabled; there is no broker and no independent deployment in the POC.

The choice is whether to split Composition into finer services (a metadata service and a layout service,
or a preview service) or keep it as one bounded-context module.

## Decisão
**Composition is a single bounded-context NestJS module (`comp`), not decomposed and not independently
deployed in the POC.** Metadata, layout, overrides and the preview live behind one module boundary; the
module's public surface is a small set of exported ports (`UpdateMetadadosUseCase`, `UpdateLayoutUseCase`,
`GetLayoutPreviewUseCase`, `GetMetadadosUseCase`, `GetConfiguracaoLayoutUseCase`). Other contexts reach
Composition only through these ports (shared `hexagonal-node` §5), never through its tables.

## Consequências
Positive: metadata and layout stay cohesive and transactionally simple; no cross-service chatter for a
single editor's configuration; the port surface keeps IMP (read) and PUB (read) cleanly decoupled from
COMP internals; testable in-process.

Negative / trade-offs: COMP, IMP and PUB deploy as one unit and are synchronously coupled in-process
(latency and deployment coupling, risk R7) — accepted for the POC. If Composition later needs independent
scaling or a broker, the same ports can be fronted by a different transport; that revision would supersede
this ADR rather than edit it.
