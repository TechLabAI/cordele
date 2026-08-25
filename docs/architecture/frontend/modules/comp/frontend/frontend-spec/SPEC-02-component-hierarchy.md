# SPEC-02 — Component Hierarchy — COMP (Composição) — Frontend

> Prose only — no EARS section. Component trees promoted from the BA prototype screens
> `configuracoes` (T05) and `editor-de-layout-preview` (T06) under prototype-first (D-493): the UI is not
> re-invented — it is wired to the facades, the mock imports (`shared/mock-data`) are stripped at Promote,
> and the prototype's **structural toolbar** on T06 (add / insert-image / remove page) is removed, leaving
> the alignment-only control (SPEC-05 §5, api-contract §0 D-H).

## Conventions

- **Smart** components (page-level) consume a facade, read its signals, and dispatch UI events; they never
  touch `HttpClient`. **Presentational** children take `input()`s and emit `output()`s only.
- Every component is `standalone: true`, `changeDetection: OnPush`. Selectors: `app-comp-<kebab>`.
- Each smart component **declares explicitly** the signals it reads (listed per tree below).
- The prototype's inline `oklch(...)` / `style="…"` colours move to design-token utilities at Promote
  (doc 02 §5; see `contracts/design-tokens.md`). The **preview canvas** deliberately keeps its light
  "paper" surface regardless of the dark app chrome (it simulates the printed page, not the UI).

## 1. `feature-metadata` (T05 — `/projetos/:projetoId/config`)

```
ConfiguracoesComponent                     (smart · app-comp-configuracoes)
  reads: MetadataFacade.status(), MetadataFacade.form(), MetadataFacade.canAdvance(),
         MetadataFacade.cover(), MetadataFacade.materialized()
  events: onFieldChange(field,value), onCoverSelect(file), onCoverRemove(),
          onAdvanceToLayout(), onRetry()
  │
  ├─ StepBarComponent                      (pres · app-comp-step-bar)   [libs/comp/ui]
  │     input:  steps: StepVM[], current: 'configurar'
  │             (Importar › Configurar › Edição › Exportar — fed by libs/comp/navigation)
  │
  ├─ @if status='loading' → MetadataSkeletonComponent   (pres · CLS-safe form skeleton)
  ├─ @if status='error'   → ErrorStateComponent          (shared ui-feedback; output: retry)
  │
  └─ @if status ∈ {ready,saving} → form grid
        ├─ MetadataFieldComponent × {titulo*, autor*, isbn, categoria}   (pres · app-comp-metadata-field)
        │     input:  label, value, required, error?; output: valueChange
        ├─ IdiomaSelectComponent           (pres · app-comp-idioma-select)
        │     input:  value: MetadadosIdioma; output: change   (pt|en|es|fr, default pt)
        ├─ CoverDropZoneComponent          (pres · app-comp-cover-drop-zone)   [libs/comp/ui]
        │     input:  capaUrl: string|null, uploading: boolean, error: CoverError|null
        │     output: fileSelected(File), remove()
        │             (accepts image/jpeg|png|webp ≤ 10 MB; shown only WHERE flag comp.coverUpload on)
        └─ AdvanceBarComponent             (pres · app-comp-advance-bar)
              input:  canAdvance: boolean, saving: boolean
              output: advance   → "Ir para preview" (disabled until required fields valid)
```

- `canAdvance` is derived (SPEC-03): `titulo` and `autor` non-empty **and** `idioma ∈ {pt,en,es,fr}`; the
  "Ir para preview" button is disabled otherwise (no dead-end — doc 02 §3).
- The cover drop zone surfaces its **own** inline error (`413`/`415`) without blocking the rest of the form
  (cover is optional — api-contract §0 D-L); its write affordances are hidden `WHILE` the principal lacks
  `comp.edit`.

## 2. `feature-layout` (T06 — `/projetos/:projetoId/editor-de-layout-preview`)

```
EditorDeLayoutPreviewComponent             (smart · app-comp-editor-de-layout-preview)
  reads: LayoutFacade.status(), LayoutFacade.layout(), LayoutFacade.preview(),
         LayoutFacade.canExport(), LayoutFacade.saving()
  events: onStyleChange(param,value), onAlignmentChange(nodeRef,alinhamento),
          onPrevPage(), onNextPage(), onExport(), onRetryPreview()
  │
  ├─ StepBarComponent                      (pres · reused · current: 'edicao')   [libs/comp/ui]
  ├─ ExportBarComponent                    (pres · app-comp-export-bar)
  │     input:  saving: boolean, canExport: boolean; output: export → PUB (SPEC-01)
  │
  ├─ StylePanelComponent                   (pres · app-comp-style-panel)         [libs/comp/ui]
  │     input:  layout: LayoutParamsVM
  │     output: styleChange(param, value)
  │     controls (EXACTLY the PUB-honoured set — api-contract §7.3):
  │       fonteCorpoFamilia (serif|sans-serif) · fonteCorpoTamanho (12–20) ·
  │       espacamentoLinha (1.2–2.0) · margemLateral (10–40) · h1/h2/h3Tamanho (14–48)
  │       — NO add/remove page, NO insert-image control (structural, deferred D-H)
  │
  └─ @if status='loading' → PreviewSkeletonComponent
     @if status='error'   → ErrorStateComponent (output: retry)          (5xx / network)
     @if status='empty'   → PreviewEmptyComponent (409 manuscript-missing — "nada para pré-visualizar")
     @if status ∈ {ready,saving} → preview
        └─ PreviewCanvasComponent          (pres · app-comp-preview-canvas)      [libs/comp/ui]
              input:  page: PreviewPageVM, layout: LayoutParamsVM
              output: alignmentChange(nodeRef, alinhamento)   (only on image pages)
              ├─ @if page.tipo='imagem' → ImageAlignmentBadgeComponent  (pres · app-comp-image-alignment)
              │     input:  alinhamento, stale: boolean
              │     output: change(alinhamento)   (full|centralizado|junto-esquerda|junto-direita)
              │             (shown WHERE flag comp.imageAlignment on AND principal has comp.edit)
              └─ PagePaginatorComponent    (pres · app-comp-page-paginator)
                    input:  index: number, total: number; output: prev(), next()
```

- The preview renders **one page at a time** (never the whole book in the DOM) to keep repaint low
  (doc 02 §3); the model comes from `GET .../preview-context` (data, not pixels — api-contract §4.7/§0 D-K).
- Typography changes repaint the preview **live and locally**; nothing persists until "Exportar"
  (pessimistic — SPEC-04 §4). Image alignment edits update the local override set and are written back with
  the layout on export.

## 3. Shared UI dependencies

- `@cordele/shared/ui-layout` — page shell, grid container, panel primitives.
- `@cordele/shared/ui-feedback` — `ErrorStateComponent`, toasts, skeletons, inline field errors.
- `@cordele/shared/ui-theme` — design tokens (`theme.css`), form/slider/paper-surface utilities.
- `libs/comp/ui` (module-local) — `StepBarComponent`, `CoverDropZoneComponent`, `StylePanelComponent`,
  `PreviewCanvasComponent`, `ImageAlignmentBadgeComponent`, `PagePaginatorComponent`.
