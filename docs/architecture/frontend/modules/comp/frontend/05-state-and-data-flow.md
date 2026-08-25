# 05 — State and Data Flow — COMP (Composição)

## 1. State Topology

| State | Owner | Kind |
|---|---|---|
| Session, roles | `@cordele/shared/auth-session` | global signal |
| Active empresa | `@cordele/shared/empresa-context` | global signal |
| Metadata form + `status` (`loading→ready→saving→error`) | `MetadataFacade` (`libs/comp/data-access`) | local signal |
| Layout config + `status` | `LayoutFacade` (`libs/comp/data-access`) | local signal |
| Preview model (read manuscript + paginator) | `LayoutFacade` / `ManuscriptReadService` | local signal (read-only source) |
| Step-bar / breadcrumb position | `libs/comp/navigation` | local signal / pure fn |

No cross-module shared state: COMP is entered with a `projetoId` route param, reads/writes its own
aggregates against `comp-service`, and hands off to PUB with `projetoId`. It never holds a writable
copy of `ProjetoEditorial` or `Manuscrito` — status is PROJ's, content is IMP's (immutable).

> Endpoints below are **DRAFT direction** (Vision phase). They are reconciled against
> `comp-service/contracts/api-contract.md` in the Specs phase (M3). Divergences will be recorded
> here as an addendum (mirroring how PROJ's doc 05 was reconciled).

## 2. Data Access Pattern

- Components never touch `HttpClient`. All I/O goes through `MetadadosApiService`, `LayoutApiService`
  and `ManuscriptReadService` (`libs/comp/data-access`), which use
  `@cordele/shared/access-http-base` (interceptors inject Correlation + `X-Empresa-Id`, normalize
  errors; empresa scoping is server-side via the JWT claim).
- Facades call the services, map responses into VMs, and publish `signal<T>` read via `.asReadonly()`;
  components bind with `OnPush`.

Endpoints (firmed in Specs against `comp-service/contracts/api-contract.md`):

| Action | Method / path | Scope | Notes |
|---|---|---|---|
| Read metadata | `GET /api/comp/projetos/{projetoId}/metadados` | `comp:read` | hydrate T05; `404`/empty → new form defaults (`idioma='pt'`) |
| Upsert metadata | `PUT /api/comp/projetos/{projetoId}/metadados` | `comp:write` | idempotent by `projetoId`; `422` on invalid required fields (defensive — client pre-validates) |
| Upload cover | `POST /api/comp/projetos/{projetoId}/metadados/capa` | `comp:write` | multipart; returns `{ capaUrl }`; SPA never re-proxies bytes |
| Read layout | `GET /api/comp/projetos/{projetoId}/layout` | `comp:read` | hydrate T06; `404`/empty → default `ConfiguracaoLayout` (serif/16/1.6/48/28/22/18) |
| Upsert layout | `PUT /api/comp/projetos/{projetoId}/layout` | `comp:write` | idempotent by `projetoId`; ranges validated (size 12–20, spacing 1.2–2.0) |
| Read manuscript structure (preview) | `GET /api/comp/projetos/{projetoId}/manuscrito/estrutura` | `comp:read` | read-only chapters→paragraphs + image count feeding `PreviewVM`; sourced from IMP's `Manuscrito` (backend join / read port) |

**Status transition** (`em_composicao → publicado/com_erros`) is **not** a COMP write: COMP navigates
to PUB, and PUB (via PROJ's `AdvanceProjetoStatusUseCase`, D-C) authors the status change on the
backend. COMP's only writes are its two aggregates. The exact `metadados`/`layout` route shape (flat
vs project-nested) and whether the manuscript-structure read lives on `comp-service` or is fetched
directly from `imp-service` are **Specs decisions**.

## 3. Cache Strategy

Default: **call the API on entry to each screen** — `GET` metadata on `/config` entry, `GET` layout +
manuscript structure on `/editor-de-layout-preview` entry. No client cache across navigations:
composition edits must reflect what the backend actually stored (a reopen from PROJ may have loaded a
previously published project's values), and there is **no broker** to invalidate a cache
(`messaging.enabled=false`). The **live-preview** state, by contrast, is intentionally client-only and
ephemeral until persisted — it is not a cache of server data but the in-flight edit. If a Spec later
justifies keeping the layout in memory across the two screens (to avoid a re-`GET`), it is scoped to
the single `projetoId` composition session and dropped on leaving COMP.

## 4. Writes and Optimistic Updates

**No optimistic updates.** COMP has two write aggregates, both persisted pessimistically:

- **Metadata upsert** (`PUT .../metadados`, `comp:write`) — on `advanceToLayout()`, `MetadataFacade`
  awaits the `200`/`204`, then navigates to T06. On failure the advance is halted, an error is
  surfaced, and the local edits are preserved (nothing to roll back).
- **Layout upsert** (`PUT .../layout`, `comp:write`) — on `export()`, `LayoutFacade` awaits the
  `200`/`204`, then navigates to PUB. The **live preview** updated locally on every slider change,
  but persistence happens once, on export — an unsaved change is visible but not durable, and there
  is no half-written server state to reconcile.
- **Cover upload** (`POST .../capa`) — resolves to a `capaUrl`; the transient object-URL thumbnail is
  swapped for the durable URL on success, or discarded with an inline error on failure.

Idempotency (upsert keyed by `projetoId`) means a retried save is safe and never duplicates an
aggregate. Any future auto-save/debounced-persist behaviour must declare its own conflict/rollback
strategy in a Spec (it is deliberately **out** of the MVP to keep the write model pessimistic).

## 5. Error Handling

- BE returns RFC-7807 `ProblemDetail`; the ErrorNormalize interceptor converts it to a normalized
  `AppError` (code, title, detail, correlationId).
- Mapping to UI (URNs firmed against api-contract §5 in Specs):
  - `GET metadata/layout 5xx / network` → error state on the affected screen with a "Tentar novamente"
    retry; local edits (if any) preserved.
  - `GET manuscrito/estrutura` fails → preview area shows an error/empty placeholder with retry; the
    style panel stays usable against a placeholder page so the editor is not fully blocked.
  - `422 urn:cordele:comp:invalid-metadata` on `PUT metadados` → defensive inline field errors (the
    client pre-validates required fields, so this should be unreachable in normal flow).
  - `409 urn:cordele:comp:illegal-status` (project not `em_composicao` when COMP writes) → redirect to
    PROJ with feedback; should be pre-empted by `compStatusGuard`.
  - `403 urn:cordele:comp:forbidden` (missing `comp:write`) → access-denied feedback (pre-empted by the guard).
  - cover upload `413`/`415` (too large / wrong type) → inline drop-zone error with the accepted
    limits; the rest of the form is unaffected.
- Correlation id (`traceId` mirrors `X-Correlation-Id`) from the interceptor is attached to every
  error for support/observability.

## 6. Breadcrumbs and Navigation State

- `libs/comp/navigation` feeds the **step bar** (Importar › Configurar › Edição › Exportar) and the
  breadcrumb: on `/config` → `Projetos › {nome} › Configurar`; on `/editor-de-layout-preview` →
  `Projetos › {nome} › Edição`. Step positions come from `nav.config`, never built ad hoc in a template.
- **Entry resolution:** COMP is reached with `projetoId` from IMP (post-confirm) or PROJ ("Abrir"
  em_composicao / "Ajustar metadados / layout"). PROJ interposes a `reopen` before routing here for a
  `publicado`/`com_erros` project, so COMP always opens on a project that is already `em_composicao`.
- **Exit:** T06 "Exportar" persists layout then navigates to PUB `/exportacao-e-validacao` carrying
  `projetoId`. "Ir para preview" (T05→T06) persists metadata first. Backward navigation (T06→T05)
  is allowed and re-hydrates metadata.
- Navigation values come from `NavigationService` (Access Layer) + COMP's `nav.config`; cross-module
  handoffs always carry `projetoId` as a route param.
