# 02 — Architecture Blueprint — PUB (Publicação) — Frontend

## 1. System Boundary

The PUB frontend is a **client of `pub-service`** reached exclusively through
`@cordele/shared/access-http-base` (the shared `HttpClient` wrapper). It makes **no direct calls to
legacy systems**, storage buckets or the epubcheck binary: requesting a generation, reading a
`Publicacao` and its epubcheck verdict, listing a project's export history and downloading the ePub
are all HTTP calls to `pub-service`. The **ePub build and the epubcheck run happen server-side**; the
SPA neither compiles nor validates the file. The generated artefact is downloaded through an
**authenticated backend URL** (`arquivoUrl`) — the SPA does not hold or reconstruct the bytes. The
tenant (empresa) is resolved **server-side from the JWT `empresa` claim**; the shared interceptor may
still emit `X-Empresa-Id` for observability, but it is not the scoping authority.

> The `pub-service` `api-contract.md` is **not yet written** (M2). Endpoint shapes below are **draft
> architectural direction**, firmed in the Specs phase against the real contract.

## 2. External Actors and Systems

| Actor / System | Interaction |
|---|---|
| Authenticated editor (browser) | Session via `@cordele/shared/auth-session` (OIDC). Enters PUB from COMP's T06 "Exportar" (project `em_composicao`) or from PROJ / T08 for a `publicado`/`com_erros` project. |
| `pub-service` (BE) | `POST` request generation; `GET` `Publicacao` (latest / by id); `GET` export history for a project; `GET`/download the ePub artefact (`arquivoUrl`). **Owns `Publicacao` + the ePub artefact + the epubcheck run.** |
| `comp-service` / COMP (BE + FE) | Upstream: `pub-service` reads COMP's `Metadados` + `ConfiguracaoLayout` at build time (OPF + stylesheet inputs). On the FE, T07/T08 "Ajustar layout / metadados" **navigate back into COMP**; PUB never writes those aggregates. |
| `imp-service` / IMP (BE) | Upstream: `pub-service` reads IMP's immutable `Manuscrito` (the ePub body) at build time. PUB never mutates it. |
| `proj-service` / PROJ (BE + FE) | PUB **requests** the project status transition through PROJ's `AdvanceProjetoStatusUseCase` (`em_composicao → publicado | com_erros`, `SolicitadoPor = pub`); T08's "Voltar à biblioteca" and "Publicado" header status come from PROJ. PUB never writes `ProjetoEditorial.status`. |
| epubcheck (server-side) | Invoked by `pub-service` after the build; its verdict becomes `Publicacao.epubcheckStatus` + counts + messages. **Not reachable from the browser.** |
| File storage (disk POC / S3 prod) | Holds the `.epub` behind a `FileStoragePort`; referenced by `arquivoUrl`; the SPA downloads through the authenticated backend URL, never the bucket directly. |

No third-party widgets, no messaging bus (`messaging.enabled=false`), no AI (`ai.hasAi=false`).

## 3. End-to-End User Flows

### Golden path (export → validate → download)

```
[from COMP T06 "Exportar" | from PROJ / T08 "Nova exportação"] --> /exportacao-e-validacao (T07)
+-------------------------------------------------------------------+
| etapa 4 · Exportar            [ Importar › Configurar › Visualizar › Exportar ]
|                                                                   |
|   ( gerando )        Gerando seu ePub…   [====== 60% ]            |  <- reflects real backend build
|        |                                                          |
|        v (Publicacao terminal)                                   |
|   ( valido )  ✓ ePub válido e pronto para download               |
|               epubcheck: 0 erros · 2 aviso(s) não bloqueante(s)  |
|               [Tamanho 1,4MB][Páginas 156][Capítulos 18][Img 3]  |
|               ▸ 2 aviso(s) — não impedem a publicação            |
|               [ ← Ajustar layout ]        [ ⬇ Baixar ePub ] ------>|--> /download-e-historico (T08)
|                                                                   |
|   ( erros )   ✗ Erros críticos — download bloqueado               |
|               epubcheck: 3 erros · corrija antes de exportar     |
|               [ ← Ajustar layout ] --------------------------------->|--> [COMP] /editor-de-layout-preview
+-------------------------------------------------------------------+

/download-e-historico (T08)
+-------------------------------------------------------------------+
|  ▍ Marina no Cordel        [✓ Publicado]      [Ajustar metadados]  |
|    Autor · Editora Aetós                       [Ajustar layout]    |
|  Histórico de exportações                     [ + Nova exportação ]|
|  +-------------------------------------------------------------+  |
|  | ✓ 25/08/2026 14:32   versão atual   Válido · 2 aviso(s)  ⬇ |  |
|  | ✓ 24/08/2026 09:10                  Válido · 0 aviso(s)  ⬇ |  |
|  | ✗ 23/08/2026 18:44                  3 erro(s) crítico(s) inválido|
|  +-------------------------------------------------------------+  |
|  ← Voltar à biblioteca de projetos  (PROJ)                        |
+-------------------------------------------------------------------+
```

### Alternatives & edge cases

- **Enter T07 for a project not `em_composicao`** (e.g. a `rascunho` with no composition) → guard/route
  redirect back to PROJ; a fresh export is valid only from a composed project (Specs firms whether a
  re-export of a `publicado` project first reopens to `em_composicao` via PROJ, mirroring COMP's reopen).
- **Generation still running on (re)entry** → the screen resumes the **gerando** state bound to the
  in-flight/`pendente` `Publicacao`, not a fresh client timer (ADR-PUB-001); it resolves when the
  backend reports a terminal `epubcheckStatus`.
- **epubcheck = `avisos`** → treated as **valid + downloadable**; warnings are shown non-blocking in an
  expandable list; the download stays enabled (BA: warnings do not block publication).
- **epubcheck = `erros_criticos`** → download **blocked**; error count shown; primary action is
  "Ajustar layout" back to COMP; no `arquivoUrl` is offered.
- **Generation request fails** (5xx / network before a `Publicacao` exists) → error state on T07 with
  "Tentar novamente"; no phantom "gerando" that never resolves.
- **Download fails / link expired** (`arquivoUrl` 401/404/expired) → inline error with a re-fetch of a
  fresh authenticated URL; the SPA never falls back to a public bucket link.
- **Empty history** (T08 for a project never exported) → empty state pointing to "Nova exportação".
- **Old version download** → any past `Publicacao` with `arquivoUrl` is downloadable; rows without it
  (a `erros_criticos` export) render "inválido", not a broken download.
- **Prototype "Simular estado" selector** (gerando/válido/erros toggle in T07) is **prototype-only** and
  is **not wired** in production (R-proto); real state comes from the `Publicacao` (doc 06).

## 4. Internal Boundaries (lib structure, `module-pattern.md`)

```
libs/pub/shell-entry/  (type:app)     # ENTRY as library — importPath @cordele/pub (ADR-006)
└── src/lib/
    ├── pub.module.ts                 # the module's only NgModule (lazy entry)
    ├── pub.contract.ts               # MODULE_KEY 'pub' + ModuleMenuMetadata + permissions + flags
    ├── pub.bootstrap.ts              # init/destroy lifecycle
    ├── pub.routes.ts                 # PUB_ROUTES[]
    ├── pub.permission-map.ts         # ModulePermissionMap
    ├── pub.feature-flags.ts          # ModuleFeatureFlags (defaultState)
    ├── pub.nav.config.ts             # breadcrumb / step-bar (stage 4 Exportar)
    └── pub.descriptor.ts             # PUB_MODULE_DESCRIPTOR (consumed by Shell)

apps/pub/             (type:app)      # thin host: app.routes loads @cordele/pub
apps/pub-e2e/                         # Playwright specs

libs/pub/
├── access/          (type:domain)    # pubGuard (empresa + permission + status gate)
├── data-access/     (type:data-access)# PublicacaoApiService + ArtifactDownloadService
│                                      #   + ExportFacade + HistoryFacade (signals)
├── feature-export/  (type:feature)   # T07 — ExportacaoEValidacaoComponent (promoted from prototype)
├── feature-history/ (type:feature)   # T08 — DownloadEHistoricoComponent (promoted)
├── integration/     (type:domain)    # PubShellIntegrationService (register in Shell)
├── navigation/      (type:domain)    # step-bar / breadcrumb state (stage 4 resolver)
└── ui/ (optional)   (type:ui)        # tool-local bits (epubcheck result banner, KPI tile, history row, download button)
```

Nx tags: `scope:pub` + `type:{feature|data-access|domain|ui}`; a module lib imports only `scope:pub`
+ `scope:shared` (see `nx-boundaries.md`).

## 5. Cross-cutting Concerns

- **Auth / entitlement:** `authGuard` + `empresaGuard` + `accessGuard('pub.export')` from
  `@cordele/shared/access-decision`; plus a **status gate** — T07 (new export) admits only a project in
  `em_composicao`; T08 (download/history) is valid for a project that has at least one `Publicacao`
  (typically `publicado`/`com_erros`). Components never test status directly — the guard resolves it.
- **Tenant isolation:** empresa resolved server-side from the JWT claim; the shared interceptor injects
  Correlation (and optionally `X-Empresa-Id` for observability).
- **Observability:** correlation header from the shared interceptor; PUB emits navigation breadcrumbs
  (export requested, verdict shown, downloaded) for the pipeline event stream.
- **Design tokens:** the custom dark design system via `theme.css` tokens (`--color-brand`,
  `--bg-surface`, `--text-*`, `--color-warning-ink`, `--color-error`, success greens); the prototype
  currently uses inline `oklch(...)` and `style="..."` — production moves colours/spacing to token
  utilities (`standards/design-system-tokens.md`), especially the semantic **success / warning / error**
  result banners.
- **Error handling:** BE `ProblemDetail` → normalized `AppError` by the ErrorNormalize interceptor →
  inline feedback on the failing action (generate / download). A **validation** verdict
  (`erros_criticos`) is **domain data on a successful response**, not an HTTP error — it renders the red
  result banner, not an error toast.
- **i18n:** UI copy is pt-BR (locale.humanFacingDocs); strings kept in the feature libs.
- **Downloads:** the ePub is fetched from an authenticated `arquivoUrl` served by `pub-service`; the SPA
  triggers the download (authenticated GET → blob/redirect) but never stores or re-serves the bytes.
