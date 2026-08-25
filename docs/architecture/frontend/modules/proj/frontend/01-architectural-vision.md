# 01 — Architectural Vision — PROJ (Projetos) — Frontend

> Cordelê · module `proj` · prefix `PROJ` · app `cordele-web` · scope `@cordele`
> Prototype-first (D-484/D-493): the BA Angular prototype in
> `frontend/design-reference/angular-prototype/` is the visual reference and becomes the
> production frontend. This vision maps the prototype screens that belong to PROJ.

## 1. Intent (UX-driven)

At the end of a PROJ session, an editor has **seen every editorial project of the empresa in one
place, understood each project's state at a glance, and either resumed a project at the right stage
or re-downloaded a previously shipped ePub**. PROJ is the home base of Cordelê: the first screen
after sign-in, the place a new project starts from, and the durable record that no shipped
publication is ever lost. Nothing about a project's state is hidden behind another module — the
library tells the truth about `rascunho`, `em_composicao`, `publicado` and `com_erros`, and the
history keeps every export addressable.

## 2. Problem Statement

**Current journey.** An editor juggling several books keeps track of them in a spreadsheet or by
memory: which manuscript is still a draft, which is mid-composition, which shipped, and where the
last valid ePub file went. Re-downloading a delivered book means hunting through email or a folder.

**New journey.** The editor lands on **Seus projetos**, a grid where each card carries the title,
author/editora, chapter/image counts, last-activity date and a colour-coded status badge. "Novo
projeto" starts an import (IMP); "Abrir" resumes the project at the correct stage; a project that
has shipped exposes its **publication history** — every export with its epubcheck outcome and a
per-version download of the valid ones. The library is the single, always-current map of editorial
work.

## 3. Personas

| Persona | Job-to-be-done | Success looks like |
|---|---|---|
| Marina — Coordenadora Editorial (primary) | "See all my projects and their real state, resume the right one, and re-download a book I already published." | Opens the library, reads statuses at a glance, opens a `com_erros` project to fix it, and re-downloads last month's valid ePub from history. |
| Editorial assistant (secondary) | "Fetch the ePub a colleague shipped, without asking anyone." | Finds the project, opens its history, downloads the current valid version. |

## 4. MVP Scope (in)

Prototype screens owned by PROJ (see `prototype-map.json`):

| Screen id | Route | Role in PROJ |
|---|---|---|
| `biblioteca-de-projetos` | `/biblioteca-de-projetos` | **T02** — grid of project cards (title, author/editora, counters, last-activity, status badge), "Novo projeto" CTA, "Abrir" per card, per-card download shortcut, empty state. |
| `download-e-historico` | `/download-e-historico` | **T08** — project header + current status, publication-history list (datetime, epubcheck status, size, per-version download of valid versions), "Nova exportação" CTA, "Ajustar metadados / layout" links. |

- Library grid: 2 columns desktop, 1 column mobile; status badge with the four project states.
- Empty state with a "Enviar manuscrito" CTA when the empresa has no projects yet.
- "Novo projeto" → hands off to IMP at `/upload`.
- "Abrir" → resumes the project at its stage-appropriate route (draft → IMP; in-composition → COMP; published → PROJ history).
- Publication history: reverse-chronological export list; "versão atual" marker on the latest; download affordance only on valid/warning versions with an `arquivoUrl`.
- "Nova exportação" → hands off to PUB; "Ajustar metadados / layout" → hands off to COMP.

## 5. Out of Scope (MVP)

- Creating or parsing manuscripts (IMP), metadata/layout editing (COMP), ePub build & epubcheck (PUB).
- Project rename, delete, archive, duplicate; sharing / collaboration.
- Search, filter, sort or pagination of the library (single-page grid for the POC volume).
- Bulk actions across projects; multi-select.
- Role / permission administration; empresa (tenant) management.
- Any AI assistance (`hasAiDrawer=false` on both screens).

## 6. Architectural Principles

- **Prototype-first (D-493):** the promoted `BibliotecaDeProjetos` and `DownloadEHistorico`
  components are the production UI; PROJ wires them to `proj-service` — it does not re-invent screens.
- **PROJ owns the project read model:** `ProjetoEditorial` is owned by PROJ (RAG D-C); sibling
  modules navigate *into* PROJ and hand back through it, never duplicating the project list.
- **Standalone-first:** every feature and component is `standalone: true`; the single `NgModule`
  lives only in `proj.module.ts` (the lazy entry).
- **Signals-first:** feature state is held in `signal<T>` inside facades, exposed as `.asReadonly()`;
  **no NgRx** (aligns to the cordele shared signals-first scheme).
- **Lazy-by-default:** PROJ is loaded through `@cordele/proj` via `loadChildren`; feature screens
  via `loadComponent`.
- **OnPush mandatory:** every component uses `ChangeDetectionStrategy.OnPush` (the prototype already does).
- **No direct HttpClient in components:** all I/O flows through a `*ApiService` in
  `libs/proj/data-access`, wrapped by `@cordele/shared/access-http-base`.
- **Server-truthful state (§ADR-PROJ-001):** the project list and its statuses are re-read from the
  server on library (re)entry — no cross-module optimistic cache, because there is no broker to
  invalidate one.

## 7. Success Signals

| Signal | Target |
|---|---|
| Time-to-Interactive (library, cold, ≤ 20 projects) | < 2.0 s |
| First Input Delay | < 100 ms |
| Cumulative Layout Shift (grid + badges) | < 0.1 |
| "Resume the right project" success (Abrir → correct stage) | ≥ 95% of opens land on the expected route |
| p95 latency, list projects (`GET /api/proj/projetos`) | reported by `proj-service`; UI shows skeleton cards until ready |
| Re-download success from history (valid version) | ≥ 99% of download clicks resolve to the file |
