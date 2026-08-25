# SPEC-02 — Component Hierarchy — PUB (Publicação) — Frontend

> Prototype-first (D-493): the trees below are the **promoted** prototype components
> (`ExportacaoEValidacaoComponent`, `DownloadEHistoricoComponent` from
> `frontend/design-reference/angular-prototype/apps/cordele-web/src/app/screens/`), with their mocks
> (the `setInterval` progress timer, the **"Simular estado"** selector, `AVISOS_MOCK` and the
> hardcoded KPIs) stripped and wired to facades. Every component is `standalone: true`, `OnPush`.
> Prose only — no EARS section (per command rules).

## Conventions

- **Smart** components inject a facade and read its signals; they own navigation and event handlers.
- **Presentational** components receive `input()` signals and emit `output()` events; they hold no
  facade and no `HttpClient`.
- Each smart component **declares the signals it reads** (listed under the tree).

## 1. `feature-export` (T07 — `/projetos/:projetoId/exportacao-e-validacao`)

```
ExportacaoEValidacaoComponent            [smart, standalone, OnPush]   selector: app-pub-exportacao-e-validacao
├── StepBarComponent                     [presentational] (from libs/pub/navigation)  inputs: steps, activeIndex(=3 Exportar)
├── ExportProgressCardComponent          [presentational]  inputs: phase, fileName
│     ├── phase='gerando' → indeterminate "Gerando seu ePub…" (no numeric %, ADR-PUB-001 / D-N)
│     └── phase='error'   → message + "Tentar novamente" (output: retry)
├── EpubcheckResultBannerComponent       [presentational]  inputs: verdict, totalErros, totalAvisos, resumoErro
│     ├── verdict='valido'|'avisos' → success banner "✓ ePub válido e pronto para download"
│     │        └── epubcheck line "0 erros · N aviso(s) não bloqueante(s)"
│     └── verdict='erros_criticos'  → error banner "✗ Erros críticos — download bloqueado"
│              └── "N erro(s) · corrija antes de exportar"
├── EpubSummaryGridComponent             [presentational]  inputs: summary (EpubSummaryVM | null)
│     └── KpiTileComponent ×4            [presentational]  inputs: label, value  (Tamanho/Páginas/Capítulos/Imagens)
├── WarningsDetailsComponent             [presentational]  inputs: totalAvisos, avisos (may be empty — see gap)
│     └── <details> expand/collapse of non-blocking warnings (code/msg/local when available)
└── ExportActionsBarComponent            [presentational]  inputs: podeBaixar, verdict
      ├── "← Ajustar layout"          output: adjustLayout()   (→ COMP)
      └── "⬇ Baixar ePub"             output: baixar()         (enabled iff podeBaixar; → T08)
```

**Signals read by `ExportacaoEValidacaoComponent`** (from `ExportFacade`, all `.asReadonly()`):
`phase` (`gerando|valido|erros|error`), `publicacao` (`PublicacaoVM | null`), `summary`
(`EpubSummaryVM | null`), `avisos` (`AvisoVM[]`), and computed `podeBaixar`, `verdict`, `totalErros`,
`totalAvisos`, `resumoErro`.

**Facade calls:** `requestExport(projetoId)` (on entry from COMP), `resumeExport(projetoId)` (on
re-entry — resumes `gerando` if a build is in flight), `retry()`; on a valid verdict the component
navigates to `/projetos/{projetoId}/download-e-historico`; `adjustLayout()` navigates to COMP.
The status **poll** lifecycle is owned by the facade (started on request, stopped on terminal verdict
or navigate-away).

## 2. `feature-history` (T08 — `/projetos/:projetoId/download-e-historico`)

```
DownloadEHistoricoComponent              [smart, standalone, OnPush]   selector: app-pub-download-e-historico
├── ProjectPublicationHeaderComponent    [presentational]  inputs: nomeProjeto, statusChip, autor, editora
│     ├── "✓ Publicado" chip (from PROJ status)
│     ├── "Ajustar metadados / layout"  output: adjustMetadata()  (→ PROJ reopen → COMP)
│     └── "+ Nova exportação"            output: newExport()       (→ T07)
├── PublicationKpiRowComponent           [presentational]  inputs: stats (PublicationStats | null)
│     └── KpiTileComponent ×N            [presentational]  (Total / Publicadas / Com avisos / Com erros)
├── PublicationHistoryListComponent      [presentational]  inputs: publicacoes, versaoAtualId
│     └── PublicationHistoryRowComponent ×N [presentational]  inputs: publicacao, isVersaoAtual
│           ├── status icon/label (✓ Válido · N aviso(s) | ✗ N erro(s) crítico(s))
│           ├── "versão atual" tag on index 0
│           └── output: baixar(publicacaoId)  (rendered "Baixar" iff podeBaixar, else "inválido")
├── HistoryEmptyStateComponent           [presentational]  shown WHEN publicacoes is empty  (→ Nova exportação)
└── BackToLibraryLinkComponent           [presentational]  output: backToLibrary()  (→ PROJ)
```

**Signals read by `DownloadEHistoricoComponent`** (from `HistoryFacade`, `.asReadonly()`):
`status` (`loading|ready|empty|error`), `projeto` (`{ id, nome, status, editora }`), `meta`
(`{ autor }`), `publicacoes` (`PublicacaoVM[]`), `stats` (`PublicationStats | null`), and computed
`versaoAtualId` (index 0) and each row's `podeBaixar`.

**Facade calls:** `openHistory(projetoId)` (loads project header + metadata subtitle + `Publicacao[]`
+ stats), `download(publicacaoId)` (mints the signed URL and opens it), `newExport()` (navigate T07),
`adjustMetadata()` (navigate PROJ reopen → COMP), `backToLibrary()`, `retry()`.

## 3. Shared UI dependencies

Presentational tiles/cards prefer `@cordele/shared/ui-*` where an equivalent exists (feedback,
layout, tokens — especially the semantic **success / warning / error** result banners). Tool-local
bits with no shared equivalent (`EpubcheckResultBannerComponent`, `KpiTileComponent`,
`PublicationHistoryRowComponent`, `ExportProgressCardComponent`, `WarningsDetailsComponent`) live in
`libs/pub/ui`. No component imports `HttpClient`; all data comes from facade signals. The result banner
is driven **only** by `epubcheckStatus` (server-authored) — the component never computes válido vs erros
(ADR-PUB-001).
