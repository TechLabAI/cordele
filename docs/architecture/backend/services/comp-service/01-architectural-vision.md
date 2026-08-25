<!-- OUTPUT-SCHEMA
- Intent
- Problem Statement
- Personas
- MVP Scope
- Out of Scope
- Architectural Principles
- Success Signals
-->

# 01 — Architectural Vision

**Module:** COMP — Composição (Composition)
**Bounded context:** Composition
**Backend service:** `comp-service` (`@cordele`)
**Stack:** Node 22 · NestJS 11 · Prisma · PostgreSQL 16

## Intent

Composition is the context that gives an imported manuscript the shape of a publishable book. Import
turns a DOCX or Markdown file into a canonical content tree; Publication turns a configured book into a
validated ePub. Between them, someone has to decide *what this book is* — its title, author, ISBN,
language and cover — and *how it should read* — its typography, margins and how images sit on the page.
Composition owns exactly those two configurations, `Metadados` and `ConfiguracaoLayout`, one set per
editorial project.

Composition exists so the editor configures the book once, in a live preview, and every downstream
export uses the same source of truth. Crucially, it does this *around* the manuscript: it reads the
imported content to render a faithful preview, but it never rewrites it. The author's words stay exactly
as imported; Composition only decides how they are presented.

## Problem Statement

Traditional publishing re-diagrams every title by hand: a designer opens the manuscript, re-keys the
metadata, picks fonts and margins, and places images page by page. That work is slow, error-prone, and
tends to alter the source. Cordelê already removes the parsing step (Import) and the build step
(Publication); without a Composition context the configuration in between would either be smeared across
the export screen (metadata typed at export time, layout guessed by the builder) or would push editors
back into a manual layout tool.

Composition solves this by being the **single home of a project's presentation configuration**. It
persists metadata and layout keyed to the `projetoId`, validates them, stores the cover behind a storage
port, and renders a preview by reading — never copying, never mutating — the manuscript's content tree.
At export time Publication reads that same configuration through a narrow port, so what the editor saw in
the preview is what the ePub contains. Because layout choices are stored as overrides that *reference*
manuscript nodes, the immutability promise Import makes to authors holds all the way to the book.

## Personas

- **Coordenador(a) Editorial (primary).** Marina, editorial coordinator at an independent house
  (Editora Aetós, the pilot tenant). After importing a manuscript she fills the book's metadata with
  inline validation (T05 *configuracoes*), uploads a cover, then adjusts typography and image placement
  in a live preview (T06 *editor-de-layout-preview*) until the book looks right.
- **Time interno de desenvolvimento (secondary).** Engineers building Publication. They read a project's
  metadata and layout through COMP's inbound query ports (`GetMetadados`, `GetConfiguracaoLayout`) to
  assemble the ePub — they never read COMP's tables or re-derive its rules.

## MVP Scope

- **Configure editorial metadata** for a project (T05): `titulo`*, `autor`*, `isbn`, `idioma`*,
  `categoria`, and a **cover image** (`capaUrl`), with inline validation (`titulo` and `autor` required;
  `idioma` defaults to `pt`).
- **Store the cover binary** behind a `FileStoragePort` (local disk in POC, S3-compatible in prod) and
  keep only its reference (`capaUrl`) in the aggregate.
- **Configure layout** for a project (T06): body font family (`serif` / `sans-serif`) and size, line
  spacing, side margin, and heading sizes H1/H2/H3.
- **Render a layout preview** by reading IMP's manuscript content tree through an in-process read port;
  COMP renders against a copy-free, read-only view and never writes back.
- **Record page-level layout adjustments** — inserted blank pages and per-image alignment (`full`,
  `centralizado`, `junto-esquerda`, `junto-direita`) — as **composition overrides** that reference
  manuscript nodes, not as edits to the manuscript.
- **Expose read ports** `GetMetadados` and `GetConfiguracaoLayout` for Publication to consume at export.
- Emit **`MetadataUpdated`** and **`LayoutUpdated`** as in-process domain events.

## Out of Scope

- Manuscript parsing, content editing, and the content tree — owned by Import (IMP). Composition reads it,
  never writes it.
- Project lifecycle and status — owned by Projects (PROJ). Composition never calls `advanceTo` and never
  writes `projeto_editorial`; the project stays `em_composicao` throughout.
- ePub/PDF generation, epubcheck validation and download production — owned by Publication (PUB).
- Real ISBN registry lookup and a category taxonomy — BA marks `isbn`, `categoria` and `editoraNome` as
  `source: mock`; no external metadata API in the POC.
- Any generative-AI assistance for metadata or layout (`ai.hasAi = false`).
- Collaborative editing, layout version history, and true page-by-page WYSIWYG authoring.

## Architectural Principles

1. **Configure around the manuscript, never over it.** COMP reads the imported content to preview and
   lay out the book but never mutates it; layout choices are overrides that reference manuscript nodes
   (local ADR-002). Import's immutability promise holds end-to-end.
2. **One home for presentation configuration.** A project's `Metadados` and `ConfiguracaoLayout` live only
   in COMP; Publication reads them through ports rather than re-deriving or duplicating them.
3. **Composition does not own the lifecycle.** Status belongs to PROJ; COMP does no `advanceTo` and the
   project remains `em_composicao` while it is composed.
4. **Own configuration, reference the rest.** COMP owns `Metadados`/`ConfiguracaoLayout`; the project,
   manuscript, cover bytes, editora and publications are referenced, not owned.
5. **Binaries live behind a port.** The cover image is stored via `FileStoragePort` and referenced by
   `capaUrl` (local ADR-003); COMP tables hold references, not bytes.
6. **Hexagonal boundary (shared `hexagonal-node`).** Validation and layout rules are pure domain; Prisma,
   file storage and the manuscript read are infrastructure adapters behind ports.
7. **Tenant isolation by construction.** Every metadata/layout row belongs to a project of exactly one
   `Editora`; all access is scoped by `EmpresaContext` (RULE-07), never by a caller-supplied id.
8. **BFF is the only gateway.** The editor reaches Composition exclusively through the BFF.

## Success Signals

- An editor can fill metadata, upload a cover, adjust typography and image placement, and see the preview
  reflect those choices — all without leaving the composition step.
- The ePub Publication exports matches what the editor configured, because PUB reads the exact same
  `Metadados` and `ConfiguracaoLayout` through COMP's ports.
- The imported manuscript is byte-for-byte unchanged after any amount of layout work — every diff is in
  COMP's override rows, never in IMP's content tree.
- Required-field validation (`titulo`, `autor`, `idioma`) blocks an incomplete composition before export,
  with no invalid metadata reaching PUB.
- Composition never changes the project's status and never writes `projeto_editorial`.
