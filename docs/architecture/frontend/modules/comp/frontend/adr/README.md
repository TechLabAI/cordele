# ADR Index — comp (COMP)

This index references the **shared (project-level)** frontend ADRs and lists the **local
(module-level)** ADRs for COMP. Prescriptive rules live in
`docs/architecture/frontend/standards/`; ADRs hold the reasoning.

## Shared ADRs (project-level)

Decisions binding every FE module of Cordelê. Defined in
`docs/architecture/frontend/adr/` (numbered at render time per D-563 — do not cite by a
hand-typed number; read the shared index there).

| ADR | Subject | Status |
|---|---|---|
| [ADR-006](../../../../adr/ADR-006-module-entry-as-library.md) | Module entry as an Nx library (`@cordele/<module>`) | accepted |
| ADR-001 (reserved) | Angular standalone + Signals-first (no NgRx) | reserved / pending |
| ADR-002 (reserved) | Nx boundaries (tags + allowed directions) | reserved / pending |
| ADR-003 (reserved) | Access Layer (`@cordele/shared/*`) | reserved / pending |
| ADR-004 (reserved) | Lazy loading of module entries | reserved / pending |
| ADR-005 (reserved) | Design-system tokens | reserved / pending |

> The shared ADR block for Cordelê is defined by the project's own `frontend/adr/README.md`
> (ADR-006 materialized; 001–005 reserved by name). This module does **not** re-emit the generic
> tax-map/@hub ADRs from the template — it aligns to the cordele shared scheme and the FE
> standards (`module-pattern.md`, `nx-boundaries.md`, `access-layer-contracts.md`,
> `design-system-tokens.md`).

## Local ADRs (module-specific)

| ADR | Title | Status |
|---|---|---|
| [ADR-COMP-001](ADR-COMP-001-preview-approximation-parameter-persistence.md) | Composition persists parameters, not rendered output; the layout preview is a client-side approximation and ePub fidelity is owned by PUB | proposed |

> Local ADRs use a module-prefixed number (`ADR-COMP-NNN`) to avoid colliding with the reserved
> shared 001–005 block under the render-time numbering rule (D-563).
