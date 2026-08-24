# 05 — State and Data Flow — IMP (Importação)

## 1. State Topology

| State | Owner | Kind |
|---|---|---|
| Session, roles | `@cordele/shared/auth-session` | global signal |
| Active empresa | `@cordele/shared/empresa-context` | global signal |
| Upload state machine (`idle→uploading→parsing→done→error`), progress, `projetoId` | `ImportFacade` (`libs/imp/data-access`) | local signal |
| Manuscript summary + chapter list + pending fragments + `status` | `ReviewFacade` (`libs/imp/data-access`) | local signal |
| Step-bar / breadcrumb position | `libs/imp/navigation` | local signal |

No cross-module shared state: IMP hands off to COMP only through route params (`projetoId`).

## 2. Data Access Pattern

- Components never touch `HttpClient`. All I/O goes through `ManuscriptApiService`
  (`libs/imp/data-access`), which uses `@cordele/shared/access-http-base` (interceptors inject
  Correlation + `X-Empresa-Id`, normalize errors).
- Facades call the service, map responses into VMs, and publish `signal<T>` read via
  `.asReadonly()`; components bind to signals with `OnPush`.

Draft endpoints (to be firmed in Specs, aligned with `imp-service`):

| Action | Method / path (draft) | Notes |
|---|---|---|
| Create project + upload manuscript | `POST /api/imp/manuscripts` (`multipart/form-data`: `nome`, `file`) | returns `{ projetoId, manuscritoId, parseJobId, status }` |
| Poll parse status | `GET /api/imp/manuscripts/{manuscritoId}` | returns summary when `status='ready'` |
| Ignore a fragment | `POST /api/imp/manuscripts/{manuscritoId}/fragments/{fragmentId}/ignore` | idempotent |
| Confirm structure | `POST /api/imp/manuscripts/{manuscritoId}/confirm` | advances project to `em_composicao` |

## 3. Cache Strategy

Default: **call the API on each navigation** — no client cache of manuscript data. Rationale:
manuscripts are imported once and reviewed once per session; staleness risk outweighs the small
latency win. If a Spec later justifies caching the review summary (e.g. back/forward between T04
and T03 without re-import), it is scoped per `manuscritoId` and invalidated on empresa switch.

## 4. Optimistic Updates

- **`ignoreFragment`** is optimistic: the UI sets `trecho.ignorado = true` immediately, then
  `POST`s. **Rollback:** on non-2xx, revert `ignorado` to `false` and surface a feedback toast
  ("Não foi possível ignorar o trecho — tente novamente"). No other action is optimistic.
- Upload/confirm are **not** optimistic — both wait for the server (data-entry and state-advancing
  operations must be authoritative).

## 5. Error Handling

- BE returns RFC-7807 `ProblemDetail`; the ErrorNormalize interceptor converts it to a normalized
  `AppError` (code, title, detail, correlationId).
- Mapping to UI:
  - `413 / file too large`, `415 / unsupported type` → inline drop-zone error (though client-side
    validation should pre-empt these).
  - `422 / parse failed` → error state on the progress card with "Reimportar" affordance.
  - `409 / already confirmed` → info feedback, navigate forward to COMP.
  - `5xx / network` → generic retry feedback; state returns to a retryable point.
- Correlation id from the interceptor is attached to every error for support/observability.

## 6. Breadcrumbs and Navigation State

- `libs/imp/navigation` feeds `BreadcrumbItem[]` and the 4-step top bar:
  step 1 **Importar** (T03 → T04) is IMP-owned; step 2 **Configurar** is the handoff target (COMP).
- On entering `/upload`, breadcrumb = `Projetos › Novo projeto › Importar`.
- On `/revisao-de-estrutura`, step 1 is marked complete, step 2 selected; breadcrumb =
  `Projetos › {nome} › Estrutura`.
- Navigation values come from `NavigationService` (Access Layer) + IMP's `nav.config`; the shell
  never builds these ad hoc.
