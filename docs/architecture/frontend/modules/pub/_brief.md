# Publication (PUB) — Structured Brief

Source of truth for the Specs, Backlog and Scaffold phases. Derived from the techlab-ba handoff
(`technical-framing.md`, the T07 *publicacao-e-validacao* and T08 *historico-de-publicacoes* prototype
screens, `constraints.md`), `project-context.json`, and the already-recorded boundaries of PROJ
(lifecycle authority, `AdvanceProjetoStatusUseCase` / D-C), COMP (metadata + layout read ports) and IMP
(immutable manuscript content tree).

| # | Item | Answer |
|---|---|---|
| 1 | Canonical name / prefix | `pub` / **PUB** — Publicação (Publication) |
| 2 | Problem it solves | Everything before Publication prepares a book; nothing yet produces one. An editor needs to turn the imported manuscript plus its configured metadata and layout into a **valid, distributable ePub 3** and get a file they can download — without touching XML, OPF manifests or a validator by hand. Publication is the one context that assembles the ePub, proves it is valid with **epubcheck**, and hands back a downloadable artifact, recording every attempt. |
| 3 | Primary / secondary persona | Primary: Coordenador(a) Editorial (Marina, Editora Aetós pilot) — clicks "Gerar ePub" (T07), watches it validate, downloads the file or reads the error report. Secondary: internal dev team — PROJ reads PUB's `Publicacao` records for its history view through an in-process query port instead of touching PUB's tables. |
| 4 | MVP slice | Trigger ePub 3 generation for a project (T07); **assemble** the ePub from IMP's manuscript content tree + COMP's `Metadados` and `ConfiguracaoLayout`, read in-process through their query ports (PUB copies neither); run **epubcheck** validation behind an `EpubValidationPort`; on valid → persist artifact behind `FileStoragePort`, set `Publicacao.status = publicado`, request `PROJ.advanceTo(publicado)`, expose **download**; on invalid → set `Publicacao.status = com_erros`, request `PROJ.advanceTo(com_erros)`, surface the epubcheck report; present the **publication history** per project (T08) as a list of `Publicacao` records; run the build as an **asynchronous in-process job** (trigger returns immediately, client polls status); emit `PublicationSucceeded` / `PublicationFailed` in-process. |
| 5 | Out of MVP scope | Manuscript parsing and the content tree (IMP); metadata/layout configuration (COMP); project lifecycle ownership and the status rules themselves (PROJ — PUB only *requests* `publicado`/`com_erros`, it never writes `projeto_editorial`); PDF/MOBI/AZW3 or any format other than ePub 3; in-app fixing of validation errors (the editor goes back to COMP/IMP); e-reader preview rendering; distribution to stores/KDP/Apple Books; digital signing/DRM; AI-assisted error remediation (`ai.hasAi = false`); owning `Manuscrito`/`Metadados`/`ConfiguracaoLayout`/`ProjetoEditorial` rows. |
| 6 | Mandatory external integrations | **epubcheck** — the W3C ePub validator (Java CLI/JAR), invoked through an `EpubValidationPort` adapter; its verdict is authoritative for `publicado` vs `com_erros`. Generated `.epub` binary stored behind `FileStoragePort` (local disk POC / S3-compatible prod — same port pattern IMP and COMP established). No third-party API, no broker, no AI provider. |
| 7 | Hub / TechLab AI dependencies · inter-module events | None — `ai.hasAi = false`, no hub service. Messaging disabled (`messaging.enabled = false`): PUB **reads** IMP's manuscript content tree (`ManuscriptContentPort`) and COMP's `GetMetadados` / `GetConfiguracaoLayout` synchronously in-process at assembly time; PUB **calls** `PROJ.AdvanceProjetoStatusUseCase.advanceTo({ projetoId, targetStatus })` with `publicado` or `com_erros` (D-C — PUB never writes `projeto_editorial`); PUB **exposes** a `ListPublicationsForProject` inbound query port that PROJ calls in-process for its history view; PUB **emits** `PublicationSucceeded` / `PublicationFailed` via the in-process NestJS event emitter. |
| 8 | Domain anchor event | **`EpubGenerated`** (Publicação gerada) — an ePub 3 build for a project completed and was scored by epubcheck, yielding a `Publicacao` in `publicado` or `com_erros`. Realized concretely as `PublicationSucceeded` and `PublicationFailed`. |

## Fixed facts (control plane + BA)

- **Stack:** Node 22 · NestJS 11.x · pnpm · Prisma + `prisma migrate` · PostgreSQL 16 · package base `@cordele`. No Java/Spring for the service itself (TECH-001) — the only Java is the bundled epubcheck tool, reached through an adapter as an external validator.
- **Architecture:** hexagonal (shared `ADR-*-hexagonal-node`) inside a modular monolith (shared `ADR-*-modular-monolith`).
- **Multi-tenancy:** `multi-empresa`, schema-per-tenant (shared `ADR-*-multi-tenancy`) — `cordele_global` + `emp_<slug>`; `EmpresaContext` (AsyncLocalStorage, RULE-07). BA POC single-tenant is the one-tenant special case.
- **Owned aggregate:** `Publicacao` (id, `projetoId`, `status ∈ {gerando, validando, publicado, com_erros}`, epubcheck report, artifact reference, error summary, sequence/version, timestamps). Status of the *publication attempt* is owned by PUB; the *project* status is owned by PROJ and only requested.
- **Referenced, not owned:** `ProjetoEditorial` (PROJ, authoritative project status), `Manuscrito` / content tree (IMP, immutable), `Metadados` / `ConfiguracaoLayout` (COMP), `Editora` (global registry).
- **Core promise:** Publication is the only context that produces a distributable file, and it never ships one that epubcheck has not accepted; a failed build is a first-class recorded outcome (`com_erros`), not a discarded error.

## Local ADRs

- ADR-001 — Publication as a single bounded-context module (single service, not decomposed in POC).
- ADR-002 — ePub generation runs as an **asynchronous in-process job** that drives the `Publicacao` status machine (`gerando → validando → publicado | com_erros`); the trigger endpoint returns immediately and the client polls; a build is idempotent with respect to the in-flight request (critical domain decision — the build is long-running and must not block the request or double-run).
- ADR-003 — **epubcheck** runs behind an `EpubValidationPort` adapter; its verdict is the authority for `publicado` vs `com_erros`, the report is persisted with the `Publicacao`, and the generated `.epub` binary lives behind `FileStoragePort` (PUB holds a reference, not the bytes, in its tables — mirrors IMP/COMP storage-port pattern).
