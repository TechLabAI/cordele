# Frontend Architecture -- Cordelê

Entry point for everything the frontend of Cordelê decides, prescribes or plans.
Read this page first; every other document under `docs/architecture/frontend/` is reachable here.

## Stack in use

| Tier | Value |
|---|---|
| Base framework | `angular` |
| Meta framework | `none` |
| State management | `n/a` |
| Design system | `custom` |
| Package manager | `npm` |
| Workspace scope | `@cordele` |

## What lives where

| Directory | Content | Written by |
|---|---|---|
| `standards/` | Prescriptive rules: module boundaries, module pattern, design tokens, EARS notation. | architecture team |
| `adr/` | Architecture Decision Records for the frontend. | `/fe-architect-vision` + humans |
| `plans/` | `architecture-master-plan.md` plus one plan per module. | `/fe-architect-backlog` |
| `issues/` | Atomic frontend issues derived from the UI specs. | `/fe-architect-backlog` |
| `libs/` | One directory per module library: vision, component and state contracts, routing. | `/fe-architect-vision` and `/fe-architect-specs` |

## Prototype to production (D-493)

The design-reference prototype is not a mock to be re-implemented: it **becomes** the production
frontend. A module is promoted, not scaffolded -- its screens move into the module library and are
wired to real ports by `/fe-architect-promote`. Frontend issues therefore read "connect component X
to API Y", not "build screen X".

Before declaring a screen missing, compare the design reference against the source it was cloned
from: a stale clone is a synchronisation gap, not a specification gap.

## How to navigate

1. **Starting a module** -- `plans/architecture-master-plan.md` for status, then `libs/<module>/`.
2. **Writing code** -- the binding rules are in `standards/`; a rule there wins over an example
   found in an existing library.
3. **Changing a rule** -- raise an ADR in `adr/` first, then update the standard it supersedes.

## References

- [[./adr/README]] -- frontend decision records index
- [[../shared/README]] -- contracts and data model shared with the backend
- [[../backend/README]] -- backend architecture entry point
