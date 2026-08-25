<!-- OUTPUT-SCHEMA
- Status
- Contexto
- Decisão
- Consequências
-->

# ADR-003 — Publication history as a read-side view over PUB records

## Status
accepted (2026-08-25) · Scope: the Projects (PROJ) context of Cordelê

## Contexto
Projects must present, per title, the **history of publications** — every ePub export with its epubcheck
outcome and download reference (screen T07 *download-e-historico*). But the authoritative `Publicacao`
record is owned by Publication (PUB): it is written when an export runs and carries the epubcheck status
(`valido | avisos | erros_criticos | pendente`) and the artifact reference. The question is whether PROJ
should keep its own copy of publication history or read PUB's records on demand.

Forces: duplicating `Publicacao` into a PROJ table means two sources of truth that drift whenever PUB
updates a record, and — with no broker — no reliable channel to keep the copy fresh (risk R4). Reading on
demand keeps one source of truth but couples PROJ to a PUB query; in a modular monolith that coupling is
an in-process call, cheap and explicit.

## Decisão
Publication history is a **read-side view assembled at read time from PUB's `Publicacao` records**, not a
PROJ-owned table. PROJ defines an outbound `PublicationHistoryPort` in its domain; an infrastructure
adapter implements it over Publication's in-process query port. Project detail composes PROJ status +
manuscript summary (IMP) + this history view. PROJ stores no publication rows and never writes
`Publicacao`.

## Consequências
Positive: a single source of truth for publications (PUB); the history view is always current; no
synchronization machinery and no drift; the ownership boundary stays clean ("own identity, reference the
rest").

Negative / trade-offs: project detail depends on a live PUB read, so a PUB outage degrades the history
portion of detail (the project's own status still renders); the exact port contract — fields, ordering,
download-link resolution — must be agreed with PUB at the Specs phase (gap G2). If read latency or
offline listing later matters, a materialized read model fed by PUB events could be introduced behind the
same port; that revision supersedes this ADR rather than editing it.
