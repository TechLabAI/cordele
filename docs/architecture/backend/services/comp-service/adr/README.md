# Architecture Decision Records — Composition (COMP)

Local, service-level decisions for the **Composition** bounded context (`comp-service`). Project-wide
decisions (hexagonal architecture, modular monolith, multi-tenancy) live in `../../../adr/` and are
referenced, not duplicated, here.

## Records on file

| Number | Record | Status | Subject |
|---|---|---|---|
| ADR-001 | [ADR-001-service-boundary](./ADR-001-service-boundary.md) | accepted | Composition as a single bounded-context module, not decomposed nor independently deployed in the POC |
| ADR-002 | [ADR-002-layout-overrides-not-manuscript-mutation](./ADR-002-layout-overrides-not-manuscript-mutation.md) | accepted | Layout and page/image adjustments are composition overrides that reference manuscript nodes; the imported manuscript is never mutated |
| ADR-003 | [ADR-003-cover-binary-storage-port](./ADR-003-cover-binary-storage-port.md) | accepted | The cover image is stored behind a `FileStoragePort` and referenced by `capaUrl`; COMP tables hold references, not bytes |

## Relations

- **ADR-001** applies the project-level hexagonal (`../../../adr/ADR-002-modular-monolith.md` and the
  `hexagonal-node` record) decisions to this context.
- **ADR-002** is this context's defining domain decision; it preserves Import's manuscript-immutability
  promise (IMP local ADR-002) end-to-end and constrains the persistence model (docs 03 and 05) — layout
  is stored as overrides, never as edits to IMP's content tree.
- **ADR-003** follows ADR-002's "own configuration, reference the rest" stance for binaries: the cover is
  a reference to storage, keeping metadata rows small and reusing IMP's `FileStoragePort` pattern.
- Multi-tenancy for this context follows the shared decision (`../../../adr/ADR-003-multi-tenancy.md`); no
  local override.

## Process

Status values: `proposed` · `accepted` · `superseded by <file>`. An accepted record is never edited to
say something different — it is superseded by a new record that names it, so the reasoning chain stays
readable. Numbers are allocated on creation and never reused.
