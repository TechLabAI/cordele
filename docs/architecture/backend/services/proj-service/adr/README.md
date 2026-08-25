# Architecture Decision Records — Projects (PROJ)

Local, service-level decisions for the **Projects** bounded context (`proj-service`). Project-wide
decisions (hexagonal architecture, modular monolith, multi-tenancy) live in `../../../adr/` and are
referenced, not duplicated, here.

## Records on file

| Number | Record | Status | Subject |
|---|---|---|---|
| ADR-001 | [ADR-001-service-boundary](./ADR-001-service-boundary.md) | accepted | Projects as a single bounded-context module, not decomposed nor independently deployed in the POC |
| ADR-002 | [ADR-002-project-status-authority](./ADR-002-project-status-authority.md) | accepted | PROJ is the sole authority over project status; transitions are requested through the `AdvanceProjetoStatusUseCase` inbound port and are idempotent |
| ADR-003 | [ADR-003-publication-history-read-model](./ADR-003-publication-history-read-model.md) | accepted | Publication history is a read-side view over PUB's `Publicacao` records, not a PROJ-owned table |

## Relations

- **ADR-001** depends on the project-level hexagonal (`../../../adr/ADR-002-modular-monolith.md` and the
  `hexagonal-node` record) decisions — it applies them to this context.
- **ADR-002** is this context's defining domain decision; it realizes the IMP↔PROJ agreement (D-C) and
  constrains the inbound-port surface and the persistence model (docs 04 and 05). It is what makes PROJ
  the coordinating context.
- **ADR-003** follows from ADR-002's "own identity, reference the rest" stance; it keeps publication data
  owned by PUB and read here, avoiding a second source of truth.
- Multi-tenancy for this context follows the shared decision (`../../../adr/ADR-003-multi-tenancy.md`); no
  local override.

## Process

Status values: `proposed` · `accepted` · `superseded by <file>`. An accepted record is never edited to
say something different — it is superseded by a new record that names it, so the reasoning chain stays
readable. Numbers are allocated on creation and never reused.
