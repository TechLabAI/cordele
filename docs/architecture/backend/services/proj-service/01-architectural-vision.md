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

**Module:** PROJ — Projetos (Projects)
**Bounded context:** Projects
**Backend service:** `proj-service` (`@cordele`)
**Stack:** Node 22 · NestJS 11 · Prisma · PostgreSQL 16

## Intent

Projects is the coordinating context of Cordelê. It owns the `ProjetoEditorial` — the single identity
that every manuscript, metadata set, layout and publication in the platform binds to — and it owns
that project's **lifecycle status** as it moves from a draft to a published book. Import, Composition
and Publication each do one specialized job; none of them decides what state the project is in. That
decision lives here, so the project's status is always consistent no matter which context did the last
piece of work.

Projects exists so the editorial team has one place to *manage the work as a whole*: create a new
title, browse the library of everything in flight, open a project to see where it stands, and read the
history of every ePub that was exported from it. It is the backbone the other three contexts hang off.

## Problem Statement

Independent publishers run 20–80 titles a year, each moving independently through the same pipeline:
import a manuscript, compose metadata and layout, export and validate an ePub. Without a coordinating
context, "the state of a title" is smeared across three modules — one knows a manuscript was imported,
another that layout was set, a third that a publication succeeded or failed epubcheck — and no one owns
the answer to the simple question *"where is this project?"*. Status either gets duplicated (and drifts)
or gets inferred ad hoc by each screen.

Projects solves this by being the **single authority over project identity and status**. It creates the
`ProjetoEditorial`, exposes a narrow inbound port through which the other contexts *request* a status
transition (never write it), validates that each transition is legal, and presents the two things an
editor actually manages across titles: the **library** of projects and, per project, the **history of
publications**. The authoritative publication records stay in Publication; Projects presents them as a
read-side view.

## Personas

- **Coordenador(a) Editorial (primary).** Marina, editorial coordinator at an independent house
  (Editora Aetós, the pilot tenant). Creates projects, browses the library to see what is in draft, in
  composition, published or in error, and opens a title to check its manuscript summary and its ePub
  export history.
- **Time interno de desenvolvimento (secondary).** Engineers building Import, Composition and
  Publication. They integrate against Projects' inbound ports — creating and advancing a
  `ProjetoEditorial` through a contract — rather than reading or writing its table directly.

## MVP Scope

- **Create** an editorial project (name + owning `Editora`) in status `rascunho`.
- **Library / listing** of projects for the tenant (T01 *biblioteca-de-projetos*), each with its
  current status.
- **Project detail**: current status, a summary of the imported manuscript (by reference to IMP), and
  the publication history.
- **Status authority**: the `AdvanceProjetoStatusUseCase.advanceTo({projetoId, targetStatus})` inbound
  port, called in-process by Import (`rascunho → em_composicao`) and Publication
  (`em_composicao → publicado | com_erros`). PROJ validates the transition is legal and is **idempotent**
  when the project has already moved past the requested status.
- **Publication history** (T07 *download-e-historico*): a read-side view listing each ePub export of the
  project with its epubcheck outcome, assembled from `Publicacao` records owned by Publication.
- Emission of **`ProjectCreated`** and **`ProjectStatusChanged`** as in-process domain events.

## Out of Scope

- Manuscript parsing and the content tree — owned by Import (IMP).
- Metadata and layout configuration — owned by Composition (COMP).
- ePub/PDF generation, epubcheck validation and download production — owned by Publication (PUB);
  Projects links to and reports on them but never builds them.
- Editing manuscript or book content — Cordelê is not an editor.
- Owning `Manuscrito`, `Metadados`, `ConfiguracaoLayout` or `Publicacao` rows.
- Project collaboration, comments, sharing, and permission models beyond tenant isolation.
- Any generative-AI assistance (`ai.hasAi = false`).

## Architectural Principles

1. **Single source of status.** A project's status lives in one place — PROJ — and is authoritative.
   No other context stores or infers it.
2. **Transitions are requested, not written.** Other contexts call `AdvanceProjetoStatusUseCase`; they
   never `UPDATE projeto_editorial`. The legal-transition graph is enforced here (D-C).
3. **Idempotent lifecycle.** Advancing to a status the project has already reached or passed is a safe
   no-op, so re-delivered or retried in-process calls never corrupt state.
4. **Own identity, reference the rest.** PROJ owns `ProjetoEditorial`; manuscripts, metadata, layout and
   publications are referenced by id and owned by their contexts.
5. **History is a view, not a copy (ADR-003).** Publication history is read from PUB's records; PROJ
   does not duplicate `Publicacao` rows into its own tables.
6. **Hexagonal boundary (shared `hexagonal-node`).** The lifecycle rules are pure domain; persistence
   and cross-context reads are infrastructure adapters behind ports.
7. **Tenant isolation by construction.** Every project belongs to exactly one `Editora`; all access is
   scoped by `EmpresaContext` (RULE-07), never by a caller-supplied id.
8. **BFF is the only gateway.** The frontend reaches Projects exclusively through the BFF.

## Success Signals

- An editor can create a title, find it in the library, and open it to see an accurate, single status.
- After Import runs, the project shows `em_composicao`; after a successful publication it shows
  `publicado`; after an epubcheck failure it shows `com_erros` — always driven through the inbound port,
  never by a second writer.
- A retried or duplicate `advanceTo` call leaves the status unchanged (idempotency holds).
- The publication history on a project matches Publication's records with no drift, because it is read,
  not copied.
- No context other than PROJ ever writes `projeto_editorial`.
