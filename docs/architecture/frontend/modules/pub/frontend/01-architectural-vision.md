# 01 — Architectural Vision — PUB (Publicação) — Frontend

> Cordelê · module `pub` · prefix `PUB` · app `cordele-web` · scope `@cordele`
> Prototype-first (D-484/D-493): the BA Angular prototype in
> `frontend/design-reference/angular-prototype/` is the visual reference and becomes the
> production frontend. This vision maps the prototype screens that belong to PUB.

## 1. Intent (UX-driven)

At the end of a PUB session, an editor has **turned a configured project into a valid, downloadable
ePub 3 — and knows it is valid because epubcheck said so**. PUB is the *closing* step of the
pipeline: import (IMP) fixed the content, composition (COMP) shaped its metadata and layout, and here
the book is **built, validated and shipped**. Two things are true at the end: a `Publicacao` record
exists carrying an authoritative epubcheck verdict, and — when that verdict is `valido`/`avisos` — the
editor holds a downloadable `.epub` file, with a full history of every export they can return to.

## 2. Problem Statement

**Current journey.** Producing a distributable ePub means running a build toolchain, then running
epubcheck from a terminal, then reading a wall of validator output to decide whether the file is
actually shippable — technical work an editor should not have to do, and a validity call they cannot
confidently make.

**New journey.** From COMP's layout editor the editor clicks **Exportar** and lands on
**Exportação e validação** (T07): a progress state while `pub-service` builds the ePub and runs
epubcheck, then one of two honest verdicts — **válido** (a green result with the epubcheck summary,
the ePub's size/pages/chapters/images, any *non-blocking* warnings, and a "Baixar ePub" button) or
**erros críticos** (a red result that **blocks the download** and points back to COMP to fix the
layout). Downloading and the full **history of exports** live on **Download e histórico** (T08), where
every past `Publicacao` is listed newest-first with its status and a per-version download. No
terminal, no epubcheck output to decode, no guessing whether the file is valid.

## 3. Personas

| Persona | Job-to-be-done | Success looks like |
|---|---|---|
| Marina — Coordenadora Editorial (primary) | "Export my book to a valid ePub and download it — and tell me plainly if something is wrong." | Clicks Exportar, watches the build, reads a clear válido/erros verdict, downloads the `.epub` (or is sent back to fix layout), and can re-download any prior version. |
| Editorial assistant (secondary) | "Re-export a project we already shipped, or grab an older version of the file." | Opens T08 for a `publicado` project, sees the export history, downloads the current or a previous valid version, or starts a "Nova exportação". |

## 4. MVP Scope (in)

Prototype screens owned by PUB:

| Screen id | Route | Role in PUB |
|---|---|---|
| `exportacao-e-validacao` | `/exportacao-e-validacao` | **T07** — request ePub generation for the project; show **gerando** (progress), **válido** (epubcheck `0 erros · N aviso(s)`, ePub summary KPIs — Tamanho/Páginas/Capítulos/Imagens, expandable non-blocking warnings with `code`/`msg`/`local`, "Baixar ePub" → T08), **erros críticos** (error count, download blocked, "Ajustar layout" → COMP). Step bar: stage 4 (Exportar) active. |
| `download-e-historico` | `/download-e-historico` | **T08** — project header (name, "Publicado" chip, author · editora), "Ajustar metadados / layout" → COMP, "Nova exportação" → T07, and the **publication history**: every `Publicacao` newest-first with a status icon/label, a "versão atual" tag on the latest, a per-item "Baixar" when `arquivoUrl` is present (else "inválido"); "Voltar à biblioteca de projetos" → PROJ. |

- Generation is a **server** action: the SPA requests it, then reflects an authoritative `Publicacao`; the browser never builds the ePub or runs epubcheck.
- The **gerando** state reflects a real in-flight backend build (the prototype's client-side timer is replaced by a real completion/status signal — see doc 05 and ADR-PUB-001); the progress affordance stays, its source becomes authoritative.
- The epubcheck verdict is **rendered, not computed**: `epubcheckStatus`, `totalErros`, `totalAvisos` and the warnings list come from `pub-service`.
- **Download is gated by validity:** the "Baixar" affordance is enabled only when `epubcheckStatus ∈ {valido, avisos}`; a `erros_criticos` publication shows "inválido"/blocked and offers the fix path back to COMP.
- Download streams the artefact from an **authenticated backend URL** (`arquivoUrl`); the SPA never holds or reconstructs the file bytes.
- History lists all `Publicacao` rows for the project, newest first, with the latest tagged "versão atual".
- "Exportar" (a valid export) is what drives the project to `publicado`; PUB **requests** that transition through PROJ — it does not write the status itself.

## 5. Out of Scope (MVP)

- Building or validating the ePub in the browser — `pub-service` owns the ePub build **and** the epubcheck run; the SPA renders the result (ADR-PUB-001).
- Editing metadata, layout or manuscript content — the "Ajustar metadados / layout" links **navigate to COMP**; PUB never writes `Metadados`/`ConfiguracaoLayout` and never touches the immutable `Manuscrito`.
- Owning the project lifecycle — PUB **requests** `em_composicao → publicado|com_erros` via PROJ's `AdvanceProjetoStatusUseCase`; it does not author `ProjetoEditorial.status`.
- A line-by-line epubcheck remediation editor, auto-fixing of errors, or re-running only the validator — the fix path is "go back to COMP and re-export".
- PDF export, store distribution (KDP/Kobo), DRM, e-mail delivery, scheduled/queued exports.
- Any AI assistance (`hasAiDrawer = false` on both screens; `ai.hasAi = false`).

## 6. Architectural Principles

- **Prototype-first (D-493):** the promoted `ExportacaoEValidacaoComponent` (T07) and
  `DownloadEHistoricoComponent` (T08) are the production UI; PUB wires them to `pub-service` — it does
  not re-invent the result banners, the history list or the KPI grid.
- **PUB owns the export ledger, not the project:** `Publicacao` is PUB's aggregate; `ProjetoEditorial`
  (identity + status) is read-only here and owned by PROJ; `Metadados`/`ConfiguracaoLayout` are COMP's;
  `Manuscrito` is IMP's (immutable).
- **Validity is server-authoritative (§ADR-PUB-001):** epubcheck runs on the backend; the FE renders
  `epubcheckStatus` and never derives a válido/erros verdict client-side.
- **Download gated by epubcheck:** the file is downloadable **iff** the publication is valid; the UI
  never offers a download for a `erros_criticos`/`pendente` record.
- **Standalone-first:** every feature and component is `standalone: true`; the single `NgModule` lives
  only in `pub.module.ts` (the lazy entry).
- **Signals-first:** export state (`gerando → valido | erros`) and the history list are held in
  `signal<T>` inside facades, exposed as `.asReadonly()` — **no NgRx**.
- **Lazy-by-default:** PUB is loaded through `@cordele/pub` via `loadChildren`; feature screens via
  `loadComponent`.
- **OnPush mandatory:** every component uses `ChangeDetectionStrategy.OnPush` (the prototype already does).
- **No direct HttpClient in components:** all I/O flows through a `*ApiService` in
  `libs/pub/data-access`, wrapped by `@cordele/shared/access-http-base`.

## 7. Success Signals

| Signal | Target |
|---|---|
| Time-to-Interactive (export screen, cold) | < 1.5 s |
| Verdict clarity (editor correctly reads válido vs erros without help) | qualitative — the banner + epubcheck summary make the download decision unambiguous |
| Download-gate correctness | 100% — a `erros_criticos`/`pendente` publication **never** exposes an enabled download |
| First Input Delay | < 100 ms |
| Cumulative Layout Shift (state transitions gerando→result) | < 0.1 — reserved layout space so the banner swap does not jump |
| p95 latency, request export + poll to terminal state | reported by `pub-service`; the UI shows an honest in-progress state and never fabricates completion (ADR-PUB-001) |
| Download success (valid publication → file delivered) | ≥ 99% of valid publications download without a client-side failure |
