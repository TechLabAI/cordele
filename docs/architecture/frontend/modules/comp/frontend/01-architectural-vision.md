# 01 — Architectural Vision — COMP (Composição) — Frontend

> Cordelê · module `comp` · prefix `COMP` · app `cordele-web` · scope `@cordele`
> Prototype-first (D-484/D-493): the BA Angular prototype in
> `frontend/design-reference/angular-prototype/` is the visual reference and becomes the
> production frontend. This vision maps the prototype screens that belong to COMP.

## 1. Intent (UX-driven)

At the end of a COMP session, an editor has **declared the book's editorial metadata and shaped its
visual layout, seeing exactly how the pages will read — and can move straight to export**. COMP is
the *shaping* step between import (IMP) and publication (PUB): the manuscript's content is already
fixed and untouchable; here the editor decides **how it is presented**. Two things are true at the
end: the metadata form is complete and valid (title, author, language are set), and the layout —
body font, size, line spacing, heading sizes, margins — is applied in a live preview the editor
trusts as a faithful approximation of the exported ePub.

## 2. Problem Statement

**Current journey.** Turning a manuscript into a well-formed publication means opening a diagramming
tool (InDesign, a Word template, a CSS file), manually keying metadata into an OPF, and guessing how
type choices will render on a reader device — technical work an editor should not have to do.

**New journey.** After confirming the imported structure (IMP), the project lands in
`em_composicao` and the editor opens **Metadados do livro** (T05): a short form with clearly marked
required fields, a language selector and a drag-and-drop cover with a thumbnail preview. "Ir para
preview" opens the **layout editor** (T06): the manuscript rendered page by page, with a side panel
of sliders and selects that update the preview *live* — font family, size, line height, H1/H2/H3
sizes, side margins. When it reads right, "Exportar" hands off to PUB. No template, no OPF, no CSS.

## 3. Personas

| Persona | Job-to-be-done | Success looks like |
|---|---|---|
| Marina — Coordenadora Editorial (primary) | "Set my book's metadata and make it look right before I export — without a design tool." | Fills Título/Autor/Idioma, uploads a cover, tunes type and margins in the live preview, and clicks Exportar confident the ePub will match. |
| Editorial assistant (secondary) | "Fix the metadata / layout of a book we already shipped and re-export it." | Arrives from PROJ's "Ajustar metadados / layout" (a reopen put the project back in `em_composicao`), edits the two forms, exports again. |

## 4. MVP Scope (in)

Prototype screens owned by COMP (see `prototype-map.json`):

| Screen id | Route | Role in COMP |
|---|---|---|
| `configuracoes` | `/config` | **T05** — editorial metadata form: Título*, Autor*, ISBN (opt), Idioma* (pt/en/es/fr), Categoria (opt), cover-image drop zone + thumbnail preview; inline required-field validation; "Ir para preview" CTA (disabled until required fields valid). Step bar: stage 2 (Configurar) active. |
| `editor-de-layout-preview` | `/editor-de-layout-preview` | **T06** — page-by-page client-side preview of the manuscript chapters with a live style panel: body font (Serif/Sans-serif), body size (12–20px), line spacing (1.2–2.0), H1/H2/H3 sizes, side margins; paginator (current/total, prev/next); "Exportar" CTA → PUB. Step bar: stage 3 active. |

- Metadata form: two-column responsive grid, required fields marked `*`, disabled advance until valid.
- Cover upload: drag-and-drop or click, thumbnail preview, replace affordance; the file is uploaded to `comp-service`, which returns a `capaUrl` (SPA never holds bytes long-term).
- Layout editor: preview renders the **read** `Manuscrito` structure (chapters → paragraphs) with the current `ConfiguracaoLayout` applied via inline styles; the style panel writes to a live signal so every change is reflected without a round-trip.
- Persistence: `Metadados` and `ConfiguracaoLayout` are saved per project (idempotent upsert keyed by `projetoId`) — see doc 05 for the save trigger (on advance, pessimistic).
- "Exportar" hands off to PUB `/exportacao-e-validacao` carrying `projetoId`.

## 5. Out of Scope (MVP)

- Manuscript parsing, structure review or **any editing of author content / text** (IMP owns `Manuscrito`, which is **immutable** after import).
- Structural document operations the prototype toolbar hints at — "adicionar página", "inserir imagem", "remover página" — that would mutate the manuscript's page/image structure. These exceed the `ConfiguracaoLayout` parameter contract and touch the immutable `Manuscrito`; treated as a boundary risk (R7) and **deferred** from the MVP composition contract pending a Specs decision.
- ePub build, epubcheck validation, download or publication history (PUB / PROJ).
- Project lifecycle / status authority — COMP never writes `ProjetoEditorial.status`.
- Style/theme preset libraries, per-chapter overrides, custom fonts beyond Serif/Sans.
- Any AI assistance (`hasAiDrawer=false` on both screens).

## 6. Architectural Principles

- **Prototype-first (D-493):** the promoted `ConfiguracoesComponent` (T05) and
  `EditorDeLayoutPreviewComponent` (T06) are the production UI; COMP wires them to `comp-service` —
  it does not re-invent the forms or the preview.
- **COMP owns metadata & layout, not the project:** `Metadados` and `ConfiguracaoLayout` are COMP's
  aggregates; `ProjetoEditorial` (identity + status) is read-only here and owned by PROJ.
- **Author content is untouchable:** the preview **reads** the immutable `Manuscrito`; COMP never
  mutates chapters, paragraphs or images (the platform's core promise — "nothing the author wrote is
  altered").
- **Standalone-first:** every feature and component is `standalone: true`; the single `NgModule`
  lives only in `comp.module.ts` (the lazy entry).
- **Signals-first:** form state and live layout state are held in `signal<T>` inside facades, exposed
  as `.asReadonly()`; the live-preview binding is the canonical use case — **no NgRx**.
- **Lazy-by-default:** COMP is loaded through `@cordele/comp` via `loadChildren`; feature screens via
  `loadComponent`.
- **OnPush mandatory:** every component uses `ChangeDetectionStrategy.OnPush` (the prototype already does).
- **No direct HttpClient in components:** all I/O flows through a `*ApiService` in
  `libs/comp/data-access`, wrapped by `@cordele/shared/access-http-base`.
- **Preview is an approximation (§ADR-COMP-001):** the client-side preview shows *parameters*, not
  the real ePub render; PUB/epubcheck owns final fidelity.

## 7. Success Signals

| Signal | Target |
|---|---|
| Time-to-Interactive (metadata form, cold) | < 1.5 s |
| Live-preview update latency (slider → repaint) | < 50 ms (no server round-trip) |
| First Input Delay | < 100 ms |
| Cumulative Layout Shift (form + preview panel) | < 0.1 |
| Metadata completion success (required fields → advance enabled) | ≥ 98% of sessions reach a valid form without a dead-end |
| p95 latency, save metadata/layout (`PUT comp-service`) | reported by `comp-service`; UI shows a pending state on advance, never blocks live editing |
| "Preview matches export" perceived fidelity | qualitative — flagged as an assumption to validate against the real ePub render (R2) |
