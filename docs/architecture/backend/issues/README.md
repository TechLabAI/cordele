# Issues -- Backend

Atomic units of backend work for Cordelê. They are markdown files in this
directory, not tickets in an external tracker: the architecture repository is the source of truth,
and any tracker is a mirror of it.

## Who writes them

`/be-architect-backlog <MODULE>` decomposes the module specs (api-contract, data-model, events)
into issues and writes them here, together with `../plans/plan-<MODULE>.md`. Issues are not authored
by hand during implementation; if the work needed is not on file, the backlog command runs again.

The execution layer consumes them: `/be-validator` selects the next priority, `/be-planner` expands
it and `/be-implement <MODULE> <PRIORITY>` writes the code.

## What makes an issue atomic

| Property | Rule |
|---|---|
| Size | One reviewable change. If it needs two reviewers with different expertise, split it. |
| Scope | One module, one service. Cross-module work becomes one issue per side plus a contract. |
| Verifiable | It states its own done condition as an assertion, not as an intention. |
| Ordered | It declares what must exist before it starts, by issue id. |
| Traceable | It names the spec requirement it satisfies, in EARS form where the spec has one. |

## File format

`<PREFIX>-<NNN>-<kebab-title>.md`, where `<PREFIX>` is the module prefix from the registry.

| Section | Purpose |
|---|---|
| Title + id | Stable identifier used by the plan and by commit messages |
| Priority | Execution order inside the module |
| Depends on | Issue ids that must land first |
| Requirement | The spec statement this issue implements |
| Acceptance | Checkable conditions, including which tests must exist |
| Notes | Constraints, standards to honour, known traps |

## References

- [[../plans/README]] -- how issues roll up into a module plan
- [[../README]] -- backend architecture entry point
