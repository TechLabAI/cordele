# 06 — Risks, Gaps and Assumptions — IMP (Importação)

## 1. Risks

| # | Risk | Type | Mitigation |
|---|---|---|---|
| R1 | Parsing a large `.docx` is slow; a single "upload+analyze" bar may look frozen. | UX / perf | Poll parse status with responsive cadence; show indeterminate "analisando estrutura…" phase distinct from upload %; set expectation copy. See ADR (parse-progress polling). |
| R2 | No messaging bus (`messaging.enabled=false`) means no push for parse completion. | Architecture | Client-side polling of the parse-job resource (documented decision). Revisit if BE adds SSE/WebSocket. |
| R3 | BE contract for `imp-service` is still draft; endpoint shapes may change. | Contract | Endpoints are marked draft in doc 05; Specs phase firms them against `imp-service` OpenAPI. |
| R4 | Editors may confirm structure with many pending fragments and be surprised later. | UX | Pending counter is prominent; a confirm with 0 chapters warns; consider a confirm dialog summarizing ignored count (Spec). |
| R5 | Large uploads over unreliable networks fail late. | Reliability | Client-side size cap (50 MB); clear error + retry from `idle`; chunked upload deferred (out of MVP). |
| R6 | Prototype components carry inline styles / mock imports; promotion must strip mocks and bind to facades. | Migration | Promote phase (D-493) wires `ReviewFacade`/`ImportFacade`, removes `shared/mock-data` imports. |
| R7 | Browser compatibility for drag-and-drop + `File` API on older browsers. | Compat | Target evergreen browsers; provide click-to-select fallback (already in prototype). |

## 2. Known Gaps

- No confirmed OpenAPI for `imp-service` yet (`docs/architecture/shared/contratos/openapi` holds
  only a README). Endpoint names in doc 05 are provisional.
- Parse-job status field names and polling contract are assumed, not specified.
- Permission keys (`imp.import`, `imp.review`, `imp.confirm`) are proposed; RBAC catalog must adopt them.
- Analytics events for "pending panel read before confirm" are assumed, not instrumented.
- The exact route shape (flat `/upload` vs nested `/projetos/:projetoId/importar`) is a Specs decision.

## 3. Assumptions to Validate

- Manuscripts are typically ≤ 5–10 MB; 50 MB is a safe hard cap (BA to confirm real distribution).
- One manuscript per project at import; re-import replaces rather than versions (BA data-model says
  `Manuscrito` is immutable after import — re-import = new manuscript).
- Import frequency is low (a few per editor per week) → no caching needed initially.
- Target devices are desktop-first (editorial workflow); mobile is single-column but secondary.
- Parse completes within a few seconds to a couple of minutes for typical files (drives poll cadence).

## 4. Critical Dependencies

- `imp-service` endpoints (upload, parse-status, ignore-fragment, confirm).
- `@cordele/shared/*` Access Layer libs (auth-session, empresa-context, access-decision,
  access-http-base) must exist before IMP scaffolds (module-pattern precondition).
- App Shell `cordele-web` must register `IMP_MODULE_DESCRIPTOR`.
- Custom design-system tokens (`theme.css`) and `standards/design-system-tokens.md`.
- BA data-model (`ProjetoEditorial`, `Manuscrito`) and the prototype screens `upload` +
  `revisao-de-estrutura`.
