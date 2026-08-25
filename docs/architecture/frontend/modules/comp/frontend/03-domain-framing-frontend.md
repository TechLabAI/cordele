# 03 — Domain Framing (Frontend) — COMP (Composição)

> Mirrors the BE domain language; does not redefine it. See `_brief.md` and the BE
> `03-domain-framing` for COMP (pending — M2). Data shapes derive from the BA data-model
> (draft v0.1.0) and the prototype `data-model.ts` / `mock-data.json`.

## 1. Ubiquitous Language

| Term (pt-BR) | Meaning in the UI |
|---|---|
| Composição | The step that shapes a project between import and publication — COMP's whole scope. |
| Metadados (Metadados) | Editorial metadata of the book — **an aggregate COMP owns**. Holds `titulo`, `autor`, `isbn?`, `capaUrl?`, `idioma`, `categoria?`, bound to `projetoId`. |
| Idioma (do livro) | The **book's** language (`pt`, `en`, `es`, `fr`) — a metadata field, distinct from the UI locale. |
| Capa | The cover image — uploaded to `comp-service`, referenced by `capaUrl`; preview thumbnail only in the SPA. |
| Configuração de layout (ConfiguracaoLayout) | Visual layout parameters — **an aggregate COMP owns**. Holds `fonteCorpoFamilia` (serif/sans-serif), `fonteCorpoTamanho` (12–20), `espacamentoLinha` (1.2–2.0), `margemLateral`, `h1Tamanho`, `h2Tamanho`, `h3Tamanho`, bound to `projetoId`. |
| Preview de layout | The client-side, page-by-page rendering of the manuscript with the current layout applied — an **approximation** of the exported ePub (ADR-COMP-001), never the authoritative render. |
| Manuscrito | The imported content tree (chapters → paragraphs, image count) — **read-only** in COMP; the preview reads it, COMP never mutates it (owned by IMP, immutable). |
| Página (do preview) | One rendered page in the paginator — a client-side pagination of the manuscript, not a stored entity. |
| Exportar | Advance to PUB `/exportacao-e-validacao` with `projetoId` (after persisting metadata + layout). |
| Projeto / Status | `ProjetoEditorial` + its `status` — read-only in COMP; COMP is valid only for `em_composicao`. |
| Empresa / Editora | Tenant scoping the whole workspace (resolved server-side). |

## 2. View Models (draft)

### MetadataFormVM (T05 — `/config`)

| Field | Type | Notes |
|---|---|---|
| `projetoId` | `string` | route param; scopes the aggregate |
| `titulo` | `string` | **required**; non-empty |
| `autor` | `string` | **required**; non-empty |
| `isbn` | `string \| null` | optional |
| `idioma` | `'pt' \| 'en' \| 'es' \| 'fr'` | **required**; default `pt` |
| `categoria` | `string \| null` | optional |
| `capaUrl` | `string \| null` | resolved after upload; drives thumbnail |
| `capaPreview` | `string \| null` (transient) | local object-URL while uploading |
| `status` | `'loading' \| 'ready' \| 'saving' \| 'error'` | hydrate / persist state |
| `canAdvance` | `boolean` (computed) | `titulo && autor && idioma` valid |

### LayoutVM (T06 — `/editor-de-layout-preview`)

| Field | Type | Notes |
|---|---|---|
| `projetoId` | `string` | route param |
| `fonteCorpoFamilia` | `'serif' \| 'sans-serif'` | body font |
| `fonteCorpoTamanho` | `number` | 12–20 (px) |
| `espacamentoLinha` | `number` | 1.2–2.0 |
| `margemLateral` | `number` | side margin (px) |
| `h1Tamanho` / `h2Tamanho` / `h3Tamanho` | `number` | heading sizes (px) |
| `status` | `'loading' \| 'ready' \| 'saving' \| 'error'` | hydrate / persist state |

### PreviewVM (T06 — derived from the read `Manuscrito`)

| Field | Type | Notes |
|---|---|---|
| `capitulos` | `{ n; titulo; paragrafos: string[] }[]` | read from `Manuscrito` structure; **not editable** |
| `paginaAtual` | `number` | 1-based paginator index |
| `totalPaginas` | `number` (computed) | client-side pagination of `capitulos` |
| `paginaConteudo` | `{ tipo: 'capitulo' \| 'em-branco'; ... }` | current page's content to render |
| `status` | `'loading' \| 'ready' \| 'empty' \| 'error'` | manuscript-read readiness |

## 3. UI Events

| Event | Screen | Effect |
|---|---|---|
| `openMetadata(projetoId)` | T05 | on entry: `GET` metadata; hydrate `MetadataFormVM`; `status → loading → ready/error` |
| `updateField(name, value)` | T05 | local signal update; recompute `canAdvance` |
| `uploadCover(file)` | T05 | `POST` cover → `capaUrl`; set thumbnail; inline error on failure |
| `advanceToLayout()` | T05 | persist metadata (`PUT`, pessimistic), then navigate to T06 |
| `openLayout(projetoId)` | T06 | `GET` layout + `GET` manuscript structure; hydrate `LayoutVM` + `PreviewVM` |
| `updateStyle(key, value)` | T06 | local signal update → **live** preview repaint (no round-trip) |
| `changePage(delta)` | T06 | paginator prev/next; recompute `paginaConteudo` |
| `export()` | T06 | persist layout (`PUT`, pessimistic), then navigate to PUB `/exportacao-e-validacao` with `projetoId` |
| `retry()` | T05/T06 | re-issue the failed hydrate/save |

## 4. State Transitions (UI level)

```
METADATA (T05):
  loading --get ready--> ready
  loading --get error--> error --retry--> loading
  ready --updateField--> ready (recompute canAdvance)
  ready --uploadCover ok--> ready (capaUrl set)  |  --uploadCover fail--> ready (inline error)
  ready(canAdvance) --advanceToLayout--> saving --put ok--> (navigate T06)
                                          saving --put fail--> error (edits kept)

LAYOUT (T06):
  loading --layout+manuscript ready--> ready
  loading --error--> error --retry--> loading
  ready --updateStyle--> ready (live repaint, no server call)
  ready --changePage--> ready
  ready --export--> saving --put ok--> (navigate PUB)
                     saving --put fail--> error (edits kept)
```

## 5. Invariants (client-side)

- COMP is valid **only** for a project in `em_composicao`; entering with any other status redirects
  to PROJ (the status guard enforces it) — no half-open composition state.
- **Author content is never mutated:** the preview reads `Manuscrito` and renders it; COMP holds no
  writable copy of chapters/paragraphs, and offers no text-editing affordance (core promise).
- Required metadata (`titulo`, `autor`, `idioma`) must be valid before advancing to layout;
  `canAdvance` is a `computed()` over the form signals, never a manually toggled flag.
- Layout ranges are clamped client-side to the contract: body size ∈ [12, 20], line spacing
  ∈ [1.2, 2.0]; out-of-range values are impossible to submit.
- The live preview reflects the **current in-memory** `ConfiguracaoLayout` immediately; persistence
  happens on advance/export, so an unsaved change is visible but not durable until then.
- The cover thumbnail may show a transient local object-URL, but the durable reference is always the
  server-returned `capaUrl`; on reload only `capaUrl` survives.
- Persistence is **idempotent per project** (upsert keyed by `projetoId`): saving twice yields the
  same aggregate, never a duplicate `Metadados`/`ConfiguracaoLayout` row.
