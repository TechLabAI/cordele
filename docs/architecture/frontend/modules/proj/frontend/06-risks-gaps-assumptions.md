# 06 — Risks, Gaps and Assumptions — PROJ (Projetos)

## 1. Risks

| # | Risk | Type | Mitigation |
|---|---|---|---|
| R1 | `proj-service` `api-contract.md` does not exist yet (M2). Endpoint shapes for list / history / download are assumed. | Contract | Endpoints marked draft in doc 05; Specs phase firms them against the real contract. Treat integration as direction, not a closed contract. |
| R2 | No messaging bus (`messaging.enabled=false`): PROJ cannot be pushed status/history changes made by IMP/COMP/PUB. | Architecture | Re-fetch on library / history (re)entry (ADR-PROJ-001). Revisit only if BE adds SSE/WebSocket. |
| R3 | Stage-aware "Abrir" can dead-end if the status→route map is incomplete (prototype hard-links to `/editor-de-layout-preview`). | UX | Resolver in `libs/proj/navigation` covers all four statuses; unit-tested; prototype link replaced at Promote. |
| R4 | Prototype cards use `oklch(...)` inline styles and import `shared/mock-data`; promotion must strip mocks and move colours to design tokens. | Migration | Promote phase (D-493) wires `LibraryFacade`/`HistoryFacade`, removes mock imports, maps status colours to `standards/design-system-tokens.md`. |
| R5 | Download of large ePubs via a SPA-held blob would exhaust memory. | Perf / reliability | Download is a browser navigation to a backend-provided URL; the SPA never proxies bytes (doc 02 §1). |
| R6 | Library has no search / filter / pagination; at scale the single grid degrades. | Scalability | Acceptable for POC volume (≤ ~20 projects); pagination/filter deferred and flagged as an assumption to validate. |
| R7 | Ownership overlap: `download-e-historico` could be read as PUB. Misassignment would split project history across modules. | Boundary | PROJ's charter is "project lifecycle + publication history"; PUB owns the *act* of exporting/validating (`exportacao-e-validacao`), PROJ owns the *record* (history + re-download). Confirmed against `prototype-map.json` and RAG D-C (PROJ owns `ProjetoEditorial`). |
| R8 | Deep-link to a stale `projetoId` (deleted / other empresa) yields a 404/403. | Robustness | Explicit "não encontrado" / access-denied states with a link back to the library (doc 05 §5). |

## 2. Known Gaps

- No confirmed OpenAPI for `proj-service` (contract pending, M2). Endpoint names in doc 05 are provisional.
- Card counters (`totalCapitulos` / `totalImagens`) source is unspecified — likely a join on `Manuscrito`; the list response shape must include them or PROJ needs a second call (Specs decision).
- Permission keys (`proj.view`, `proj.open`, `proj.download`) are proposed; the RBAC catalog must adopt them.
- The exact route shape (flat `/download-e-historico` vs nested `/projetos/:projetoId/historico`) is a Specs decision.
- Whether the card status badge is the raw `ProjetoEditorial.status` or a projection that folds in the latest `Publicacao.epubcheckStatus` (`com_erros`) is a Specs decision (the prototype uses the raw field).
- Analytics events ("project opened", "version downloaded") are assumed, not instrumented.

## 3. Assumptions to Validate

- POC volume is small (≤ ~20 projects per empresa) → no search / filter / pagination initially.
- One editora (empresa) per session; the library is always empresa-scoped (POC single-tenant: Editora Aetós).
- Re-fetch on entry is cheap enough at POC volume; caching is unnecessary until proven otherwise.
- Downloads resolve to a stable/short-lived signed URL served by `proj-service`; the browser handles the save.
- Target devices are desktop-first (editorial workflow); the grid collapses to one column on mobile (secondary).
- Every project status maps to exactly one sensible resume route (validated by the navigation resolver).

## 4. Critical Dependencies

- `proj-service` endpoints (list projects, project detail, publication history, download URL) — **contract pending (M2)**.
- `@cordele/shared/*` Access Layer libs (auth-session, empresa-context, access-decision, access-http-base) must exist before PROJ scaffolds (module-pattern precondition).
- App Shell `cordele-web` must register `PROJ_MODULE_DESCRIPTOR` and make PROJ the default landing module.
- Sibling modules IMP (`/upload`), COMP (`/config`, `/editor-de-layout-preview`) and PUB (`/exportacao-e-validacao`) must accept a `projetoId` route param for the handoffs.
- Custom design-system tokens (`theme.css`) and `standards/design-system-tokens.md` (status/badge colours).
- BA data-model (`ProjetoEditorial`, `Publicacao`, `Manuscrito`, `Metadados`) and the prototype screens `biblioteca-de-projetos` + `download-e-historico`.
