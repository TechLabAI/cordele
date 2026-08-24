# 02 — Architecture Blueprint — IMP (Importação) — Frontend

## 1. System Boundary

The IMP frontend is a **client of `imp-service`** reached exclusively through
`@cordele/shared/access-http-base` (the shared `HttpClient` wrapper). It makes **no direct calls
to legacy systems**, storage buckets, or the parser: uploading bytes and reading parse results
are both HTTP calls to `imp-service`. The tenant (empresa) is carried by the
`X-Empresa-Id` header injected by the shared HTTP interceptor.

## 2. External Actors and Systems

| Actor / System | Interaction |
|---|---|
| Authenticated editor (browser) | Session via `@cordele/shared/auth-session` (OIDC against `iam-service`). |
| `imp-service` (BE) | `POST` manuscript (`multipart/form-data`), `GET` parse status / result, `POST` ignore-fragment, `POST` confirm-structure. |
| `EmpresaContextService` | Provides active empresa; drives `X-Empresa-Id`. |
| COMP module | Downstream: on confirm, navigation hands the `projetoId` to the composition flow (`/config`). |
| PROJ module | Upstream/origin: "Novo projeto" from the project library enters IMP at `/upload`. |

No third-party widgets, no messaging bus (`messaging.enabled=false`).

## 3. End-to-End User Flows

### Golden path (upload → confirm)

```
[PROJ library] --"Novo projeto"--> /upload
        |
        v
+------------------- /upload (T03) --------------------+
| Nome do projeto: [__________]  (required, >=3)       |
| Manuscrito:                                          |
|   +------------------------------------------+       |
|   |  drag file here / click to select        |       |
|   |  .docx  .md   (<= 50 MB)                  |       |
|   +------------------------------------------+       |
|  [ Importar manuscrito ]  (disabled until valid)     |
+------------------------------------------------------+
        | POST /manuscripts (multipart) -> parseJobId
        v
   uploading/parsing  --- poll GET status ---> ready
        |
        v
+---------- /revisao-de-estrutura (T04) ---------------+
| Estrutura detectada — romance.docx                   |
| [ 18 capítulos ] [ 3 imagens ] [ 2 pendências ]      |
|  Sumário (ToC)        |  Pendências                  |
|  > Cap 1 — O Rio      |  Pág 34: tabela  [Ignorar]   |
|  > Cap 2 — A Cidade   |  Pág 67: caixa   [Ignorar]   |
|  ...                  |                              |
| <- Reimportar         [ Confirmar estrutura ] ------->|
+------------------------------------------------------+
        | POST /manuscripts/{id}/confirm
        v
     [COMP] /config
```

### Alternatives & edge cases

- **Invalid file type/size** → inline error on the drop zone, CTA stays disabled, no request sent.
- **Upload fails / network error** → error state on the progress card; retry from `idle`.
- **Parse returns 0 chapters** → summary shows `0 capítulos`; confirm is discouraged (warning), re-import suggested.
- **Parse still running when user lands on T04** → skeleton counters until status = ready (poll), then hydrate.
- **Re-import** → "Reimportar outro arquivo" returns to `/upload`; a new manuscript supersedes the previous parse for the same project.
- **Empresa switch mid-flow** → in-flight requests scoped to the previous empresa are cancelled by the Access Layer; the flow restarts from the project library.

## 4. Internal Boundaries (lib structure, `module-pattern.md`)

```
libs/imp/shell-entry/  (type:app)     # ENTRY as library — importPath @cordele/imp (ADR-006)
└── src/lib/
    ├── imp.module.ts                 # the module's only NgModule (lazy entry)
    ├── imp.contract.ts               # MODULE_KEY 'imp' + ModuleMenuMetadata + permissions + flags
    ├── imp.bootstrap.ts              # init/destroy lifecycle
    ├── imp.routes.ts                 # IMP_ROUTES[]
    ├── imp.permission-map.ts         # ModulePermissionMap
    ├── imp.feature-flags.ts          # ModuleFeatureFlags (defaultState)
    ├── imp.nav.config.ts             # breadcrumb / step-bar nav
    └── imp.descriptor.ts             # IMP_MODULE_DESCRIPTOR (consumed by Shell)

apps/imp/            (type:app)       # thin host: app.routes loads @cordele/imp
apps/imp-e2e/                         # Playwright specs

libs/imp/
├── access/         (type:domain)     # impUploadGuard (empresa + permission)
├── data-access/    (type:data-access)# ManuscriptApiService + ImportFacade + ReviewFacade (signals)
├── feature-upload/ (type:feature)    # T03 — UploadComponent (promoted from prototype)
├── feature-review/ (type:feature)    # T04 — RevisaoDeEstruturaComponent (promoted)
├── integration/    (type:domain)     # ImpShellIntegrationService (register in Shell)
├── navigation/     (type:domain)     # step-bar + breadcrumb state
└── ui/ (optional)  (type:ui)         # tool-local bits (progress card, counter tile)
```

Nx tags: `scope:imp` + `type:{feature|data-access|domain|ui}`; a module lib imports only
`scope:imp` + `scope:shared` (see `nx-boundaries.md`).

## 5. Cross-cutting Concerns

- **Auth / entitlement:** `authGuard` + `empresaGuard` + `accessGuard('imp.import')` from
  `@cordele/shared/access-decision`; components never test roles directly.
- **Tenant isolation:** `X-Empresa-Id` injected by `@cordele/shared/access-http-base`; empresa
  switch cancels in-flight import requests.
- **Observability:** correlation header from the shared interceptor; UI emits import lifecycle
  breadcrumbs for the pipeline event stream.
- **Design tokens:** the custom dark design system via `theme.css` tokens (`--color-brand`,
  `--bg-surface`, `--text-*`, `--color-warning`, …); no hard-coded colors — see
  `standards/design-system-tokens.md`.
- **Error handling:** BE `ProblemDetail` → normalized `AppError` by the ErrorNormalize
  interceptor → user feedback (inline on the drop zone / progress card).
- **i18n:** UI copy is pt-BR (locale.humanFacingDocs); strings kept in the feature libs, ready
  for extraction; technical docs stay en-US.
