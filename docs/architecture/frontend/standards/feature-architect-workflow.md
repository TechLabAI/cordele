# Feature Architect Workflow (Cordelê)

> Pipeline `fe-feature-architect-*` -- add a new feature to an existing module.
> Delta-only, ADR gate, canonical naming.

Goal: extend existing modules (add a feature, a function or a widget) without violating
accepted ADRs and without duplicating work already done.

Who uses it: the `fe-feature-architect-*` pipeline (4 stages) -- `discover` -> `spec-delta`
-> `backlog` -> `scaffold`. The commands are implemented in
`.claude/commands/fe-feature-architect-*.md`.

---

## 1. When to use each pipeline

| Case | Use |
|---|---|
| **New** module (create from scratch) | Manual setup of the module SPECs + `/fe-feature-architect-discover` |
| Add a feature to an existing module | `fe-feature-architect-discover/spec-delta/backlog/scaffold` |
| The feature has a screen in the Stage 0 Angular prototype | adopt the seed screen from `frontend/design-reference/` during `scaffold`/`implement` |
| Add an isolated data-access resource (no visible feature) | `fe-feature-architect-discover/spec-delta/backlog/scaffold` (reduced scope) |
| Internal refactor with no contract change | manual issue + `/fe-validator` -> `/fe-planner` -> `/fe-implement` |

---

## 2. Principle: delta-only

The extension pipeline **never rewrites documentation**. It acts exclusively in delta mode:

- SPECs are **appended to / modified in specific sections** (never overwritten).
- The module `generator-config.yml` receives **new entries** under `features:` and `data_access.resources:`.
- New issues continue the existing `<PROJECT_PREFIX>-<MODULE>-FE-NNN` numbering.
- Accepted ADRs are **never changed** -- if the feature requires a change, create a new ADR with status `proposed`.

Reason: preserve history, auditability and the contracts with the BE.

---

## 3. ADR conformance gate (blocking)

Every `discover` run produces a `conformance-report.md` with a per-ADR classification:

- ✅ **Aderente** (compliant) -- the pipeline proceeds with no restriction
- ⚠️ **Em risco** (at risk) -- the pipeline proceeds but requires a new ADR stub (`proposed`) in `spec-delta`
- ❌ **Violador** (violating) -- the pipeline **blocks** until the user decides explicitly:
  - option 1: adjust the feature so that it does not violate
  - option 2: accept the creation of a new `proposed` ADR documenting the exception

Canonical ADRs that typically block:
- ADR-001 (FE) Angular standalone + signals + OnPush -- proposing NgRx or BehaviorSubject as source-of-truth = block
- ADR-002 (FE) Nx tax-map -- proposing a lib outside `libs/<modulo>/{feature,data-access,ui,access}` = block or new ADR
- ADR-003 (FE) Design tokens -- hardcoded color/spacing instead of `@cordele/shared/ui-tokens` = refactor
- ADR-004 (FE) RBAC through AccessDecisionService -- inline permission in the UI = block
- ADR-001 (shared) Multi-empresa -- HTTP escaping the `@cordele/shared/access-http-base` interceptor = block

---

## 4. Feature-slug naming

- **kebab-case** (lowercase + hyphen only)
- **3-30 characters**
- **no module prefix** (the module is already the context): `cadastro-cliente`, not `cad-cadastro-cliente`
- **descriptive** (verb+noun or compound noun): `cadastro-cliente`, `relatorio-mensal`, `aprovacao-em-massa`
- **stable**: the slug shows up in paths, folder names, the feature-lib name and issue labels. Changing it later is expensive.

Valid examples: `cadastro-cliente`, `aprovacao-em-massa`, `relatorio-mensal`, `wizard-onboarding`.
Invalid examples: `Cliente`, `cadastro_cliente`, `cadcli`, `cad-cadastro-cliente`.

---

## 5. Generated output structure

Per feature, the pipeline creates:

```
docs/architecture/frontend/
├── libs/<modulo>/features/<feature-slug>/
│   ├── conformance-report.md                 # discover
│   └── spec-delta.md                         # spec-delta (manifest)
├── adr/ADR-00N-<topic>.md                    # only if the conformance-report required it (proposed)
├── libs/<modulo>/SPEC-01..08.md              # modified in delta mode
├── libs/<modulo>/generator-config.yml        # modified
├── issues/<PROJECT_PREFIX>-<MODULE>-FE-NNN..NNN+K.md       # created
├── issues/<PROJECT_PREFIX>-<MODULE>-INT-NNN.md             # created if there is a new BE integration
├── libs/<modulo>/issues-map.md               # updated (P1-P9 + by feature)
└── plans/plan-<MODULO>-<feature-slug>.md     # feature mini-plan
```

And in code:

```
frontend/libs/<modulo>/feature-<feature-slug>/                              # created by scaffold
frontend/libs/<modulo>/data-access/src/lib/<resource>.api.service.ts        # created if the resource is new
frontend/apps/cordele-web-e2e/src/specs/<modulo>/<feature-slug>-*.spec.ts   # created by scaffold
```

---

## 6. Issue template -- extra fields

Issues from the extension pipeline reuse the canonical template, plus 5 fields:

- `**Feature:**` -- the feature slug
- `**Related issues:**` -- relations (related/blocker/blocked-by/superseded), taken from the conformance-report
- `**Conformance:**` -- link to conformance-report.md
- `**Spec sources:**` -- links to the SPECs, with section anchors
- `**Prototype source:**` -- link to `prototypes/<modulo>/<feature-slug>/` (when applicable)
- `**BE dependency:**` -- the `<PROJECT_PREFIX>-<MODULE>-NNN` of the BE issue delivering the endpoint, or "endpoint already exists"

---

## 7. Recommended granularity (extension)

Typical total: **3-10 functional issues + 0-2 INT = 3-12 total**.

| Wave | Issues | When to include |
|---|---|---|
| P1 | 0-1 | only if the module permission-map / feature-flags changed |
| P2 | 0-1 | only if there is a new resource |
| P3 | 1-3 | feature-lib + components |
| P4 | 0-1 | only if there is a new BE integration (<PROJECT_PREFIX>-<M>-INT) |
| P5 | 0-1 | custom guard |
| P6 | 0-1 | breadcrumb/nav change |
| P7 | 0-1 | UX polish (may fold into the P3 acceptance) |
| P8 | 0-1 | new telemetry events |
| P9 | 1 | Playwright specs (always) |

Above 12 issues, **split into sub-features** and run the pipeline for each one.

---

## 8. Post-scaffold quality gates

```bash
npx nx lint <project>      # boundaries + standalone + OnPush + tax-map
npx nx test <project>      # Jest unit
npx nx build <project>     # TypeScript compiles
npx nx affected -t lint,test --base=HEAD~1   # no regression
```

All 4 green before finishing. If one fails:
- `nx lint` -- check `generator-config.yml`; fix it and regenerate with `--force` if needed
- `nx test` -- add minimal mocks/stubs to the setup-jest of the generated lib
- `nx build` -- TypeScript error; review the generated DTO/VM types

Do **not** run e2e here -- that is the responsibility of `fe-implement` in wave P9.

---

## 9. Post-architect pipeline

At the end of `scaffold`, the feature is registered in the Nx workspace and ready for
the P2/P3 `fe-implement`:

```
/fe-validator <<PROJECT_PREFIX>-<MODULE>-FE-NNN>          # consolidates state
/fe-planner   <<PROJECT_PREFIX>-<MODULE>-FE-NNN>          # produces plan-<ID>.md
/fe-implement <<PROJECT_PREFIX>-<MODULE>-FE-NNN> fase-<N>  # runs phase by phase
```

---

## 10. Do NOT

- do not use `fe-feature-architect-*` to create a module from scratch (write the module SPECs manually first)
- do not rewrite SPECs from scratch (only append/modify)
- do not change the status of an existing ADR to `accepted` -- promotion is a human decision outside the pipeline
- do not proceed with `spec-delta` when the conformance-report is ❌ Violador without an explicit decision
- do not reuse `<PROJECT_PREFIX>-<MODULE>-FE-NNN` numbers already taken
- do not generate TS/Angular code outside the scaffold
- do not keep `sessionStorage`, `localStorage`, blob download or inline permission in code adapted from the prototype
