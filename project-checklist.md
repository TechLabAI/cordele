# Cordelê — Checklist

> Progresso do projeto. Setup (ETAPA 1) é sincronizado de `project-context.json` via `scripts/checklist.py sync`.

## ETAPA 1 — Setup

### P0 — Repository bootstrap (minimal structure + git init)
- [ ] Repository bootstrap (minimal structure + git init) (`new-project.py bootstrap`)

### P1 — Copy .claude/ + generated CLAUDE.md
- [ ] Copy .claude/ + generated CLAUDE.md (`new-project.py claude-folder`)

### P2 — Create docs/architecture/ per rigor level
- [ ] Create docs/architecture/ per rigor level (`new-project.py docs-skeleton --rigor complete-bosq`)

### P3 — Sync TechLab AI docs snapshot (docs-only) and populate integration contract  _(condicional: ai.hasAi == true)_
- [ ] Sync TechLab AI docs snapshot (docs-only) and populate integration contract (`sync-techlab-ai.py --target-sha <pinned>`)

### P3b — Generate elastic-stack overlay (compose + integration contract + Java ports/adapters)  _(condicional: stack.elastic.enabled == true)_
- [ ] Generate elastic-stack overlay (compose + integration contract + Java ports/adapters) (`new-project.py backend-skeleton (elastic-stack overlay triggered automatically)`)

### P4 — backend/ Gradle root + empty settings.gradle.kts
- [ ] backend/ Gradle root + empty settings.gradle.kts (`new-project.py backend-skeleton`)

### P5 — frontend/ empty Nx workspace  _(condicional: stack.frontend.enabled == true)_
- [ ] frontend/ empty Nx workspace (`new-project.py frontend-skeleton`)

### Pg — Growth skeleton (docs/growth/ scaffold + admin-module service-spec)  _(condicional: growth.enabled == true)_
- [ ] Growth skeleton (docs/growth/ scaffold + admin-module service-spec) (`new-project.py growth-skeleton`)

### P6 — Handoff message: setup done, next step is /be-architect-vision <MODULE>
- [ ] Handoff message: setup done, next step is /be-architect-vision <MODULE>

## ETAPA 2 — Desenvolvimento

### Módulos backend

#### IMP — Importação (`imp-service`)
- [ ] **Arquitetura** — `/be-architect-vision IMP` → specs → backlog → scaffold
- [ ] **Ciclo de desenvolvimento** — `/be-validator IMP` → planner → implement
- **Status atual:** declared

#### COMP — Composição (`comp-service`)
- [ ] **Arquitetura** — `/be-architect-vision COMP` → specs → backlog → scaffold
- [ ] **Ciclo de desenvolvimento** — `/be-validator COMP` → planner → implement
- **Status atual:** declared

#### PUB — Publicação (`pub-service`)
- [ ] **Arquitetura** — `/be-architect-vision PUB` → specs → backlog → scaffold
- [ ] **Ciclo de desenvolvimento** — `/be-validator PUB` → planner → implement
- **Status atual:** declared

#### PROJ — Projetos (`proj-service`)
- [ ] **Arquitetura** — `/be-architect-vision PROJ` → specs → backlog → scaffold
- [ ] **Ciclo de desenvolvimento** — `/be-validator PROJ` → planner → implement
- **Status atual:** declared

### Módulos frontend

#### IMP — Importação (`imp`)
- [ ] **Arquitetura** — `/fe-architect-vision IMP` → specs → specs-validate → backlog → promote
- [ ] **Ciclo de desenvolvimento** — `/fe-validator IMP` → planner → implement
- **Status atual:** declared

#### COMP — Composição (`comp`)
- [ ] **Arquitetura** — `/fe-architect-vision COMP` → specs → specs-validate → backlog → promote
- [ ] **Ciclo de desenvolvimento** — `/fe-validator COMP` → planner → implement
- **Status atual:** declared

#### PUB — Publicação (`pub`)
- [ ] **Arquitetura** — `/fe-architect-vision PUB` → specs → specs-validate → backlog → promote
- [ ] **Ciclo de desenvolvimento** — `/fe-validator PUB` → planner → implement
- **Status atual:** declared

#### PROJ — Projetos (`proj`)
- [ ] **Arquitetura** — `/fe-architect-vision PROJ` → specs → specs-validate → backlog → promote
- [ ] **Ciclo de desenvolvimento** — `/fe-validator PROJ` → planner → implement
- **Status atual:** declared
