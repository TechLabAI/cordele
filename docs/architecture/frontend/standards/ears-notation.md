# EARS Notation — Authoring Guide (Frontend)

> Standard for writing **acceptance criteria** in the frontend specs of
> Cordelê. EARS (Easy Approach to Requirements Syntax) turns
> testable UI statements into a small grammar that the specs-validate gate parses
> into Playwright/Gherkin coverage.

---

## Why EARS on the frontend

A frontend SPEC mixes two kinds of content:

1. **Structure** — route maps, component hierarchies, view-model shapes, tool
   contracts, shell wiring. This stays as tables/trees/prose; it describes *how
   the UI is built*.
2. **Acceptance criteria** — testable behavior: what a guard does, what an
   optimistic update guarantees, what the UI shows for each backend error, what a
   role can and cannot see. This is what becomes an e2e `Scenario:` and what the
   `fe-ears-coverage.py` gate cross-checks.

The goal is **not** to formalize the whole spec — only the testable subset, so
that searching `THE SYSTEM SHALL` finds every UI contract this module makes, and
each one has a matching e2e scenario.

> **Subject is fixed.** The validator (`be-validate-ears.py`) requires the exact
> subject `THE SYSTEM SHALL`. Even though this is the UI, write `THE SYSTEM
> SHALL` (not "THE UI SHALL"). "THE SYSTEM" = the running frontend application.

---

## The 5 EARS patterns

Pick the smallest pattern that fits.

### 1. Ubiquitous — always true

> **THE SYSTEM SHALL** `<response>`.

```
THE SYSTEM SHALL render the RASCUNHO badge on every AI-authored field whose
   `rascunho` flag is true, and never persist it automatically.
```

### 2. Event-driven — triggered by a user action

> **WHEN** `<trigger>`, **THE SYSTEM SHALL** `<response>`.

```
WHEN the user reorders módulos via drag-and-drop,
   THE SYSTEM SHALL apply the new order optimistically before the API responds.
```

### 3. State-driven — true while a condition holds

> **WHILE** `<state>`, **THE SYSTEM SHALL** `<response>`.

```
WHILE the authenticated member lacks the `curso:publish` permission,
   THE SYSTEM SHALL hide the "Publicar" action from the editor toolbar.
```

### 4. Optional — only when a feature/route is enabled

> **WHERE** `<feature>`, **THE SYSTEM SHALL** `<response>`.

```
WHERE the player surface is reached without a valid AlunoToken,
   THE SYSTEM SHALL redirect to /aluno/login without revealing course existence.
```

### 5. Unwanted — error paths and forbidden states

> **IF** `<undesired condition>`, **THEN THE SYSTEM SHALL** `<corrective response>`.

```
IF the reorder request fails,
   THEN THE SYSTEM SHALL roll back to the previous order and show an error toast.
```

```
IF the backend responds 403 on a publish attempt,
   THEN THE SYSTEM SHALL keep the draft state and show an inline banner.
```

---

## Where to use EARS (per SPEC)

Each `SPEC-01..07` ends with a `## Critérios de aceite (EARS)` section:

- **SPEC-01-route-map** — guard outcomes: `IF <guard> fails, THEN THE SYSTEM SHALL redirect/deny ...`
- **SPEC-03-view-models** — loading/error/empty invariants, badges, derived state
- **SPEC-04-data-access** — optimistic + idempotent ops: `WHEN <op>, THE SYSTEM SHALL <optimistic update>` paired with `IF <failure>, THEN THE SYSTEM SHALL <rollback>`
- **SPEC-05-tool-contract** — UI RBAC: `WHILE the user lacks <permission>, THE SYSTEM SHALL hide/disable ...`
- **SPEC-07-error-handling** — one clause per backend `failure_code`: `IF the backend responds <code>, THEN THE SYSTEM SHALL show <toast|banner|modal> ...`

## Where NOT to use EARS

- **SPEC-02-component-hierarchy** — component trees are structure, not behavior. Prose/ASCII.
- **Vision, rationale, ADR context** — prose.
- **Code examples** (view-model records, tool.contract.ts) — illustration, not contracts.

Rule of thumb: if a reader could turn the sentence into a Playwright `expect(...)`,
write it as EARS. If not, write it as prose.

---

## Coverage contract

The `fe-ears-coverage.py` gate matches each `THE SYSTEM SHALL` clause to a
`.feature` scenario by **keyword overlap**. So each clause must share domain nouns
with the `Scenario:` that covers it. When a title can't share nouns naturally,
embed a backtick slug (e.g. `reorder-rollback`) in both the clause and the
scenario title.

> **Gherkin keywords are English** (D-566). `be-bdd-generator.py` and
> `py-bdd-generator.py` match only `Given|When|Then|And|But`, so a localized
> `.feature` parses to zero steps and yields an empty step file with no warning.
> `fe-ears-coverage.py` still recognizes the pt-BR forms (`Cenário:`,
> `Esquema do Cenário:`) so projects generated before this rule keep passing the
> gate (D-395/D-443) -- that tolerance is backward compatibility, not a licence
> to author new features in Portuguese.

---

## Counter-examples (avoid)

```
THE SYSTEM SHALL be responsive.                    ← not testable. Name the breakpoint/behavior.
WHEN the user clicks, the UI updates.              ← vague. Name the action and the observable change.
THE SYSTEM SHOULD show errors nicely.              ← SHOULD is non-normative. Use SHALL + IF for the failure path.
```

---

## See also

- `.claude/commands/fe-architect-specs.md` — instructs the agent to author EARS acceptance criteria (D-446)
- `docs/architecture/backend/standards/ears-notation.md` — the backend counterpart (D-057)
- Decision **D-446** in the consolidation doc.
