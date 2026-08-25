# Composition (COMP) — Structured Brief

Source of truth for the Specs, Backlog and Scaffold phases. Derived from the techlab-ba handoff
(`data-model.json`, the T05 *configuracoes* and T06 *editor-de-layout-preview* prototype screens),
`project-context.json`, and the already-recorded boundaries of PROJ (lifecycle authority) and IMP
(immutable manuscript content tree).

| # | Item | Answer |
|---|---|---|
| 1 | Canonical name / prefix | `comp` / **COMP** — Composição (Composition) |
| 2 | Problem it solves | After a manuscript is imported, an editor still has to give the book its identity (title, author, ISBN, language, cover) and decide how it should look (typography, margins, image placement) before it can be exported. Composition is the one context that owns that configuration: it holds the `Metadados` and `ConfiguracaoLayout` for a project so the book can be assembled without ever re-typing or re-diagramming, and **without altering the author's imported content**. |
| 3 | Primary / secondary persona | Primary: Coordenador(a) Editorial (Marina, Editora Aetós pilot) — fills metadata (T05) and adjusts layout in the live preview (T06). Secondary: internal dev team — Publication (PUB) integrates against COMP's read ports to fetch metadata + layout at export time instead of touching COMP's tables. |
| 4 | MVP slice | Configure & persist **editorial metadata** per project (`titulo`*, `autor`*, `isbn`, `idioma`*, `categoria`, `capaUrl`) with inline validation (T05); upload & store the **cover image** behind a `FileStoragePort`; configure & persist **layout** (body font family/size, line spacing, side margin, heading sizes H1/H2/H3) (T06); render a **layout preview** by reading IMP's manuscript content tree through an in-process query port (COMP never copies or mutates it); record **page-level layout adjustments** (inserted blank pages, per-image alignment: `full` / `centralizado` / `junto-esquerda` / `junto-direita`) as composition overrides that reference manuscript nodes, not as edits to the manuscript; expose `GetMetadados` / `GetConfiguracaoLayout` read ports for PUB; emit `MetadataUpdated` / `LayoutUpdated` in-process. |
| 5 | Out of MVP scope | Manuscript parsing, content editing and the content tree (IMP); project lifecycle and status transitions (PROJ) — COMP never calls `advanceTo` and never writes `projeto_editorial`; ePub/PDF build, epubcheck and download (PUB); real ISBN registry lookup and category taxonomy (BA marks `isbn`/`categoria`/`editoraNome` as `source: mock` — no external metadata API in POC); AI-assisted metadata or layout suggestions (`ai.hasAi = false`); collaborative editing, versioning/history of layout beyond current state, WYSIWYG page-by-page authoring. |
| 6 | Mandatory external integrations | Cover-image storage behind `FileStoragePort` (local disk POC / S3-compatible prod — same port pattern IMP established). No third-party API, no broker, no AI provider. |
| 7 | Hub / TechLab AI dependencies · inter-module events | None — `ai.hasAi = false`, no hub service. Messaging disabled (`messaging.enabled = false`): COMP **reads** IMP's manuscript content tree synchronously in-process through a `ManuscriptContentPort` (read-only) to render the preview; COMP **exposes** `GetMetadados` / `GetConfiguracaoLayout` inbound query ports that PUB calls in-process at export; COMP **emits** `MetadataUpdated` / `LayoutUpdated` via the in-process NestJS event emitter. COMP does **not** interact with PROJ's status — the project stays `em_composicao` throughout composition. |
| 8 | Domain anchor event | **`CompositionUpdated`** (Composição atualizada) — the metadata and/or layout of a project's composition changed and the book is now ready to be re-previewed or exported. Realized concretely as `MetadataUpdated` and `LayoutUpdated`. |

## Fixed facts (control plane + BA)

- **Stack:** Node 22 · NestJS 11.x · pnpm · Prisma + `prisma migrate` · PostgreSQL 16 · package base `@cordele`. No Java/Spring (TECH-001).
- **Architecture:** hexagonal (shared `ADR-*-hexagonal-node`) inside a modular monolith (shared `ADR-*-modular-monolith`).
- **Multi-tenancy:** `multi-empresa`, schema-per-tenant (shared `ADR-*-multi-tenancy`) — `cordele_global` + `emp_<slug>`; `EmpresaContext` (AsyncLocalStorage, RULE-07). BA POC single-tenant is the one-tenant special case.
- **Owned aggregates:** `Metadados` (title/author/isbn/idioma/categoria/capaUrl per project) and `ConfiguracaoLayout` (typography + margins + heading sizes + page/image layout overrides). Both reference `ProjetoEditorial` by `projetoId`; neither owns the project.
- **Referenced, not owned:** `ProjetoEditorial` (PROJ, holds the authoritative `status`), `Manuscrito` / content tree (IMP, immutable), `Editora` (global registry), `Publicacao` (PUB).
- **Core promise:** Composition configures *around* the manuscript — it never mutates the imported content (aligns with IMP's immutability guarantee). Layout adjustments are overrides, not edits.

## Local ADRs

- ADR-001 — Composition as a single bounded-context module (single service, not decomposed in POC).
- ADR-002 — Layout and page adjustments are stored as composition overrides that reference manuscript nodes; the imported `Manuscrito` is never mutated (critical domain decision, preserves IMP's immutability guarantee end-to-end).
- ADR-003 — Cover-image binary is stored behind a `FileStoragePort` and referenced by `capaUrl`; COMP holds a reference, not the bytes, in its tables (mirrors IMP's storage-port pattern).
