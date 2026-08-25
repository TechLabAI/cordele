<!-- OUTPUT-SCHEMA
- Ubiquitous Language
- Aggregates and Entities
- Domain Events
- State Transitions
- Invariants
-->

# 03 — Initial Domain Framing

**Module:** COMP — Composição · **Bounded context:** Composition

## Ubiquitous Language

| Term | Meaning |
|---|---|
| Composition (Composição) | The configuration that turns an imported manuscript into a presentable book: its metadata plus its layout. The COMP bounded context. |
| Metadata (`Metadados`) | The book's editorial identity for a project: `titulo`, `autor`, `isbn`, `idioma`, `categoria`, `capaUrl`. Aggregate root, owned by COMP. |
| Layout (`ConfiguracaoLayout`) | The book's presentation rules for a project: body font family/size, line spacing, side margin, heading sizes H1/H2/H3, plus page-level overrides. Aggregate root, owned by COMP. |
| Cover (`capaUrl`) | Reference to the cover-image binary stored behind `FileStoragePort`; COMP holds the reference, not the bytes. |
| Layout override | A per-page / per-image adjustment (inserted blank page, image alignment) that *references* a manuscript node; it changes how content is laid out, never the content itself. |
| Alignment (`Alinhamento`) | How an image sits on the page: `full`, `centralizado`, `junto-esquerda`, `junto-direita`. |
| Preview | A read-only rendering of the manuscript content tree (from IMP) under the current layout; not persisted content. |
| Manuscript (`Manuscrito`) | The immutable imported source and content tree; owned by Import (IMP), read by COMP. |
| Editorial Project (`ProjetoEditorial`) | The title being composed; owned by Projects (PROJ). COMP configuration is keyed to its `projetoId`. |
| Publication (`Publicacao`) | A record of an ePub export; owned by Publication (PUB), which consumes COMP's configuration. |

## Aggregates and Entities

**Aggregate root: `Metadados`** (owned by Composition) — one per project

- `id` (pk), `projetoId` → `ProjetoEditorial` (PROJ)
- `titulo` (required), `autor` (required)
- `idioma` — `Idioma` value object, enum `pt | en | es | fr` (required, default `pt`)
- `isbn` (nullable, `source: mock`), `categoria` (nullable, `source: mock`)
- `capaUrl` (nullable) — reference to the cover binary in `FileStoragePort`
- `editoraNome` (nullable, `source: mock`) — denormalized display name

**Aggregate root: `ConfiguracaoLayout`** (owned by Composition) — one per project

- `id` (pk), `projetoId` → `ProjetoEditorial` (PROJ)
- `fonteCorpoFamilia` — enum `serif | sans-serif`
- `fonteCorpoTamanho` (int), `espacamentoLinha` (decimal), `margemLateral` (int)
- `h1Tamanho`, `h2Tamanho`, `h3Tamanho` (int)
- **layout overrides** (collection, POC-shaped): per-page/per-image adjustments — `{ referenciaNo, tipo:
  em-branco | imagem, alinhamento?: Alinhamento, ordem }` — each referencing a manuscript node, never
  editing it

Value objects: `Idioma` (allowed languages), `FonteCorpo` (family + size + spacing bounds),
`Alinhamento` (image placement), the layout-override entry.

Referenced from outside the boundary (not owned here): `ProjetoEditorial` (PROJ), `Manuscrito` /
content tree (IMP, read-only), the cover binary (file storage), `Publicacao` (PUB), `Editora` (global
registry).

## Domain Events

- **`MetadataUpdated`** — raised when a project's `Metadados` is created or changed (including a cover
  upload). Payload: `projetoId`, changed fields summary, `capaUrl?`, `atualizadoEm`.
- **`LayoutUpdated`** — raised when a project's `ConfiguracaoLayout` (typography or overrides) is created
  or changed. Payload: `projetoId`, `atualizadoEm`.
- **`CompositionUpdated` (anchor)** — the umbrella business fact that a project's composition changed and
  is ready to preview/export; in the POC it is realized as the two concrete events above rather than a
  separate emission.

All are past-tense facts dispatched via the in-process NestJS event emitter (`messaging.enabled =
false`; no broker). They are same-process notifications (e.g. UI/preview refresh), not a cross-process
delivery guarantee, and they do **not** drive PROJ's status — the lifecycle is PROJ's, changed by IMP/PUB
through `advanceTo`, not by COMP.

## State Transitions

Composition has no lifecycle status of its own — status lives in PROJ. The relevant transitions are the
existence and update of the two configurations, always while the project is `em_composicao`:

```
(none) --first access / import--> Metadados(draft)            [default created lazily]
Metadados(draft) --update(valid)--> Metadados(saved)          [MetadataUpdated]
Metadados(saved) --upload cover--> Metadados(saved, capaUrl)  [MetadataUpdated]

(none) --first access--> ConfiguracaoLayout(default)          [default typography]
ConfiguracaoLayout --update typography--> ConfiguracaoLayout'  [LayoutUpdated]
ConfiguracaoLayout --add/remove override--> ConfiguracaoLayout'[LayoutUpdated]
```

There is no COMP-side "published" or "locked" state in the POC; both aggregates remain editable while the
project is in composition. Re-composition after `com_erros` is just further updates.

## Invariants

1. **Manuscript is never mutated.** COMP reads the content tree and stores layout as overrides that
   reference manuscript nodes; no COMP operation writes IMP data (local ADR-002).
2. **Required metadata.** `titulo`, `autor` and `idioma` must be present and valid before the composition
   is considered complete; `idioma` ∈ `{pt, en, es, fr}` with default `pt`.
3. **One configuration per project.** At most one `Metadados` and one `ConfiguracaoLayout` exist per
   `projetoId`; both are keyed to a project owned by PROJ.
4. **Cover is a reference, not bytes.** `capaUrl` points at a `FileStoragePort` object; COMP tables never
   store the image binary (local ADR-003).
5. **No status authority.** COMP never writes `projeto_editorial` and never calls `advanceTo`; the project
   stays `em_composicao` regardless of composition activity.
6. **Tenant ownership.** Every `Metadados`/`ConfiguracaoLayout` belongs to a project of exactly one
   `Editora`; `projetoId` binds it, and all access is `EmpresaContext`-scoped.
7. **Layout values within bounds.** Font sizes, spacing, margins and heading sizes stay within the allowed
   ranges defined by the layout value objects; out-of-range values are rejected.
8. **Overrides reference valid nodes.** A layout override must reference a node that exists in the current
   manuscript content tree; dangling references are rejected (or reconciled) rather than silently kept.
