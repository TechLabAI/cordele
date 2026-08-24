# SPEC-02 — Component Hierarchy — IMP (Importação) — Frontend

> Prototype-first (D-493): the trees below are the **promoted** prototype components
> (`UploadComponent`, `RevisaoDeEstruturaComponent` from
> `frontend/design-reference/angular-prototype/apps/cordele-web/src/app/screens/`), with their mock
> imports stripped and wired to facades. Every component is `standalone: true`, `OnPush`.
> Prose only — no EARS section (per command rules).

## Conventions

- **Smart** components inject a facade and read its signals; they own navigation and event handlers.
- **Presentational** components receive `input()` signals and emit `output()` events; they hold no
  facade and no `HttpClient`.
- Each smart component **declares the signals it reads** (listed under the tree).

## 1. `feature-upload` (T03 — `/imp/upload`)

```
UploadComponent                         [smart, standalone, OnPush]   selector: app-imp-upload
├── StepBarComponent                    [presentational] (from libs/imp/navigation)  inputs: steps, activeIndex
├── ProjectNameFieldComponent           [presentational]  input: value  output: valueChange
│     └── (native input, required, minlength=3)
├── ManuscriptDropZoneComponent         [presentational]  inputs: accept, maxBytes, disabled
│     ├── drag-and-drop surface + click-to-select (<input type=file hidden>)
│     ├── inline validation message slot
│     └── outputs: fileSelected(File), validationError(string)
├── UploadProgressCardComponent         [presentational]  inputs: phase, progressPct, fileName, errorMessage
│     ├── phase='uploading' → determinate bar bound to progressPct
│     ├── phase='parsing'   → indeterminate "analisando estrutura…" (ADR-IMP-001)
│     └── phase='error'     → message + "Reimportar" affordance (output: retry)
└── ImportSubmitButtonComponent         [presentational]  inputs: disabled, busy  output: submit
```

**Signals read by `UploadComponent`** (from `ImportFacade`, all `.asReadonly()`):
`state` (`idle|uploading|parsing|done|error`), `progressPct`, `errorMessage`, `fileName`,
`canSubmit` (computed), plus local form signals `nome`, `file`.

**Facade calls:** `setNome(v)`, `setFile(f)`, `reset()`, `submit({ nome | projetoId })` → on `done`
the component navigates to `/imp/manuscritos/{manuscritoId}/revisao`.

## 2. `feature-review` (T04 — `/imp/manuscritos/:manuscritoId/revisao`)

```
RevisaoDeEstruturaComponent             [smart, standalone, OnPush]   selector: app-imp-revisao-de-estrutura
├── StepBarComponent                    [presentational] (step 1 complete, step 2 selected)
├── ManuscriptHeaderComponent           [presentational]  inputs: nomeArquivo, formato
├── ParsingSummaryComponent             [presentational]  inputs: totalCapitulos, totalImagens, trechosNaoParseados
│     └── CounterTileComponent ×3       [presentational]  inputs: label, value, tone
├── ChapterTocComponent                 [presentational]  inputs: capitulos, expanded
│     ├── collapsible list (partial + "+N mais")
│     └── output: toggleExpand()
├── PendingFragmentsPanelComponent      [presentational]  inputs: pendencias
│     └── PendingFragmentRowComponent ×N [presentational]  inputs: trecho
│           └── outputs: ignore(id), viewDetails(id)
└── ReviewActionsBarComponent           [presentational]  inputs: canConfirm, confirming, hasZeroChapters
      ├── "Reimportar outro arquivo"  output: reimport()
      └── "Confirmar estrutura"       output: confirm()   (enabled even with pendências)
```

**Signals read by `RevisaoDeEstruturaComponent`** (from `ReviewFacade`, `.asReadonly()`):
`status` (`loading|ready|error`), `manuscrito` (`{ nomeArquivo, formato }`), `totalCapitulos`,
`totalImagens`, `trechosNaoParseados`, `capitulos`, `pendencias`, and computed `canConfirm`,
`hasZeroChapters`, `pendingCount`.

**Facade calls:** `hydrateFrom(detail)` (from the `POST` response on the happy path) **or**
`load(manuscritoId)` (single `GET` on deep-link/reload), `ignoreFragment(id)` (optimistic),
`confirm()` → navigate to COMP.

## 3. Shared UI dependencies

Presentational tiles/cards prefer `@cordele/shared/ui-*` where an equivalent exists (feedback,
layout, tokens). Tool-local bits with no shared equivalent (`UploadProgressCardComponent`,
`CounterTileComponent`) live in `libs/imp/ui`. No component imports `HttpClient`; all data comes from
facade signals.
