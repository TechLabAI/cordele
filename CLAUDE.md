# Cordelê -- O Cordelê é uma plataforma SaaS B2B para transformar manuscritos, textos e arquivos Markdown em publicações digitais ePub válidas, sem necessidade de diagramação manual ou ferramentas técnicas especializadas.

> Monorepo: `/backend` (Node 22 services) + `/frontend` (Angular) + `/docs/architecture/` (specification).
>
> **Stack:** Node 22 . NestJS . pnpm . Prisma . PostgreSQL 16+ . Angular 21 . Nx 22

---

## Monorepo layout

```
/backend/                              # Node 22 services

  package.json / pnpm-workspace.yaml       # pnpm workspace

  services/
    imp-service/
    comp-service/
    pub-service/
    proj-service/

/frontend/                             # Nx workspace, npmScope: @cordele
  apps/
    cordele-web/                       # Angular application
  libs/
    imp/{feature,data-access,ui}/
    comp/{feature,data-access,ui}/
    pub/{feature,data-access,ui}/
    proj/{feature,data-access,ui}/
    shared/{ui-tokens,ui-feedback,ui-components,error-model,access-http-base,empresa-context}/

/docs/architecture/
  backend/{adr,services,standards,issues,plans}/
  frontend/{adr,libs,standards,issues,plans}/
  shared/{modelo-dados,contratos,rbac,multi-empresa}/

```

---

## Multi-empresa (corporate multi-tenant — schema per unit of the group)

Cordelê serves **1 empresa of the same group** (corporate multi-tenant: tenants are known units of the same economic group). Isolation is per schema in Postgres:

| Schema | Empresa |
|---|---|
| `cordele_global` | users, RBAC, shared catalogs |
| `emp_aetos` | Editora Aetós |

Sync propagation: `EmpresaContextHolder` (ThreadLocal + MDC) sets the operational schema of the request via `SET search_path`. Async propagation (`@JmsListener`, threads): pass `EmpresaContext` explicitly as message header. Details in `docs/architecture/shared/multi-empresa.md`.

---

## Business modules (= unit of work of the AI pipeline)

| Code | Name | Microservice | Nx Lib |
|---|---|---|---|
| IMP | Importação | `imp-service` | `libs/imp/*` |
| COMP | Composição | `comp-service` | `libs/comp/*` |
| PUB | Publicação | `pub-service` | `libs/pub/*` |
| PROJ | Projetos | `proj-service` | `libs/proj/*` |

Issue prefix: `<MODULE>-NNN` (e.g.: `IMP-001`, `COMP-001`, `PUB-001`). Issues live in `docs/architecture/{backend,frontend}/issues/`; GitHub sync to be set up when repository is created.

---

## Hexagonal -- mandatory structure (each BE service)

Service: `backend/services/<service>/src/` (D-544, D-545).

```
src/
├── modules/<module>/        # NestJS feature module: controller, service, dto/
├── domain/                  # entity, repository interface, domain service -- no decorators
└── infrastructure/
    ├── persistence/         # Prisma repository + mapper
    └── auth/                # Passport JWT strategy + guard
```

---

## Non-negotiable rules

Enforced by `eslint-plugin-boundaries` plus `tsc --noEmit`; see
`docs/architecture/backend/standards/node-hexagonal-patterns.md`.

```
RULE-01  domain/ does not import @prisma/client
RULE-02  domain/ does not import @nestjs/common decorators
RULE-03  transactions only in the application service
RULE-04  modules/ does not import infrastructure/ directly
RULE-05  infrastructure/ does not import modules/
RULE-06  outbound HTTP clients only in infrastructure/clients
RULE-08  no console.log -- use the Nest logger
RULE-09  DDL only in prisma/migrations
```

If `pnpm lint` fails → **do not commit**, fix first.

The blocking gate is the same in every stack: `scripts/arch-conformance.py check
--layer be --target <service>`, which dispatches on the service's language
(D-570). A gate that cannot verify fails loudly — it never passes in silence.

---

## Migrations

**Node — Prisma Migrate, per service (D-545).**

- Schema in `backend/services/<service>/prisma/schema.prisma`.
- `pnpm prisma migrate dev --name <change>` in development, `migrate deploy` in CI.
- DDL belongs in `prisma/migrations/`, never in application code (RULE-09).

---

## Parallel development (pole-position)

When running multiple modules in parallel across `git worktrees`, cross-module state
documents must **only** be edited in the main dev repo — never inside a worktree:

- `docs/architecture/backend/plans/architecture-master-plan.md`
- `docs/architecture/frontend/plans/architecture-master-plan.md`
- `project-journal.md`, `project-checklist.md`

Each worktree runs `git checkout -- <file>` before pushing. Pull master-plan updates
from the dev repo into worktrees with `git pull` — do not author them inside the
worktree. Violating this causes merge conflicts that erase other terminals' history
(D-397).

---

## Essential commands

```bash

# --- Node services (run from backend/services/<service>/) ---
pnpm install
pnpm test                                 # Jest
pnpm lint                                 # eslint incl. boundary rules -- BLOCKING
pnpm exec tsc --noEmit                    # type check
pnpm build

# Blocking architectural gate, any stack (D-570)
python scripts/arch-conformance.py check --layer be --target backend/services/<service>

# Local infra
docker compose -f docker/docker-compose.dev.yml up -d

# Frontend -- Angular (in /frontend)
npx nx serve cordele-web      # dev server
npx nx build cordele-web      # prod build
npx nx affected:test
npx nx affected:lint

```

---

## AI Pipeline -- per module

The pipeline operates per **MODULE** (IMP/COMP/PUB/PROJ). There are **two complementary layers**:

```
LAYER 1 — ARCHITECT (once per module, FROM THE CONTROL PLANE — D-403)
  These commands are NOT in this repository. Run them from your clone of
  techlab-architecture, passing this project's client id:
      /be-architect-vision <client-id> <MODULE>
  The artifacts land here, under docs/architecture/.
      /be-architect-backlog            atomic issues <MODULE>-NNN + plan-<MODULE>.md
      /be-architect-discovery          reverse engineering of an existing service
      /be-architect-scaffold           service skeleton for the module's stack
      /be-architect-specs              contracts (api / data-model / events / integration)
      /be-architect-vision             docs 01-06 + ADR skeleton
      /fe-architect-backlog            frontend issues + plan
      /fe-architect-promote            prototype screen -> production lib (D-493)
      /fe-architect-scaffold           Angular/Nx module skeleton
      /fe-architect-specs              component specs, state contracts, routing
      /fe-architect-vision             frontend architectural vision (Angular)
      /fe-feature-architect-backlog    feature issues
      /fe-feature-architect-discover   discovery for a feature in an existing module
      /fe-feature-architect-scaffold   feature skeleton
      /fe-feature-architect-spec-delta spec delta for the feature

LAYER 2 — EXECUTION (the iterative cycle, RUNS HERE)
  validator → planner → validator → implement (1 priority) → validator → ...
      /be-autopilot                    chains validator + planner + implement with checkpoints
      /be-implement                    triggered by the validator; ONE priority at a time
      /be-planner                      triggered by the validator when strategy is needed
      /be-validator                    sole entry point; BASELINE or DECISION mode
      /fe-autopilot                    chains the frontend loop with checkpoints
      /fe-implement                    frontend implementation, one priority at a time
      /fe-planner                      frontend planning
      /fe-validator                    sole entry point of the frontend loop

LAYER 3 — Python SCRIPTS (scripts/, invoked by the LAYER 2 commands)

      arch-conformance.py             architectural rules (blocking gate)
      arch_decisions.py               architectural decisions pinned into the docs
      asset_resolution.py             asset/template resolution
      autopilot-state.py              autopilot checkpoints
      be-spec-drift.py                spec <-> code drift detection
      be_context_helper.py            project-context loader shared by the scripts
      cli_utils.py                    shared CLI helpers
      code_inventory.py               source inventory
      doc-scaffold.py                 doc rendering
      embeddings.py                   embedder for the semantic half of spec-context
      es_mappings.py                  canonical ES mappings
      gate-comment-budget.py          comment policy: density, restatement, traceable TODO (D-580)
      gates-run.py                    build/test/lint gates, dispatched by stack
      issue-tracker.py                issue lifecycle (set-status)
      issue_state.py                  issue state parsing
      issues-mirror.py                optional one-way mirror of issues to GitHub
      pipeline-context.py             RAG spec-context for the agents
      pipeline-guard.py               module -> service resolution; 1st call of every command
      pipeline_events.py              activity sink (ES / techlab-ai)
      plan-state-extractor.py         plan -> state for the planner
      pole-position-split.py          priority splitting
      render.py                       Jinja rendering shared by the generators
      stack_resolution.py             backend stack resolution for the gates
      validator-decide.py             validator mode decision (BASELINE / DECISION)
      validator-score.py              module scoring
```

Only the execution layer travels to this project (D-406); what you see under
LAYER 3 is the transitive import closure of those commands' scripts, computed at
generation time (D-577). The generators that create a service from its specs —
`node-scaffold.py` and friends — run in the control plane, driven by
`/be-architect-scaffold`. The three lists above are rendered from the same sets
that decide what is copied, so they cannot drift from reality (D-579).

### Frontend commands (mirror of backend)

Same split as the backend: the architect steps run in the control plane with the
client id, the execution cycle runs here.

```bash
# Architect — FROM techlab-architecture, not from here

/fe-architect-vision    <client-id> <MODULE>
/fe-architect-specs     <client-id> <MODULE>
/fe-architect-backlog   <client-id> <MODULE>
/fe-architect-scaffold  <client-id> <MODULE>
/fe-architect-promote   <client-id> <MODULE>    # prototype screen -> production lib (D-493)

# Per-FEATURE pipeline (new feature in an existing module)
/fe-feature-architect-discover    <client-id> <MODULE> <feature-slug>
/fe-feature-architect-spec-delta  <client-id> <MODULE> <feature-slug>
/fe-feature-architect-backlog     <client-id> <MODULE> <feature-slug>
/fe-feature-architect-scaffold    <client-id> <MODULE> <feature-slug>

# Execution — RUNS HERE, same cycle as the backend
/fe-validator <MODULE>
/fe-planner   <MODULE>
/fe-implement <MODULE> <P>
/fe-autopilot <MODULE>
```

### Recommended flow for a new module (from scratch)

Steps 1–4 run **in techlab-architecture** (D-403) and take the client id; steps
5–7 run **here**. Both write to this repository.

```
--- in the control plane -------------------------------------------------------
1. /be-architect-vision   <client-id> <MODULE>  → docs/architecture/backend/services/<svc>/01..06.md + adr/
2. /be-architect-specs    <client-id> <MODULE>  → contracts/ (api, data-model, events)
3. /be-architect-backlog  <client-id> <MODULE>  → issues/<MODULE>-NNN.md + plans/plan-<MODULE>.md
4. /be-architect-scaffold <client-id> <MODULE>  → backend/services/<svc>/ (NestJS skeleton)

--- here -----------------------------------------------------------------------
5. /be-validator <MODULE>             → enters BASELINE; generates the service README
6. /be-planner   <MODULE>             → creates the initial plan (if not yet existing)
7. /be-implement <MODULE> P1, P2, ... → each priority, with the validator between them
   OR
   /be-autopilot <MODULE>             → orchestrator with checkpoints
```

### Canonical outputs

- Plans: `docs/architecture/backend/plans/plan-<MODULE>.md` (BE) and `docs/architecture/frontend/plans/plan-<MODULE>.md` (FE)
- Operational README: `backend/services/<service>/README.md`
- Per-service spec: `docs/architecture/backend/services/<service>/{contracts,diagrams,execution,tests}/`
- Issues: `docs/architecture/{backend,frontend}/issues/<MODULE>-NNN.md`
- Project ADRs: `docs/architecture/backend/adr/ADR-NNN-*.md`
- Transversal standards: `docs/architecture/backend/standards/*.md`

---

## Available skills (D-560)

Skills loaded automatically by pipeline commands — do not invoke manually unless instructed.

**Claude-only (`user-invocable: false`) — invoked by commands internally:**
- `dev-context-load` — loads module-state + decision-context + spec-context + issue-context via `pipeline-context.py`; run at the start of every execution phase (validator, planner, implementer)
- `dev-phase-emit` — emits phase event via `pipeline_events.py emit` + records in journal; run at the end of every phase

**User-invocable (no LLM — fast, zero tokens):**
- `/pipeline-status <MODULE>` — current module state from ES (score, gates, last events)
- `/master-plan-status` — BE+FE progress table from master plan

---

## Activity observability — record everything (D-423)

Every substantive unit of work must leave a trace in Elasticsearch
(`techlab-pipeline-events-v1`), **even work done outside the official
`/be-*` / `/fe-*` pipeline** (ad-hoc fixes, refactors, investigations, manual
edits). The pipeline commands already journal themselves; for everything else,
follow the **same pattern** by hand:

```bash
# 1. open a trace once at the start of the work (mints a correlation id;
#    all events + any techlab-ai calls in this session inherit it)
python scripts/pipeline_events.py trace-start --command <label> [--module <MODULE>] [--model <model>]

# 2. emit one event per milestone (client is auto-derived from project-context.json)
python scripts/pipeline_events.py emit \
  --category <PHASE-START|PHASE-END|COMMAND-END|DECISION> \
  --actor <who> --module <MODULE> --status <started|completed|blocked> \
  --message "<one line>" [--details '{...}'] \
  [--duration-ms <N>] [--tokens-input <N> --tokens-output <N>]

# 3. close the trace at the end
python scripts/pipeline_events.py trace-end
```

Granularity = per milestone, not per keystroke. `available:false` (ES down) never
blocks — the call is best-effort. This is how the project stays fully observable:
one `trace_id` query reconstructs any work session, pipeline or not.

**Managed activity (D-428).** When `TECHLAB_AI_URL` is set, these events are routed
through techlab-ai's managed sink (`POST /v1/framework/record-activity`) instead of
being written to Elasticsearch directly — a single, governed writer, with the run
`trace_id` carried in the `X-Correlation-Id` header so your activity correlates with
the LLM/RAG calls techlab-ai records for the same run. Leave the var unset and the
event is written straight to ES (zero-infra). Either way the call is best-effort and
the command above is unchanged.

---

## Reference documents (read before implementing)

| Document | Contains |
|---|---|

| `docs/architecture/backend/standards/node-hexagonal-patterns.md` | Module = bounded context, interface ports, eslint boundaries |
| `docs/architecture/backend/standards/node-conventions.md` | TypeScript strict, ESLint, naming, file layout |
| `docs/architecture/backend/standards/node-testing-conventions.md` | Jest, supertest, testcontainers, @nestjs/testing |

| `docs/architecture/backend/standards/platform-patterns.md` | Feign+Resilience4j, centralized Flyway, MDC, Saga, multi-schema |
| `docs/architecture/backend/standards/testing-conventions.md` | Pyramid, Testcontainers, Cucumber, Pact |
| `docs/architecture/backend/standards/services-catalog.md` | Catalog of microservices + canonical packages + events + Feign clients |
| `docs/architecture/backend/standards/service-spec-authoring.md` | How to write per-service SPECs (Phase 1-3) |
| `docs/architecture/backend/standards/api-mock-convention.md` | Mock profile, /api/v0/, fixtures |

| `docs/architecture/frontend/standards/nx-boundaries.md` | Nx tags, allowed directions, ESLint config |
| `docs/architecture/frontend/standards/access-layer-contracts.md` | AuthSession, EmpresaContext, AccessDecision |

| `docs/architecture/shared/blueprint-core.md` | Mental model: app + modules + shared, golden rules |
| `docs/architecture/shared/multi-empresa.md` | EmpresaContextHolder, schema-per-empresa, propagation |

---

## Never do this

- **Never** let `domain/` import `@prisma/client` or Nest decorators

- **Never** treat Cordelê as multi-tenant SaaS; it is multi-**empresa** (1 empresa of the same group)
- **Never** introduce "tool/PREFIX" concept -- here only MODULE exists
- **Never** open a transaction outside the application service
- **Never** return a Prisma model from a controller -- always a DTO
- **Never** use `console.log` -- use the Nest logger
- **Never** hardcode a secret -- `ConfigModule` reads the environment
- **Never** write DDL outside `prisma/migrations/`
- **Never** run a microservice before `cordele-migrations`

---

## Git conventions

Valid commit scopes:
`imp, comp, pub, proj, web, libs, docs, infra, deps`.

Permanent branches: `dev`, `release`, `prod`. Never direct push -- always Pull Request.
