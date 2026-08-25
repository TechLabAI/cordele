# Projects (PROJ) — Structured Brief

Source of truth for the Specs, Backlog and Scaffold phases. Derived from the techlab-ba handoff
(`technical-framing.md`, `wireframe.md`, `data-model.json`, `constraints.md`),
`project-context.json`, and the IMP↔PROJ integration contract already recorded during Import (D-C /
`AdvanceProjetoStatusUseCase`).

| # | Item | Answer |
|---|---|---|
| 1 | Canonical name / prefix | `proj` / **PROJ** — Projetos (Projects) |
| 2 | Problem it solves | Editors run many titles at once and need one place to create an editorial project, follow it from draft to published, browse the library, and see the history of ePub exports. PROJ is the **coordinating context**: it owns `ProjetoEditorial` and its lifecycle status, so IMP, COMP and PUB all reference one project identity and none of them owns the lifecycle. |
| 3 | Primary / secondary persona | Primary: Coordenador(a) Editorial (Marina, Editora Aetós pilot). Secondary: internal dev team — IMP/COMP/PUB integrate against PROJ's inbound ports instead of touching the `projeto_editorial` table. |
| 4 | MVP slice | Create a project (`rascunho`); list/browse the project **library** (T02) with per-project status; project **detail** (status + imported-manuscript summary + publication history); **status authority** via `AdvanceProjetoStatusUseCase.advanceTo({projetoId, targetStatus})`, called in-process by IMP (`em_composicao`) and PUB (`publicado`/`com_erros`) with legal-transition validation and idempotency; present the **publication history** (T08) by reading `Publicacao` records owned by PUB; emit `ProjectCreated` / `ProjectStatusChanged` in-process. |
| 5 | Out of MVP scope | Manuscript parsing (IMP); metadata/layout (COMP); ePub build, epubcheck and download generation (PUB); manuscript/text editing; project collaboration, comments, sharing and fine-grained permissions beyond tenant isolation; owning `Manuscrito`/`Metadados`/`ConfiguracaoLayout`/`Publicacao` rows; any AI. |
| 6 | Mandatory external integrations | None direct. No third-party API, no broker, no AI provider. Persistence via PostgreSQL 16 + Prisma; publication history read from PUB through an in-process query port. |
| 7 | Hub / TechLab AI dependencies · inter-module events | None — `ai.hasAi = false`, no hub service. Messaging disabled (`messaging.enabled = false`): PROJ **exposes** the inbound port `AdvanceProjetoStatusUseCase` that IMP and PUB call **synchronously in-process** to request a status change (IMP never writes `projeto_editorial`, D-C). PROJ **emits** `ProjectCreated` / `ProjectStatusChanged` via the in-process NestJS event emitter. |
| 8 | Domain anchor event | **`ProjectCreated`** (Projeto criado) — a new editorial project exists in `rascunho`, anchoring every downstream manuscript, composition and publication. |

## Fixed facts (control plane + BA)

- **Stack:** Node 22 · NestJS 11.x · pnpm · Prisma + `prisma migrate` · PostgreSQL 16 · package base `@cordele`. No Java/Spring (TECH-001).
- **Architecture:** hexagonal (shared ADR `hexagonal-node`) inside a modular monolith (shared ADR `modular-monolith`).
- **Multi-tenancy:** `multi-empresa`, schema-per-tenant (shared ADR `multi-tenancy`) — `cordele_global` + `emp_<slug>`; `EmpresaContext` (AsyncLocalStorage, RULE-07). BA POC single-tenant is the one-tenant special case.
- **Owned aggregate:** `ProjetoEditorial` (id, editora ref, `status ∈ {rascunho, em_composicao, publicado, com_erros}`, nome/metadata). Status is authoritative in PROJ; other contexts request transitions, they do not set status.
- **Referenced, not owned:** `Manuscrito` (IMP), `Metadados`/`ConfiguracaoLayout` (COMP), `Publicacao` (PUB), `Editora` (global registry).
- **Core role:** PROJ is the lifecycle and identity backbone of the platform; every other context binds to a `ProjetoEditorial` it did not create.

## Local ADRs

- ADR-001 — Projects as a single bounded-context module (single service, not decomposed in POC).
- ADR-002 — PROJ is the sole authority over project status; transitions are requested through the `AdvanceProjetoStatusUseCase` inbound port and are idempotent (critical domain decision).
- ADR-003 — Publication history is a read-side view over PUB's `Publicacao` records, not a PROJ-owned table.
