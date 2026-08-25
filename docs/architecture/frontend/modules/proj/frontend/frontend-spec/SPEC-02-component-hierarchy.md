# SPEC-02 — Component Hierarchy — PROJ (Projetos) — Frontend

> Prose only — no EARS section. Component trees promoted from the BA prototype screens
> `biblioteca-de-projetos` (T02) and `download-e-historico` (T08) under prototype-first (D-493): the UI
> is not re-invented — it is wired to the facades and the mock imports are stripped at Promote.

## Conventions

- **Smart** components (page-level) consume a facade, read its signals, and dispatch UI events; they
  never touch `HttpClient`. **Presentational** children take `input()`s and emit `output()`s only.
- Every component is `standalone: true`, `changeDetection: OnPush`. Selectors: `app-proj-<kebab>`.
- Each smart component **declares explicitly** the signals it reads (listed per tree below).
- Status/badge colours move from the prototype's inline `oklch(...)` to design-token utilities at
  Promote (doc 06 R4; see `contracts/design-tokens.md`).

## 1. `feature-library` (T02 — `/biblioteca-de-projetos`)

```
BibliotecaDeProjetosComponent            (smart · app-proj-biblioteca-de-projetos)
  reads: LibraryFacade.status(), LibraryFacade.projects(), LibraryFacade.isEmpty()
  events: onNewProject(), onOpen(card), onQuickDownload(card), onRetry()
  │
  ├─ LibraryHeaderComponent              (pres · app-proj-library-header)
  │     input:  projectCount: number, empresaNome: string
  │     output: newProject         → routes to IMP /upload
  │
  ├─ @if status='loading'  → LibrarySkeletonComponent   (pres · CLS-safe skeleton cards)
  ├─ @if status='error'    → ErrorStateComponent        (shared ui-feedback; output: retry)
  ├─ @if status='empty'    → EmptyLibraryComponent      (pres · app-proj-empty-library)
  │     output: uploadFirst       → routes to IMP /upload
  │
  └─ @if status='ready'    → grid
        └─ @for project → ProjectCardComponent          (pres · app-proj-project-card)
               input:  card: ProjetoCardVM
               output: open(card), quickDownload(card)
               └─ StatusBadgeComponent                  (pres · app-proj-status-badge)
                     input: badge: StatusBadgeVM         (derived, see SPEC-03 §badge rule)
```

- `ProjectCardComponent` renders the derived **badge** (project status for `rascunho`/`em_composicao`;
  `ultimoEpubcheckStatus` once a publication exists — api-contract §6.2) and the counters
  (`totalCapitulos`/`totalImagens`). The quick-download button is shown **only** when the latest
  publication is downloadable and the flag `proj.quickDownload` is on.

## 2. `feature-history` (T08 — `/projetos/:projetoId/historico`)

```
DownloadEHistoricoComponent              (smart · app-proj-download-e-historico)
  reads: HistoryFacade.status(), HistoryFacade.header(), HistoryFacade.publications(),
         HistoryFacade.reopenPending()
  events: onReopenMetadata(), onReopenLayout(), onNewExport(), onDownload(pub), onBack()
  │
  ├─ ProjectHeaderComponent              (pres · app-proj-project-header)
  │     input:  header: ProjectHeaderVM
  │     output: adjustMetadata, adjustLayout, newExport
  │     └─ StatusBadgeComponent          (pres · reused from feature-library / libs/proj/ui)
  │
  ├─ @if status='loading' → HistorySkeletonComponent
  ├─ @if status='error'   → ErrorStateComponent (output: retry)
  │
  └─ @if status='ready'   → PublicationHistoryListComponent  (pres · app-proj-history-list)
        input:  items: PublicacaoRowVM[]
        output: download(row)
        └─ @for item → PublicationHistoryRowComponent        (pres · app-proj-history-row)
               input:  row: PublicacaoRowVM
               output: download(row)                          (only when row.canDownload)
```

- The reopen affordances (`adjustMetadata`, `adjustLayout`) are rendered in the header **only** when
  `header.status ∈ {publicado, com_erros}` and the flag `proj.reopen` is on; `reopenPending()` disables
  them while the `POST .../reopen` is in flight (pessimistic, ADR-PROJ-001 refinement).
- A row's "Baixar" affordance is rendered only when `row.canDownload` (`arquivoUrl != null`, i.e.
  `epubcheckStatus ∈ {valido, avisos}`); otherwise the row shows an "inválido"/"pendente" marker (no
  disabled-and-clickable button — doc 02 §3).

## 3. Shared UI dependencies

- `@cordele/shared/ui-layout` — page shell, grid container, header primitives.
- `@cordele/shared/ui-feedback` — `ErrorStateComponent`, toasts, skeletons.
- `@cordele/shared/ui-theme` — design tokens (`theme.css`), status/badge token utilities.
- `libs/proj/ui` (module-local) — `ProjectCardComponent`, `StatusBadgeComponent`,
  `PublicationHistoryRowComponent` shared between the two features.
