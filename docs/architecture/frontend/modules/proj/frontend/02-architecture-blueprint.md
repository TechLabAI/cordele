# 02 — Architecture Blueprint — PROJ (Projetos) — Frontend

## 1. System Boundary

The PROJ frontend is a **client of `proj-service`** reached exclusively through
`@cordele/shared/access-http-base` (the shared `HttpClient` wrapper). It makes **no direct calls to
legacy systems** or storage buckets: listing projects, reading a project's publication history and
resolving a download URL are all HTTP calls to `proj-service`. ePub bytes are **not** proxied
through the SPA — the backend returns a signed/resource URL and the browser downloads directly. The
tenant (empresa) is carried by the `X-Empresa-Id` header injected by the shared HTTP interceptor.

> The `proj-service` `api-contract.md` is **not yet written** (M2). Endpoint shapes below are
> **draft architectural direction**, firmed in the Specs phase against the real contract.

## 2. External Actors and Systems

| Actor / System | Interaction |
|---|---|
| Authenticated editor (browser) | Session via `@cordele/shared/auth-session` (OIDC against `iam-service`). |
| `proj-service` (BE) | `GET` project list, `GET` project detail, `GET` publication history, `GET` download URL for a `Publicacao`. **Owns `ProjetoEditorial`.** |
| `EmpresaContextService` | Provides active empresa; drives `X-Empresa-Id` (library is empresa-scoped). |
| IMP module | Downstream of "Novo projeto": PROJ routes to IMP `/upload`; IMP advances the project (`AdvanceProjetoStatusUseCase`, server-side) and the editor returns to PROJ. |
| COMP module | Handoff target of "Abrir" (in-composition) and "Ajustar metadados / layout": PROJ passes `projetoId`. |
| PUB module | Handoff target of "Nova exportação": PROJ passes `projetoId`; PUB writes a new `Publicacao` that shows up in PROJ history on return. |

No third-party widgets, no messaging bus (`messaging.enabled=false`), no AI (`ai.hasAi=false`).

## 3. End-to-End User Flows

### Golden path (library → resume / new / history)

```
[sign-in] --> /biblioteca-de-projetos (T02)
+-----------------------------------------------------------+
| Seus projetos            N projeto(s) · Editora Aetós     |
|                                     [ + Novo projeto ]---->|--> [IMP] /upload
| +------------------------+  +------------------------+     |
| | Romance das Cidades    |  | Poemas do Sertão       |     |
| | Editora Aetós          |  | Editora Aetós          |     |
| | Atualizado 14/06       |  | Atualizado 10/06       |     |
| | [Válido]      [v][Abrir]| | [1 aviso]     [v][Abrir]|    |
| +------------------------+  +------------------------+     |
|            |  "Abrir"                                      |
+------------|----------------------------------------------+
             v  (stage-aware route)
   rascunho -------> [IMP]  /upload | /revisao-de-estrutura
   em_composicao --> [COMP] /config | /editor-de-layout-preview
   publicado ------> /download-e-historico (T08)
                          |
                          v
+---------- /download-e-historico (T08) --------------------+
| Romance das Cidades   [Publicado]                         |
| Marina Autora · Editora Aetós   [Ajustar metadados][layout]|
| Histórico de exportações            [ Nova exportação ]-->|--> [PUB] /exportacao-e-validacao
|  (o) 14/06 15:32  versão atual  Válido      [ Baixar ]     |
|  (!) 10/06 09:11               1 aviso      [ Baixar ]     |
|  (x) 08/06 18:40               2 erros      (no download)  |
+-----------------------------------------------------------+
```

### Alternatives & edge cases

- **Empty library** → dashed empty-state card with "Enviar manuscrito" CTA → IMP `/upload`.
- **List load fails / network error** → error state replacing the grid, with a retry affordance.
- **Loading** → skeleton cards until `GET projetos` resolves (no layout shift; CLS < 0.1).
- **Open a `com_erros` project** → resumes at the stage that can fix it (PUB history / COMP), never a dead end.
- **History with a `pendente` export** → row shown without a download button; status icon distinguishes it.
- **Download of a version without `arquivoUrl`** (invalid / pending) → download affordance is absent, not disabled-and-clickable.
- **Empresa switch on the library** → the grid re-fetches for the newly active empresa (list is empresa-scoped); in-flight requests for the previous empresa are cancelled.
- **Return from PUB after a new export** → history re-fetched on entry, new `Publicacao` appears as "versão atual".

## 4. Internal Boundaries (lib structure, `module-pattern.md`)

```
libs/proj/shell-entry/  (type:app)    # ENTRY as library — importPath @cordele/proj (ADR-006)
└── src/lib/
    ├── proj.module.ts                # the module's only NgModule (lazy entry)
    ├── proj.contract.ts              # MODULE_KEY 'proj' + ModuleMenuMetadata + permissions + flags
    ├── proj.bootstrap.ts             # init/destroy lifecycle
    ├── proj.routes.ts                # PROJ_ROUTES[]
    ├── proj.permission-map.ts        # ModulePermissionMap
    ├── proj.feature-flags.ts         # ModuleFeatureFlags (defaultState)
    ├── proj.nav.config.ts            # breadcrumb / nav
    └── proj.descriptor.ts            # PROJ_MODULE_DESCRIPTOR (consumed by Shell)

apps/proj/            (type:app)      # thin host: app.routes loads @cordele/proj
apps/proj-e2e/                        # Playwright specs

libs/proj/
├── access/         (type:domain)     # projLibraryGuard (empresa + permission)
├── data-access/    (type:data-access)# ProjetoApiService + LibraryFacade + HistoryFacade (signals)
├── feature-library/(type:feature)    # T02 — BibliotecaDeProjetosComponent (promoted from prototype)
├── feature-history/(type:feature)    # T08 — DownloadEHistoricoComponent (promoted)
├── integration/    (type:domain)     # ProjShellIntegrationService (register in Shell)
├── navigation/     (type:domain)     # breadcrumb state + stage-aware "Abrir" resolver
└── ui/ (optional)  (type:ui)         # tool-local bits (project card, status badge, history row)
```

Nx tags: `scope:proj` + `type:{feature|data-access|domain|ui}`; a module lib imports only
`scope:proj` + `scope:shared` (see `nx-boundaries.md`).

## 5. Cross-cutting Concerns

- **Auth / entitlement:** `authGuard` + `empresaGuard` + `accessGuard('proj.view')` from
  `@cordele/shared/access-decision`; components never test roles directly.
- **Tenant isolation:** `X-Empresa-Id` injected by `@cordele/shared/access-http-base`; the library
  is empresa-scoped and re-fetches on empresa switch.
- **Observability:** correlation header from the shared interceptor; PROJ emits navigation
  breadcrumbs (library viewed, project opened, version downloaded) for the pipeline event stream.
- **Design tokens:** the custom dark design system via `theme.css` tokens (`--color-brand`,
  `--bg-surface`, `--text-*`, status colours via `oklch(...)` in the prototype); no hard-coded
  colours in production — status/badge colours move to token utilities (see `standards/design-system-tokens.md`).
- **Error handling:** BE `ProblemDetail` → normalized `AppError` by the ErrorNormalize interceptor →
  feedback replacing the grid (list error) or inline on a history row (download error).
- **i18n:** UI copy is pt-BR (locale.humanFacingDocs); strings kept in the feature libs, ready for
  extraction; technical docs stay en-US.
- **Downloads:** handled as a browser navigation to a backend-provided URL; the SPA never streams
  bytes and never holds the file in memory.
