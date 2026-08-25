# 06 — Risks, Gaps and Assumptions — COMP (Composição)

## 1. Risks

| # | Risk | Type | Mitigation |
|---|---|---|---|
| R1 | `comp-service` `api-contract.md` does not exist yet (M2). Endpoint shapes for metadata, layout, cover upload and manuscript-structure read are assumed. | Contract | Endpoints marked draft in doc 05; Specs phase firms them against the real contract. Treat integration as direction, not a closed contract. |
| R2 | The client-side preview is **not** the ePub renderer; the exported book may differ from what the editor tuned (fonts, pagination, image flow). | Fidelity / UX | ADR-COMP-001: preview is an explicit approximation; PUB/epubcheck owns final render. Keep preview type/spacing rules aligned to the ePub stylesheet; validate perceived fidelity against a real export (assumption A1). |
| R3 | Prototype layout editor exposes **structural** toolbar actions — "adicionar página", "inserir imagem", "remover página" — that would mutate the **immutable** `Manuscrito` and exceed the `ConfiguracaoLayout` parameter contract. | Boundary | Deferred from MVP (`comp.structuralEdits` flag **off**); actions hidden/inert until a Specs decision assigns ownership (likely IMP or a new capability), preserving the "author content untouched" promise. |
| R4 | No messaging bus (`messaging.enabled=false`): COMP cannot be notified if a project's status changes underneath it (e.g. PUB advances it). | Architecture | `compStatusGuard` re-checks status on entry; writes are guarded server-side (`409` on illegal status). Revisit only if BE adds streaming. |
| R5 | Cover upload of a large image via the SPA could stall the form or exhaust memory. | Perf / reliability | Upload is a `multipart POST` to `comp-service` returning a `capaUrl`; the SPA holds only a transient object-URL thumbnail; size/type limits enforced (`413`/`415`). |
| R6 | Prototype uses inline `oklch(...)`/`style="..."` and imports `shared/mock-data`; promotion must strip mocks, wire facades and move colours to design tokens. | Migration | Promote phase (D-493) wires `MetadataFacade`/`LayoutFacade`/`ManuscriptReadService`, removes mock imports, maps colours to `standards/design-system-tokens.md`. |
| R7 | Ownership overlap: `Metadados.idioma` (book language) vs UI locale; and metadata could be read as PROJ/PUB territory. | Boundary | COMP owns `Metadados` + `ConfiguracaoLayout` (BA data-model `refs.projetoId`); PROJ owns identity/status, PUB owns the export. `idioma` is a book field, not the UI locale — documented in doc 03. |
| R8 | Deep-link to `/config` or `/editor-de-layout-preview` for a project not in `em_composicao` (or another empresa) yields a wrong/half state. | Robustness | `compStatusGuard` admits only `em_composicao` and redirects to PROJ; `404`/`403` map to explicit "não encontrado"/access-denied states (doc 05 §5). |

## 2. Known Gaps

- No confirmed OpenAPI for `comp-service` (contract pending, M2). Endpoint names/shapes in doc 05 are provisional.
- Source of the preview's manuscript structure is unspecified — a read port on `comp-service` joining IMP's `Manuscrito`, or a direct `imp-service` read. Specs decision (doc 05 §2).
- Route shape (flat `/config` + `/editor-de-layout-preview` vs project-nested `/projetos/:projetoId/...`) is a Specs decision.
- Whether the cover image is required or optional, and its accepted formats/size limits, are unspecified (prototype treats it as optional).
- The exact set of layout parameters the ePub stylesheet honours (does the export respect H1/H2/H3 sizes and margins?) must be reconciled with PUB — the preview must not offer a control the export ignores (feeds R2).
- Fate of the prototype's structural toolbar (add/insert/remove page) — kept off in MVP (R3); its eventual owner (IMP vs a new editing capability) is undecided.
- Analytics events ("metadata saved", "layout exported") are assumed, not instrumented.

## 3. Assumptions to Validate

- The client-side preview is a *good enough* approximation of the ePub for editorial decisions (A1) — to be validated against a real epubcheck export before GA.
- One project per composition session; the editor completes metadata → layout → export in one pass (reopen re-enters the same flow).
- POC manuscripts are small enough that page-by-page client rendering stays under the 50 ms repaint budget (paginate, never render the whole book in the DOM).
- Layout parameters (font family, size, spacing, heading sizes, margins) map cleanly to the ePub stylesheet PUB generates.
- Target devices are desktop-first (editorial workflow); the style panel collapses to a bottom drawer on mobile (secondary).
- Cover image is optional for the MVP; a missing cover does not block export.

## 4. Critical Dependencies

- `comp-service` endpoints (read/upsert metadata, read/upsert layout, cover upload, manuscript-structure read) — **contract pending (M2)**.
- `@cordele/shared/*` Access Layer libs (auth-session, empresa-context, access-decision, access-http-base incl. file upload) must exist before COMP scaffolds (module-pattern precondition).
- App Shell `cordele-web` must register `COMP_MODULE_DESCRIPTOR` and route into COMP from IMP/PROJ with a `projetoId` param on `em_composicao`.
- IMP's `Manuscrito` structure (chapters/paragraphs/image count) must be readable for the preview; PROJ's `ProjetoEditorial.status` gates entry; PUB must accept `projetoId` and read COMP's persisted `Metadados`/`ConfiguracaoLayout` at export.
- Custom design-system tokens (`theme.css`) and `standards/design-system-tokens.md`; the ePub stylesheet PUB uses (to keep the preview honest — R2).
- BA data-model (`Metadados`, `ConfiguracaoLayout`, `Manuscrito`, `ProjetoEditorial`) and the prototype screens `configuracoes` + `editor-de-layout-preview`.
