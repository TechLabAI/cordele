# Module Brief — IMP (Importação)

> Shared brief between FE and BE (D-452). Source of truth for scope and language of
> the Importação module. If the BE pipeline regenerates this file, keep both sides in sync.

- **Module prefix:** `IMP`
- **Canonical name:** `imp`
- **Display name:** Importação
- **Backend service:** `imp-service`
- **Frontend lib:** `libs/imp`
- **npm scope:** `@cordele`
- **App shell:** `cordele-web`

## 1. Problem the module solves

Editors receive manuscripts as `.docx` or `.md` files that are not ready for digital
publishing. Today, turning them into a structured, chapter-aware document requires manual
layout work in specialist tools. IMP is the **entry point of data into Cordelê**: it lets an
editor name a project, upload a manuscript, and get back a *detected structure* (chapters,
images, unparsed fragments) that they can confirm before moving on to composition. It is the
step that guarantees the platform principle **"nothing disappears without warning" (§2.1)**:
every fragment the parser could not map is surfaced, never silently dropped.

## 2. Personas

| Persona | Role | Job-to-be-done |
|---|---|---|
| Marina — Coordenadora Editorial (primary) | `COORDENADORA_EDITORIAL` | "Upload the author's Word file and trust that every chapter and image was captured, with any problem shown to me before I commit." |
| Editorial assistant (secondary) | operator | "Re-import a corrected file quickly when the first upload had issues, without losing the project." |

## 3. MVP scope (in)

- **Upload screen** (`T03`): project name field, drag-and-drop / click upload of `.docx` or `.md`, client-side type/size validation, upload + parse progress, success state.
- **Structure review screen** (`T04`): parsing summary (chapter / image / pending counters), collapsible chapter table of contents, pending-fragments panel with per-fragment location + description + "Ignore" action, "Confirm structure" CTA (enabled even with pending items — editor decides), and "Re-import another file" link back to upload.
- Manuscript is **immutable after import**; re-import creates a new parse of the file.

## 4. Out of scope (MVP)

- Inline editing of manuscript text / chapters.
- Manual re-mapping of a rejected fragment into ePub content (only Ignore is offered).
- Bulk / multi-file upload; only one manuscript per import.
- Metadata and layout configuration (owned by COMP), publication/export (owned by PUB), and project listing/lifecycle (owned by PROJ).
- AI-assisted structure suggestions (no AI drawer on these screens; `ai.hasAi=false`).

## 5. Mandatory external integrations

None third-party. The FE talks only to `imp-service` through the shared HTTP base
(`@cordele/shared/access-http-base`). File bytes are sent as `multipart/form-data`.

## 6. Hub / shared services it depends on

- `@cordele/shared/auth-session` — authenticated session (JWT claims, roles).
- `@cordele/shared/empresa-context` — active empresa (tenant); `X-Empresa-Id` header.
- `@cordele/shared/access-decision` — permission / feature-flag evaluation + navigation.
- `@cordele/shared/access-http-base` — `HttpClient` wrapper + Correlation / X-Empresa-Id / ErrorNormalize interceptors.

## 7. Anchor domain event

**"Manuscrito importado"** (manuscript imported) — the parse of an uploaded file completes and
a `Manuscrito` (with chapter/image counts and unparsed-fragment list) becomes available for
review. Confirmation of the structure advances the `ProjetoEditorial` from `rascunho` toward
`em_composicao`.

## 8. Data entities touched (BA data-model, draft v0.1.0)

- `ProjetoEditorial` (created on import: name → `rascunho`).
- `Manuscrito` (immutable after import; `formato ∈ {docx, markdown}`, `totalCapitulos`, `totalImagens`, `trechosNaoParseados`, `estrutura`).
- `Editora` (tenant / empresa scope).
