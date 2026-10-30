# 06 — Risks, Gaps and Assumptions — PUB (Publicação)

## 1. Risks

| # | Risk | Type | Mitigation |
|---|---|---|---|
| R1 | `pub-service` `api-contract.md` does not exist yet (M2). Endpoint shapes for request-export, poll-status, list-history, warnings and download are assumed. | Contract | Endpoints marked draft in doc 05; Specs phase firms them against the real contract. Treat integration as direction, not a closed contract. |
| R2 | ePub generation + epubcheck may be **long-running**, and with `messaging.enabled=false` there is **no broker** to push completion — the FE cannot be notified when the build finishes. | Architecture / UX | ADR-PUB-001: the FE watches a `pendente` `Publicacao` via a **bounded status poll** (backoff, max-attempts, honest timeout state) until a terminal `epubcheckStatus`; the "gerando" affordance is real, never a client-only fake timer. Whether a synchronous long-request or a poll is used is firmed in Specs; revisit if BE adds streaming/SSE. |
| R3 | The prototype fakes everything: a `setInterval` progress timer and a manual **"Simular estado" (gerando/válido/erros)** toggle, hardcoded KPIs, and `AVISOS_MOCK`. | Migration / correctness | Promote phase (D-493) removes the timer + the state selector + all mocks, binds `phase`/`progresso`/`publicacao` to `ExportFacade`, and drives KPIs/warnings from the real `Publicacao`. The state selector must **not** ship. |
| R4 | Download-gate correctness — a `erros_criticos` or `pendente` publication must **never** expose an enabled download. A regression here ships an invalid/absent file. | Correctness / trust | `podeBaixar` is a `computed()` over `epubcheckStatus ∈ {valido, avisos}` **and** non-null `arquivoUrl`; the guard is unit- and e2e-tested; the download endpoint also enforces validity server-side (defence in depth). |
| R5 | ~~The T07 ePub summary KPIs (Tamanho/Páginas/Capítulos/Imagens) are hardcoded in the prototype; their real source is unspecified.~~ **RESOLVED (ADR-004 / api-contract D-S, 2026-09-01).** | Gap / accuracy | Tamanho/Capítulos/Imagens are a build-time snapshot on `PublicacaoStatus` (§6.1), non-null iff `status=publicado`; Páginas is permanently omitted from the contract (ePub reflowable has no fixed pagination) — a product decision, not an unspecified source. Any tile the build cannot supply (in-flight/`com_erros`, or Páginas always) is dropped, never faked. |
| R6 | Authenticated download of a large `.epub` via the SPA could stall or expose a short-lived link that expires mid-flow. | Perf / reliability | Download streams from an authenticated `pub-service` URL (blob or signed-redirect); on expiry the SPA re-fetches a fresh URL; size is bounded by the ePub, not held in memory long-term. |
| R7 | Status-transition ownership: a valid export must move the project to `publicado`, a failed one to `com_erros` — but PUB must **not** write `ProjetoEditorial.status`. | Boundary | PUB **requests** the transition through PROJ's `AdvanceProjetoStatusUseCase` (`SolicitadoPor = pub`); the FE only reflects the resulting status. Documented in docs 02/03/05; PUB owns `Publicacao` only. |
| R8 | Re-export semantics: exporting a `publicado`/`com_erros` project again — does it reopen to `em_composicao` first, append a new `Publicacao`, or both? | Boundary / lifecycle | Direction: a PROJ `reopen` (→ `em_composicao`) precedes T07 for a non-composing project, mirroring COMP's reopen; the export always appends a new record. Firmed in Specs against PROJ. |
| R9 | Deep-link to `/exportacao-e-validacao` or `/download-e-historico` for a wrong-status/other-empresa project yields a wrong/half state. | Robustness | `pubStatusGuard` admits T07 only for `em_composicao` and T08 only for a project with ≥1 publication, redirecting otherwise; `404`/`403` map to explicit "não encontrado"/access-denied states (doc 05 §5). |

## 2. Known Gaps

- No confirmed OpenAPI for `pub-service` (contract pending, M2). Endpoint names/shapes in doc 05 are provisional.
- Generation-progress mechanism (synchronous long-request vs bounded poll vs future SSE) is undecided — ADR-PUB-001 fixes the *posture* (server-authoritative, honest progress), Specs picks the mechanism.
- Source of the T07 KPI numbers (build metadata vs `Manuscrito` counts) is unspecified (R5).
- Whether warnings/KPIs are inlined in the `Publicacao` payload or fetched via separate endpoints is a Specs decision.
- Re-export/reopen contract with PROJ (R8) and the exact `SolicitadoPor` semantics are provisional.
- Whether the T08 project-header + author subtitle are proxied by `pub-service` or read from PROJ/COMP directly is undecided (doc 05 §2).
- Retention/versioning policy for old `Publicacao` artefacts (how long `arquivoUrl` stays downloadable) is unspecified.
- Analytics events ("export requested", "epub downloaded", "export failed") are assumed, not instrumented.

## 3. Assumptions to Validate

- Warnings (`avisos`) never block publication and download stays enabled for `valido`/`avisos` (BA rule) — validated against a real epubcheck run before GA.
- POC ePub builds complete within a bounded poll window (the "gerando" state resolves without an indefinite spinner); if not, streaming/SSE is added (R2).
- One export at a time per project session; a re-export appends a new `Publicacao` (append-only ledger).
- The authenticated download URL is valid long enough for the editor to complete the download, or is cheaply re-fetchable (R6).
- Target devices are desktop-first (editorial workflow); the result banners and history list reflow acceptably on mobile (secondary).
- The epubcheck verdict + counts + warnings the backend returns are sufficient for the editor to decide "download" vs "go fix layout" without a line-level remediation UI (out of MVP).

## 4. Critical Dependencies

- `pub-service` endpoints (request export, read/poll publication, list history, warnings detail, authenticated download) — **contract pending (M2)**.
- Server-side **epubcheck** integration and an **ePub build** in `pub-service` reading COMP's `Metadados`/`ConfiguracaoLayout` and IMP's `Manuscrito` — the entire verdict depends on it.
- `@cordele/shared/*` Access Layer libs (auth-session, empresa-context, access-decision, access-http-base incl. authenticated file download) must exist before PUB scaffolds (module-pattern precondition).
- App Shell `cordele-web` must register `PUB_MODULE_DESCRIPTOR` and route into PUB from COMP/PROJ with a `projetoId` param.
- PROJ's `AdvanceProjetoStatusUseCase` (the only authority for `ProjetoEditorial.status`) must accept a `pub`-requested `em_composicao → publicado | com_erros` transition; PROJ's `reopen` for re-export (R8).
- COMP's persisted `Metadados`/`ConfiguracaoLayout` and IMP's immutable `Manuscrito` must be readable by `pub-service` at build time.
- Custom design-system tokens (`theme.css`) and `standards/design-system-tokens.md` — especially the semantic success/warning/error result banners.
- BA data-model (`Publicacao`, `ProjetoEditorial`, `Metadados`, `Manuscrito`) and the prototype screens `exportacao-e-validacao` + `download-e-historico`.
