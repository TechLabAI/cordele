# Architecture Decision Records — Publication (PUB)

Local, service-level decisions for the **Publication** bounded context (`pub-service`). Project-wide
decisions (hexagonal architecture, modular monolith, multi-tenancy) live in `../../../adr/` and are
referenced, not duplicated, here.

## Records on file

| Number | Record | Status | Subject |
|---|---|---|---|
| ADR-001 | [ADR-001-service-boundary](./ADR-001-service-boundary.md) | accepted | Publication as a single bounded-context module, not decomposed nor independently deployed in the POC |
| ADR-002 | [ADR-002-async-build-status-machine](./ADR-002-async-build-status-machine.md) | accepted | ePub generation is an asynchronous in-process job driving the `Publicacao` status machine; the trigger returns immediately, the client polls, and a build is idempotent per in-flight request |
| ADR-003 | [ADR-003-epubcheck-validation-port](./ADR-003-epubcheck-validation-port.md) | accepted | epubcheck runs behind an `EpubValidationPort` and its verdict is authoritative for `publicado` vs `com_erros`; the report is persisted and the artifact stored behind `FileStoragePort` |

## Relations

- **ADR-001** depends on the project-level decisions (`../../../adr/ADR-002-modular-monolith.md` and the
  `hexagonal-node` record) — it applies them to this context.
- **ADR-002** is this context's defining domain decision: it makes the long-running build a first-class
  asynchronous flow with an observable status machine, and shapes the inbound-port surface (trigger +
  poll) and the persistence model (docs 04 and 05).
- **ADR-003** follows from the vision principle "nothing ships unvalidated": it puts the external validator
  behind a port and makes its verdict — not the assembler's success — decide the terminal status. It also
  reuses IMP/COMP's `FileStoragePort` pattern for the produced artifact.
- Multi-tenancy for this context follows the shared decision (`../../../adr/ADR-003-multi-tenancy.md`); no
  local override.
- The IMP↔PROJ↔PUB status agreement (D-C) is realized here by PUB calling `advanceTo` and never writing
  `projeto_editorial` — see PROJ's ADR-002 (project-status authority), which PUB honors as a caller.

## Process

Status values: `proposed` · `accepted` · `superseded by <file>`. An accepted record is never edited to
say something different — it is superseded by a new record that names it, so the reasoning chain stays
readable. Numbers are allocated on creation and never reused.
