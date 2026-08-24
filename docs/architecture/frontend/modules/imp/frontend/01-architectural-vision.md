# 01 — Architectural Vision — IMP (Importação) — Frontend

> Cordelê · module `imp` · prefix `IMP` · app `cordele-web` · scope `@cordele`
> Prototype-first (D-484/D-493): the BA Angular prototype in
> `frontend/design-reference/angular-prototype/` is the visual reference and becomes the
> production frontend. This vision maps the prototype screens that belong to IMP.

## 1. Intent (UX-driven)

At the end of an IMP session, an editor has **turned a raw manuscript file into a confirmed,
chapter-aware structure inside a named project**, having seen — and consciously accepted —
every fragment the parser could not map. The user never has to trust a black box: the import
either shows a clean structure or shows exactly what was left out, and the editor decides
whether to proceed.

## 2. Problem Statement

**Current journey.** The editor opens the Word file in a desktop tool, manually splits chapters,
re-inserts images, and hopes nothing was lost. Errors are discovered late, at export time.

**New journey.** The editor names the project, drops the `.docx`/`.md` file, watches a single
"upload + analyze" progress indicator, and lands on a **Structure Review** screen that reports
chapters, images and pending fragments as first-class counters. Problems are surfaced *before*
composition, with a location and a plain-language description, and an explicit Ignore action.
Confirmation is a deliberate step, not an accident.

## 3. Personas

| Persona | Job-to-be-done | Success looks like |
|---|---|---|
| Marina — Coordenadora Editorial (primary) | "Import the author's file and trust chapters and images were captured, with problems shown before I commit." | Reaches Structure Review, understands the two pending fragments, ignores them knowingly, confirms. |
| Editorial assistant (secondary) | "Re-import a corrected file without losing the project." | Uses "Re-import another file", replaces the manuscript, keeps the project. |

## 4. MVP Scope (in)

Prototype screens owned by IMP (see `prototype-map.json`):

| Screen id | Route | Role in IMP |
|---|---|---|
| `upload` | `/upload` | **T03** — name the project, upload manuscript (`.docx`/`.md`), client-side validation, upload + parse progress. |
| `revisao-de-estrutura` | `/revisao-de-estrutura` | **T04** — parsing summary, chapter ToC, pending-fragments panel, confirm / re-import. |

- Project-name field (required, min 3 chars) and manuscript drop zone.
- Client-side file validation: extension ∈ `{.docx, .md}`, size ≤ 50 MB.
- Upload + parse progress as one continuous "Fazendo upload e analisando estrutura…" indicator.
- Structure summary: chapter / image / pending counters; collapsible chapter list.
- Pending-fragments panel: per fragment page, type, chapter, description, Ignore action.
- "Confirmar estrutura" CTA (enabled with pending items — editor decides) → advances to COMP.
- "Reimportar outro arquivo" link → back to upload.

## 5. Out of Scope (MVP)

- Inline editing of parsed chapters or manuscript text.
- Manual re-mapping of a rejected fragment (only Ignore is offered).
- Multi-file / bulk upload.
- Metadata & layout (COMP), export/validation (PUB), project library (PROJ).
- AI-assisted structure suggestions (`hasAiDrawer=false` on both screens).

## 6. Architectural Principles

- **Prototype-first (D-493):** the promoted prototype components are the production UI; IMP wires
  them to `imp-service` — it does not re-invent screens.
- **Standalone-first:** every feature and component is `standalone: true`; the single `NgModule`
  lives only in `imp.module.ts` (the lazy entry).
- **Signals-first:** feature state is held in `signal<T>` inside facades, exposed as
  `.asReadonly()`; **no NgRx** (see shared ADR — signals-first).
- **Lazy-by-default:** IMP is loaded through `@cordele/imp` via `loadChildren`; feature screens
  via `loadComponent`.
- **OnPush mandatory:** every component uses `ChangeDetectionStrategy.OnPush` (the prototype
  already does).
- **No direct HttpClient in components:** all I/O flows through a `*ApiService` in
  `libs/imp/data-access`, wrapped by `@cordele/shared/access-http-base`.
- **Nothing disappears without warning (§2.1):** unparsed fragments are always rendered; the
  pending count is a visible, non-dismissible signal.

## 7. Success Signals

| Signal | Target |
|---|---|
| Time-to-Interactive (upload screen, cold) | < 2.5 s |
| First Input Delay | < 100 ms |
| Cumulative Layout Shift | < 0.1 |
| Import flow completion rate (upload → confirm) | ≥ 85% of started imports |
| p95 latency, upload + parse for a ≤ 5 MB manuscript | reported by `imp-service`; UI keeps progress responsive (poll ≤ 2 s cadence) |
| Pending fragments read before confirm | ≥ 90% of confirms with pending items scrolled the panel (analytics assumption) |
