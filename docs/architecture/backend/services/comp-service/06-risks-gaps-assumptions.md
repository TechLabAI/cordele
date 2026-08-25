<!-- OUTPUT-SCHEMA
- Riscos
- Gaps Conhecidos
- Suposicoes a Validar
- Dependencias Criticas
-->

# 06 — Risks, Gaps and Assumptions

**Module:** COMP — Composição

## Riscos

| # | Risk | Impact | Mitigation |
|---|---|---|---|
| R1 | Layout work mutates the manuscript (e.g. writing image placement back into IMP's content tree). | Import's immutability promise to authors is broken; content drift between contexts. | `ManuscriptContentPort` is read-only; overrides reference manuscript nodes (local ADR-002); no write path to IMP data exposed. |
| R2 | Overrides reference manuscript nodes that no longer exist (a re-import changes the tree). | Preview/export breaks or silently drops adjustments. | Overrides validated against the current content tree; dangling references rejected/reconciled (invariant 8); reconciliation policy on re-import is a gap (G4). |
| R3 | COMP tries to drive the lifecycle (calls `advanceTo` or writes `projeto_editorial`). | Duplicate status writers; violates PROJ authority (PROJ R1). | Invariant: COMP never touches status; project stays `em_composicao`; port surface excludes any PROJ write. |
| R4 | Invalid/incomplete metadata reaches Publication (missing `titulo`/`autor`/`idioma`). | ePub built with bad or empty identity; epubcheck or reader errors. | Required-field validation in the domain before persist/finalize; PUB reads through `GetMetadados` which only returns validated data (contract detail at Specs). |
| R5 | Cover binary lifecycle — replaced/deleted covers orphaned in storage, or a deleted project leaves cover bytes behind. | Storage leak; LGPD erasure incomplete. | Cover behind `FileStoragePort` with a cleanup routine; participation in PROJ's cross-context deletion cascade (G3). |
| R6 | Multi-tenancy mismatch between control plane (schema-per-tenant) and BA POC (single-tenant). | Wrong isolation assumptions baked into persistence. | Follow control-plane schema-per-tenant; flag as assumption A1 to confirm before scaffold. |
| R7 | In-process coupling — a slow IMP content read blocks the preview; COMP, IMP and PUB deploy as one unit. | Reduced independence; latency coupling. | Acceptable in the modular-monolith POC (local ADR-001); async path kept open behind the same ports (A7). |
| R8 | Preview fidelity — the backend preview diverges from the ePub PUB actually builds. | Editor sees one thing, gets another. | PUB reads the exact same `ConfiguracaoLayout`/overrides; preview and build share the configuration source (contract alignment with PUB at Specs, G2). |

## Gaps Conhecidos

- **G1 — Default creation policy.** When are default `Metadados`/`ConfiguracaoLayout` created — eagerly on
  `ManuscriptImported`, or lazily on first composition access? Decide at Specs.
- **G2 — COMP↔PUB read contract.** The exact shape of `GetMetadados` / `GetConfiguracaoLayout` (fields,
  override serialization, how PUB consumes alignment) is defined with Publication at the Specs phase.
- **G3 — Cross-context deletion / LGPD erasure.** COMP's part of the cascade from a deleted
  `ProjetoEditorial` (rows + cover binary) is defined with PROJ/IMP/PUB.
- **G4 — Override reconciliation on re-import.** How overrides referencing manuscript nodes survive (or
  are invalidated by) a manuscript change/re-import is not designed.
- **G5 — Layout override model scope.** Whether page-level adjustments (blank pages, image placement) are
  fully persisted overrides in the POC or partly ephemeral preview state — the BA `ConfiguracaoLayout`
  entity models only typography; the T06 prototype adds page/image interactions. Confirm the persisted
  surface at Specs (A6).
- **G6 — Cover constraints.** Accepted formats, max size and validation for the cover image are
  unspecified (mirror IMP's file-size limits?).
- **G7 — One vs two aggregates.** Whether `Metadados` and `ConfiguracaoLayout` stay separate or fold into
  a single `composicao` aggregate — a modeling decision for Specs.
- **G8 — Tenant provisioning / per-schema migration** is a shared platform mechanism not yet designed;
  noted for scaffold/infra (common to all modules).

## Suposicoes a Validar

- **A1** — Multi-tenancy is schema-per-tenant multi-empresa (`cordele_global` + `emp_<slug>`), per the
  control plane, overriding the BA POC single-tenant simplification. **Confirm before scaffold.**
- **A2** — COMP owns `Metadados` and `ConfiguracaoLayout`; it never owns or writes `ProjetoEditorial`,
  the manuscript content tree, or publications.
- **A3** — COMP never changes project status and never calls PROJ's `advanceTo`; the project remains
  `em_composicao` throughout composition (status changes come from IMP/PUB).
- **A4** — The manuscript content tree is read read-only via an in-process `ManuscriptContentPort`; layout
  adjustments are overrides that reference nodes, never edits to IMP data (local ADR-002).
- **A5** — The cover image is stored behind `FileStoragePort` (disk POC / S3 prod) and referenced by
  `capaUrl`; COMP tables hold no binary (local ADR-003).
- **A6** — The persisted layout surface is exactly the BA `ConfiguracaoLayout` fields plus page/image
  overrides; no additional layout capabilities in the POC.
- **A7** — Composition operations run synchronously in-process; no broker (`messaging.enabled = false`);
  COMP's domain events are in-process only.
- **A8** — No AI and no external metadata API participate in Composition (`ai.hasAi = false`;
  `isbn`/`categoria`/`editoraNome` are `source: mock`).
- **A9** — Required metadata is `titulo`, `autor` and `idioma`; `idioma ∈ {pt, en, es, fr}` default `pt`.

## Dependencias Criticas

- **PostgreSQL 16 + Prisma** — persistence of `Metadados`, `ConfiguracaoLayout` and overrides, with
  tenant-schema targeting.
- **`FileStoragePort` (disk/S3)** — storage of the cover binary; without it there is no cover.
- **`EmpresaContext` / RULE-07** — tenant propagation; without it, tenant isolation cannot be enforced on
  metadata/layout access.
- **Import (IMP)** — the in-process source of the manuscript content tree read for the preview
  (`ManuscriptContentPort`); COMP references, never writes, it.
- **Publication (PUB)** — the in-process consumer of COMP's `GetMetadados` / `GetConfiguracaoLayout` at
  export; the contract shape is co-designed with PUB (G2).
- **Projects (PROJ)** — owns the `projetoId` COMP configuration is keyed to and the lifecycle COMP
  deliberately does not touch.
- **BFF (NestJS)** — the sole entry point for editor-facing metadata/layout configuration (TECH-003).
