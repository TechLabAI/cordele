<!-- OUTPUT-SCHEMA
- Status
- Contexto
- Decisão
- Consequências
-->

# ADR-001 — Publication as a single bounded-context module

## Status
accepted (2026-08-25) · Scope: the Publication (PUB) context of Cordelê

## Contexto
Publication does three related things — assemble an ePub, validate it with epubcheck, and expose the
artifact plus its history. A design question is whether these warrant separate services (e.g. an
"assembler" and a "validator") or a single module. The project is a **modular monolith** (shared
`modular-monolith`) with messaging, service discovery and API gateway all disabled
(`messaging.enabled = false`), and a pilot-scale POC. The sibling contexts (IMP, COMP, PROJ) each chose a
single-module boundary for the same reasons.

Forces: decomposing now would introduce network boundaries, independent deployment, and cross-service
transactions the POC has no infrastructure for, in exchange for scaling flexibility the pilot does not
need. Assembly and validation are two steps of one cohesive flow over one aggregate (`Publicacao`); the
seam that actually matters — the external validator — is a *port*, not a service boundary.

## Decisão
**Publication is a single bounded-context module (`pub`) inside the monolith**, not decomposed and not
independently deployed in the POC. Its public surface is a set of exported inbound ports
(`GeneratePublicationUseCase`, `GetPublicationStatusUseCase`, `DownloadPublicationUseCase`,
`ListPublicationsForProject`); everything else — assembly, validation, storage — is internal, reached
through outbound ports. The real seams (epubcheck, file storage, the IMP/COMP reads, the PROJ status
call) are expressed as hexagonal ports, so they can move behind different transports without splitting
the service.

## Consequências
Positive: one cohesive module for one flow; no premature distributed-systems complexity; assembly and
validation share a transaction and an in-memory content model; the port surface still lets any seam be
externalized later without a domain change.

Negative / trade-offs: Publication is not independently scalable or deployable in the POC; a heavy build
consumes the same process as the rest of the monolith (mitigated by the async job + bounded resources in
ADR-002 and risk R3). If build load later justifies it, extracting the build worker into its own
deployable is an adapter/runtime change, and that revision would supersede this ADR rather than edit it.
