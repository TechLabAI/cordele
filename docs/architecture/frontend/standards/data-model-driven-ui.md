# Data-Model-Driven UI

> Standard for Cordelê. D-384/D-385. Adapted from the Estágio-0
> methodology to the **architecture (consumer) side**: the typed domain model is
> authored upstream; here we consume it as the single source of truth for screen
> data, view-models and mock state.

## 1. The contract layer

Estágio 0 separates **deciding** the data model from **implementing** the UI by
emitting two persistent artifacts alongside the Angular prototype:

| Artifact | Role |
|---|---|
| `design/data-model.json` | Typed domain model (`status: draft (BA)`). Source of truth for entities, fields, enums, refs, provenance. |
| `design/mock-data.json` | Conforming instances (`_meta.data-mock: true`). Components import from here — **never** reinvent `const MOCK`. |

The discovery ingestor surfaces the parsed model at
`_extensions.data_model` in `project-context.json` (entity catalog: names,
field counts, enums, refs, pk, mock collections). It does **not** auto-create
`modules.registry` entries — mapping entities to domain modules is the
architect's judgment.

## 2. data-model.json shape

```json
{
  "project": "cordele", "status": "draft (BA)", "version": "0.1.0",
  "entities": {
    "<EntityName>": {
      "description": "...",
      "fields": {
        "<field>": { "type": "string|int|decimal|money|date|datetime|bool|enum|ref",
                     "pk": true, "nullable": true, "source": "real|sector|mock|TODO[sponsor]",
                     "ref": "<Entity>", "label": "<field>", "enum": ["a","b"] }
      }
    }
  },
  "screenBindings": { "<screen>": { "reads": ["Entity[]"], "writes": ["Entity.field"] } }
}
```

`mock-data.json`: `{ "_meta": {...}, "<collection>": [ { ...instances } ] }`.

## 3. How the architect consumes it

- **Domain modeling:** entities → aggregates (no `ref`) vs child entities (has
  `ref`); enums → union types/value objects. `generator-config-gen.py` reads the
  JSON directly (`--data-model design/data-model.json`) to derive
  `generator-config.yml` (par with the DDL parser).
- **Promotion:** `data-model.json` is promoted `draft (BA)` → `accepted` when the
  architecture adopts it; it then feeds `globalSchema` / module specs.
- **Frontend view-models:** screen `dataAccess` facades expose `signal<T[]>([])`
  with `isMock = true`, typed from the entities — **not** from the screen markup.
  Mock state comes from `mock-data.json` (the canonical, curated mock).
- **Provenance:** `source=mock` / `TODO[sponsor]` fields are placeholders, never
  treated as real baselines.

## 4. Rules

- Types come from `data-model.json`, never inferred from the prototype markup.
- Mock is curated in `mock-data.json` (single source); components import it.
- A new mock collection must be added to `mock-data.json` before code relies on it.
- If the model is missing a field a screen needs, fix it upstream (model), not in
  the component.

## 5. Prototype handoff — what each artifact feeds (Section K)

The Estágio-0 prototype is **not disposable**: it is the structured input the
architecture/implementation phase *finalizes*. Beyond `data-model.json` /
`mock-data.json` (above) and the design system (`standards/design-system-tokens.md`):

| Prototype artifact | How architecture/implementation uses it |
|---|---|
| `.build-plans/<screen>.plan.md` | **Per-screen spec** — objective, shared/local components, data bindings, states, AI contract. The architect uses each build-plan to author the `fe-architect-backlog` manifest for that screen. Surfaced at `_extensions.frontend_reference.build_plans`. |
| `angular-prototype/` (Tailwind + CDK) | Navigable skeleton (shell, nested nav/routes, populated screens + `shared/{data-model,mock-data}.ts`). Adopted as the seed; replace mock with services, keep the structure. |
| `design/design-system/` | Token + style contract the final UI consumes (oklch `@theme`). |

**Rules the finalization must honor:**
- Keep the **contract layer** (the build-plan is the single source per screen) and
  **style via tokens** (Tailwind utilities + `theme.css`; no SCSS-of-tokens, no hex).
- **Navigation IA:** the seed shell carries the module hierarchy as **submenus with
  nested routes** (e.g. `/<parent-slug>/<route>` — `/financeiro/receber`). Preserve
  this hierarchy (and the nested routes) in the production app; do not flatten it.
- **AI advisory-only:** screens with AI never act without confirmation; log to the
  audit module.
- The **data-model is the schema source** — resolve prototype↔architecture
  divergences by promoting/adjusting `data-model.json`, not by improvising in code.
