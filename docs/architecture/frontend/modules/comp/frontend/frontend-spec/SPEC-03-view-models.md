# SPEC-03 — View Models — COMP (Composição) — Frontend

> View-models are Signal-based records exposed by the facades (`libs/comp/data-access`). Field shapes are
> reconciled with `api-contract.md` §6 (`Metadados`, `ConfiguracaoLayout`, `LayoutOverride`,
> `PreviewContext`). The **lazy-default** (`materialized:false`) and **stale-override** rules below are
> Specs decisions that close the Vision gaps (doc 06) and honour api-contract §0 D-M / §4.7.

## 1. `MetadataVM` (T05 — `/projetos/:projetoId/config`)

```ts
type MetadataStatus = 'loading' | 'ready' | 'saving' | 'error';
type MetadadosIdioma = 'pt' | 'en' | 'es' | 'fr';

// mapped from api-contract §6.1 Metadados
interface MetadataFormVM {
  projetoId: string;
  titulo: string;                 // required, ≤ 300
  autor: string;                  // required, ≤ 300
  isbn: string | null;            // optional (source: mock)
  idioma: MetadadosIdioma;        // required, default 'pt'
  categoria: string | null;       // optional (source: mock)
  capaUrl: string | null;         // set only by the cover endpoints (§4.3/§4.4)
  editoraNome: string | null;     // server-denormalized, read-only in the form
  materialized: boolean;          // false → never-saved default representation (D-M)
}

interface CoverVM {
  capaUrl: string | null;
  uploading: boolean;             // POST .../capa in flight
  objectUrl: string | null;       // transient thumbnail until upload resolves
  error: CoverError | null;       // 413 | 415 → inline drop-zone message
}
type CoverError = 'too-large' | 'unsupported-format';

interface MetadataVM {
  status: Signal<MetadataStatus>;
  form: Signal<MetadataFormVM>;
  cover: Signal<CoverVM>;
  materialized: Signal<boolean>;
  // computed
  canAdvance: Signal<boolean>;    // titulo && autor non-empty && idioma ∈ {pt,en,es,fr}
  fieldErrors: Signal<Partial<Record<'titulo'|'autor'|'idioma', string>>>;  // client pre-validation
}
```

**UI events exposed:** `onFieldChange(field, value)`, `onCoverSelect(file)` (→ `POST .../capa`),
`onCoverRemove()` (→ `DELETE .../capa`), `onAdvanceToLayout()` (→ `PUT .../metadados` then route to T06),
`onRetry()` (re-issue the `GET`).

**Computed rules:**
- **Lazy defaults:** a `GET` with `materialized:false` hydrates the form with typed defaults (`idioma='pt'`,
  the rest empty/null) so the form always renders; the row materializes only on the first `PUT` (D-M). The
  UI never shows a distinct "not created yet" empty screen — a project always has a T05 form.
- `canAdvance` gates "Ir para preview"; the client pre-validates so the BE `400 validation` is defensive
  (unreachable in the normal flow — SPEC-07).

## 2. `LayoutVM` (T06 — `/projetos/:projetoId/editor-de-layout-preview`)

```ts
type LayoutStatus = 'loading' | 'ready' | 'saving' | 'empty' | 'error';
type Alinhamento = 'full' | 'centralizado' | 'junto-esquerda' | 'junto-direita';

// mapped from api-contract §6.2 ConfiguracaoLayout — EXACTLY the PUB-honoured params (§7.3)
interface LayoutParamsVM {
  fonteCorpoFamilia: 'serif' | 'sans-serif';   // default 'serif'
  fonteCorpoTamanho: number;                    // 12–20, default 12
  espacamentoLinha: number;                     // 1.2–2.0, default 1.5
  margemLateral: number;                        // 10–40, default 20
  h1Tamanho: number;                            // 14–48, default 28
  h2Tamanho: number;                            // 14–48, default 22
  h3Tamanho: number;                            // 14–48, default 18
}

// one image-alignment override (api-contract §6.3) — tipo is always 'imagem' in the MVP
interface AlignmentOverrideVM {
  id: string | null;              // server-assigned; null for a not-yet-persisted local edit
  referenciaNo: string;           // read reference to an IMP content-tree node (never a write)
  alinhamento: Alinhamento;
  ordem: number;
  stale: boolean;                 // referenciaNo no longer resolves → excluded from applied/PUB set
}

interface PreviewPageVM {
  n: number;
  tipo: 'capitulo' | 'paragrafo' | 'imagem';
  titulo?: string;
  referenciaNo?: string;          // present on image pages → links to its override
  alinhamento?: Alinhamento;      // applied override (non-stale) or default 'centralizado'
}

interface PreviewVM {
  pages: Signal<PreviewPageVM[]>;
  index: Signal<number>;          // current page (0-based)
  current: Signal<PreviewPageVM>; // pages()[index()]
  total: Signal<number>;
  staleOverrides: Signal<AlignmentOverrideVM[]>;  // surfaced as a subtle notice, not an error
}

interface LayoutVM {
  status: Signal<LayoutStatus>;
  layout: Signal<LayoutParamsVM>;               // live, edited locally
  overrides: Signal<AlignmentOverrideVM[]>;     // local working set, persisted on export
  preview: PreviewVM;
  saving: Signal<boolean>;                      // PUT .../layout in flight
  // computed
  canExport: Signal<boolean>;                   // params within bounds && h1≥h2≥h3
}
```

**UI events exposed:** `onStyleChange(param, value)` (local repaint), `onAlignmentChange(referenciaNo,
alinhamento)` (mutate local override set), `onPrevPage()` / `onNextPage()`, `onExport()`
(→ `PUT .../layout` then route to PUB), `onRetryPreview()`.

**Computed rules:**
- **Lazy defaults:** a `GET .../layout` with `materialized:false` hydrates the panel with the §7.2 defaults
  (serif/12/1.5/20/28/22/18) so T06 always renders; materializes on the first `PUT` (D-M).
- **Bounds are mirrored client-side** (§7.2): sliders/inputs clamp to each field's range and enforce
  `h1 ≥ h2 ≥ h3`, so the BE `400 validation` is defensive.
- **Stale overrides** returned by `preview-context` (`stale:true`) are **excluded** from the applied preview
  and from what is written back on export (they are never re-sent), and surfaced as a subtle notice — they
  are not an error (api-contract §4.7).
- `preview.current` drives the single-page canvas; changing a page **never** issues a network call (the whole
  `PreviewContext` is loaded once on entry).

## Criterios de aceite (EARS)

- `WHEN T05 is entered, THE SYSTEM SHALL hydrate the metadata form from GET metadados [comp-meta-hydrate].`
- `WHERE the representation is materialized=false, THE SYSTEM SHALL populate the form with typed defaults and idioma=pt [comp-meta-defaults].`
- `WHILE titulo or autor is blank OR idioma is not in {pt,en,es,fr}, THE SYSTEM SHALL keep canAdvance false and disable "Ir para preview" [comp-meta-required].`
- `WHEN T06 is entered, THE SYSTEM SHALL hydrate the style panel from GET layout [comp-layout-hydrate].`
- `WHERE the representation is materialized=false, THE SYSTEM SHALL populate the style panel with the default configuration [comp-layout-defaults].`
- `WHILE any style-panel value would fall outside its bound, THE SYSTEM SHALL clamp it to the bound and SHALL keep h1Tamanho ≥ h2Tamanho ≥ h3Tamanho [comp-layout-bounds].`
- `THE SYSTEM SHALL render exactly one preview page at a time and SHALL NOT issue a network call when the editor changes the current page [comp-preview-paginate].`
- `WHERE the preview-context marks an override stale, THE SYSTEM SHALL exclude it from the applied preview and from the persisted set and SHALL surface it as a non-blocking notice [comp-stale-override].`
