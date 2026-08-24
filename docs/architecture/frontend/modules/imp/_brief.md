# Import (IMP) — Structured Brief

Source of truth for the Specs, Backlog and Scaffold phases. Derived from the techlab-ba handoff
(`technical-framing.md`, `wireframe.md`, `data-model.json`, `constraints.md`) and
`project-context.json`.

| # | Item | Answer |
|---|---|---|
| 1 | Canonical name / prefix | `imp` / **IMP** — Importação (Import) |
| 2 | Problem it solves | Independent publishers hand off manuscripts as DOCX or Markdown and re-diagram each by hand to reach a distributable book. Import deterministically converts both into one canonical, structured content tree so downstream contexts never touch the raw file again — without ever altering the author's content. |
| 3 | Primary / secondary persona | Primary: Coordenador(a) Editorial (Marina, Editora Aetós pilot). Secondary: internal dev team integrating COMP/PUB against the content tree. |
| 4 | MVP slice | Upload DOCX/Markdown (≤ 50 MB) via BFF → deterministic parse (mammoth/remark) into content tree (chapters/sections/paragraphs/images) → detect & preserve unparsed segments → extract images → persist immutable `Manuscrito` → emit `ManuscriptImported`. |
| 5 | Out of MVP scope | Text editing; metadata/layout (COMP); ePub/PDF build & epubcheck (PUB); project lifecycle/history (PROJ); formats beyond DOCX/Markdown; complex tables/equations/nested footnotes (become unparsed segments); any AI. |
| 6 | Mandatory external integrations | File storage (local disk POC / S3-compatible prod) behind `FileStoragePort`. No third-party API, no broker, no AI provider. |
| 7 | Hub / TechLab AI dependencies · inter-module events | None — `ai.hasAi = false`, no hub service. Messaging disabled (`messaging.enabled = false`): the anchor event `ManuscriptImported` is dispatched **in-process** (NestJS event emitter), consumed within the monolith (e.g. PROJ advances project status). |
| 8 | Domain anchor event | **`ManuscriptImported`** (Manuscrito importado) — a new immutable manuscript with its content tree has been persisted. |

## Fixed facts (control plane + BA)

- **Stack:** Node 22 · NestJS 11.x · pnpm · Prisma + `prisma migrate` · PostgreSQL 16 · package base `@cordele`. No Java/Spring (TECH-001).
- **Architecture:** hexagonal (shared ADR-001-hexagonal-node) inside a modular monolith (shared ADR-002-modular-monolith).
- **Multi-tenancy:** `multi-empresa`, schema-per-tenant (shared ADR-003-multi-tenancy) — `cordele_global` + `emp_<slug>`; `EmpresaContext` (AsyncLocalStorage, RULE-07). BA POC single-tenant (ADR-005) is the one-tenant special case.
- **Owned aggregate:** `Manuscrito` (immutable; `estrutura` content tree, counts, `binarioStorageKey`). References `ProjetoEditorial` / `Editora` (owned by PROJ / global).
- **Core promise:** the system never alters author content; unparsed segments are preserved and reported (framing §2.1, §2.5).

## Local ADRs

- ADR-001 — Import as a single bounded-context module (single service, not decomposed in POC).
- ADR-002 — Manuscript immutability and lossless parse (critical domain decision).

---

# FE addendum — IMP (frontend-specific)

> Sync M1.5 (D-452): the block above is the **BE-authoritative shared core** and wins on
> any conflict. What follows is frontend-only detail produced by `/fe-architect-vision`
> that has no counterpart in the BE brief; it is preserved, not overwritten.
> Pre-sync copy: `tmp/architecture-autopilot/IMP/_brief.fe.pre-sync.md`.

## Identifiers

- **Module prefix:** `IMP`
- **Canonical name:** `imp`
- **Display name:** Importação
- **Backend service:** `imp-service`
- **Frontend lib:** `libs/imp`
- **npm scope:** `@cordele`
- **App shell:** `cordele-web`

## 3. MVP scope (in)

- **Upload screen** (`T03`): project name field, drag-and-drop / click upload of `.docx` or `.md`, client-side type/size validation, upload + parse progress, success state.
- **Structure review screen** (`T04`): parsing summary (chapter / image / pending counters), collapsible chapter table of contents, pending-fragments panel with per-fragment location + description + "Ignore" action, "Confirm structure" CTA (enabled even with pending items — editor decides), and "Re-import another file" link back to upload.
- Manuscript is **immutable after import**; re-import creates a new parse of the file.

## 5. Mandatory external integrations

None third-party. The FE talks only to `imp-service` through the shared HTTP base
(`@cordele/shared/access-http-base`). File bytes are sent as `multipart/form-data`.

## 6. Hub / shared services it depends on

- `@cordele/shared/auth-session` — authenticated session (JWT claims, roles).
- `@cordele/shared/empresa-context` — active empresa (tenant); `X-Empresa-Id` header.
- `@cordele/shared/access-decision` — permission / feature-flag evaluation + navigation.
- `@cordele/shared/access-http-base` — `HttpClient` wrapper + Correlation / X-Empresa-Id / ErrorNormalize interceptors.

## 8. Data entities touched (BA data-model, draft v0.1.0)

- `ProjetoEditorial` (created on import: name → `rascunho`).
- `Manuscrito` (immutable after import; `formato ∈ {docx, markdown}`, `totalCapitulos`, `totalImagens`, `trechosNaoParseados`, `estrutura`).
- `Editora` (tenant / empresa scope).
