# 02 — Architecture Blueprint — COMP (Composição) — Frontend

## 1. System Boundary

The COMP frontend is a **client of `comp-service`** reached exclusively through
`@cordele/shared/access-http-base` (the shared `HttpClient` wrapper). It makes **no direct calls to
legacy systems** or storage buckets: reading a project's existing metadata/layout, reading the
manuscript structure that feeds the preview, uploading a cover image and persisting metadata/layout
are all HTTP calls to `comp-service`. Cover-image bytes are uploaded once and thereafter referenced
by a `capaUrl` returned by the backend — the SPA does not hold the file. The tenant (empresa) is
resolved **server-side from the JWT `empresa` claim**; the shared interceptor may still emit
`X-Empresa-Id` for observability, but it is not the scoping authority.

> The `comp-service` `api-contract.md` is **not yet written** (M2). Endpoint shapes below are
> **draft architectural direction**, firmed in the Specs phase against the real contract.

## 2. External Actors and Systems

| Actor / System | Interaction |
|---|---|
| Authenticated editor (browser) | Session via `@cordele/shared/auth-session` (OIDC). Only enters COMP when the project is `em_composicao`. |
| `comp-service` (BE) | `GET`/`PUT` `Metadados`; `GET`/`PUT` `ConfiguracaoLayout`; `POST` cover upload → `capaUrl`; `GET` manuscript structure summary (chapters/paragraphs/images) for the preview. **Owns `Metadados` + `ConfiguracaoLayout`.** |
| `proj-service` / PROJ (BE + FE) | Upstream of COMP: PROJ's "Abrir" (em_composicao) and "Ajustar metadados / layout" (after a `reopen`) route into COMP with `projetoId`. COMP hands control back by navigating; it never writes project status. |
| IMP module | Upstream: after IMP confirms the imported structure, the backend advances the project to `em_composicao` and the editor enters COMP. COMP **reads** the `Manuscrito` IMP produced. |
| PUB module | Downstream: T06 "Exportar" navigates to PUB `/exportacao-e-validacao` with `projetoId`; PUB reads the `Metadados`/`ConfiguracaoLayout` COMP persisted. |

No third-party widgets, no messaging bus (`messaging.enabled=false`), no AI (`ai.hasAi=false`).

## 3. End-to-End User Flows

### Golden path (metadata → layout → export)

```
[from PROJ "Abrir"/"Ajustar" | from IMP confirm] --> /config (T05)
+-----------------------------------------------------------+
| Metadados do livro            (etapa 2 · Configurar)      |
| Título*        [___________________________]              |
| Autor*         [______________]  ISBN [__________]        |
| Idioma* (pt v) Categoria [________________]               |
| Capa           [  drop / preview  ]                       |
|                              [ Ir para preview ] ---------->|
+-----------------------------------------------------------+
                              | (required fields valid)
                              v
+---------- /editor-de-layout-preview (T06) ----------------+
| etapa 3 · Edição            manuscrito.docx  [ Exportar ]-->|--> [PUB] /exportacao-e-validacao
| +------------------+  +---------------------------------+  |
| | Estilos          |  |  Capítulo 1 — O Rio             |  |
| | Fonte  (Serif v) |  |  A cidade acordou cedo...       |  |
| | Corpo   [==16px] |  |  ...                            |  |
| | Linha   [=1.6 ]  |  |                                 |  |
| | H1/H2/H3 [ ][ ][]|  |   « página 1 / N »              |  |
| | Margem  [=48px]  |  |                                 |  |
| +------------------+  +---------------------------------+  |
|      (live)               (repaints on every change)      |
+-----------------------------------------------------------+
```

### Alternatives & edge cases

- **Enter COMP for a project not in `em_composicao`** → guard/route redirect back to PROJ (COMP is only valid for that status; deep-link to a `rascunho`/`publicado` project must not open a half-state).
- **Existing metadata/layout on entry** (reopen case) → both forms hydrate from `GET` so the editor edits, not re-enters.
- **Required field empty** → "Ir para preview" stays disabled; inline `*`-marked validation, no dead-end.
- **Cover upload fails** → inline error on the drop zone with retry; the rest of the form is unaffected; advance is not blocked by an *optional*-but-failed cover unless a Spec makes cover required.
- **Manuscript structure unavailable** (preview read fails) → preview area shows an error/empty state with retry; the style panel still works against a placeholder so the editor is not fully blocked (Specs decision).
- **Save on advance fails** (`PUT` metadata/layout) → advance is halted, error surfaced, local edits preserved (pessimistic; nothing lost).
- **Large manuscript** → the preview paginates and renders one page at a time (never the whole book in the DOM) to keep repaint < 50 ms.
- **Structural toolbar actions** (add/insert/remove page) present in the prototype → **not wired** in the MVP (R7); either hidden or inert-with-tooltip pending the Specs boundary decision.

## 4. Internal Boundaries (lib structure, `module-pattern.md`)

```
libs/comp/shell-entry/  (type:app)    # ENTRY as library — importPath @cordele/comp (ADR-006)
└── src/lib/
    ├── comp.module.ts                # the module's only NgModule (lazy entry)
    ├── comp.contract.ts              # MODULE_KEY 'comp' + ModuleMenuMetadata + permissions + flags
    ├── comp.bootstrap.ts             # init/destroy lifecycle
    ├── comp.routes.ts                # COMP_ROUTES[]
    ├── comp.permission-map.ts        # ModulePermissionMap
    ├── comp.feature-flags.ts         # ModuleFeatureFlags (defaultState)
    ├── comp.nav.config.ts            # breadcrumb / nav (step bar)
    └── comp.descriptor.ts            # COMP_MODULE_DESCRIPTOR (consumed by Shell)

apps/comp/            (type:app)      # thin host: app.routes loads @cordele/comp
apps/comp-e2e/                        # Playwright specs

libs/comp/
├── access/         (type:domain)     # compGuard (empresa + permission + status=em_composicao)
├── data-access/    (type:data-access)# MetadadosApiService + LayoutApiService + ManuscriptReadService
│                                     #   + MetadataFacade + LayoutFacade (signals)
├── feature-metadata/(type:feature)   # T05 — ConfiguracoesComponent (promoted from prototype)
├── feature-layout/ (type:feature)    # T06 — EditorDeLayoutPreviewComponent (promoted)
├── integration/    (type:domain)     # CompShellIntegrationService (register in Shell)
├── navigation/     (type:domain)     # step-bar / breadcrumb state + em_composicao stage resolver
└── ui/ (optional)  (type:ui)         # tool-local bits (cover drop zone, style slider, preview page)
```

Nx tags: `scope:comp` + `type:{feature|data-access|domain|ui}`; a module lib imports only
`scope:comp` + `scope:shared` (see `nx-boundaries.md`).

## 5. Cross-cutting Concerns

- **Auth / entitlement:** `authGuard` + `empresaGuard` + `accessGuard('comp.edit')` from
  `@cordele/shared/access-decision`; plus a **status guard** that admits COMP only for a project in
  `em_composicao` (components never test status directly — the guard resolves it).
- **Tenant isolation:** empresa resolved server-side from the JWT claim; the shared interceptor
  injects Correlation (and optionally `X-Empresa-Id` for observability).
- **Observability:** correlation header from the shared interceptor; COMP emits navigation
  breadcrumbs (metadata opened, layout opened, exported) for the pipeline event stream.
- **Design tokens:** the custom dark design system via `theme.css` tokens (`--color-brand`,
  `--bg-surface`, `--text-*`, `--border-*`); the prototype currently uses inline `oklch(...)` and
  `style="..."` — production moves colours/spacing to token utilities
  (`standards/design-system-tokens.md`). The **preview canvas** deliberately renders on a light
  "paper" surface regardless of the dark app chrome (it simulates the page, not the UI).
- **Error handling:** BE `ProblemDetail` → normalized `AppError` by the ErrorNormalize interceptor →
  inline feedback on the failing form field / drop zone / preview area.
- **i18n:** UI copy is pt-BR (locale.humanFacingDocs); strings kept in the feature libs; the
  `Metadados.idioma` selector (pt/en/es/fr) sets the **book's** language, distinct from the UI locale.
- **Uploads:** the cover is `POST`ed to `comp-service` which returns a `capaUrl`; the SPA holds only
  a transient object-URL for the thumbnail preview until the upload resolves.
