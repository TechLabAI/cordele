# Architecture Decision Records -- Frontend

An ADR records **one** decision that shapes the frontend of Cordelê: the forces
behind it, the option taken, the options rejected and the consequences accepted. Prescriptive rules
belong in `../standards/`; this directory holds the reasoning.

## Format

| Section | Purpose |
|---|---|
| Status | `proposed`, `accepted`, `superseded by <file>` -- plus the date |
| Scope | Which applications, libraries or frameworks the decision binds |
| Context | The forces and constraints that forced a choice |
| Decision | The option taken, stated as an applicable rule |
| Alternatives considered | What was rejected, and why it lost |
| Consequences | Positive and negative, with the mitigations accepted |
| References | Standards, external sources, related records |

An accepted record is superseded, never rewritten.

## Numbering

Framework-variant records are numbered at render time (D-563), because a project running two
frontend frameworks holds two records for the same subject and their natural numbers collide. The
base framework (Angular) keeps the historical numbers; in a **hybrid project the non-base framework
is reallocated from the reserved block starting at 010**. Do not cite these records by a number
typed by hand -- read the index below.

## Records on file

| Number | Record | Subject |
|---|---|---|
| ADR-006 | [[./ADR-006-module-entry-as-library]] | Module entry as an Nx library |

Records without an entry above are framework-neutral: browse this directory for the full list.

## Adding a record

1. Take the next free number in this directory (see the numbering rule above).
2. Name the file `ADR-<NNN>-<kebab-subject>.md`.
3. Fill every section of the format table.
4. Add the record to the index above and link it from the standard it affects.
