# 05 — State and Data Flow — PROJ (Projetos)

## 1. State Topology

| State | Owner | Kind |
|---|---|---|
| Session, roles | `@cordele/shared/auth-session` | global signal |
| Active empresa | `@cordele/shared/empresa-context` | global signal |
| Project list + `status` (`loading→ready/empty→error`) | `LibraryFacade` (`libs/proj/data-access`) | local signal |
| Project header + publication history + `status` | `HistoryFacade` (`libs/proj/data-access`) | local signal |
| Breadcrumb position + stage-aware "Abrir" resolution | `libs/proj/navigation` | local signal / pure fn |

No cross-module shared state: PROJ hands off to IMP/COMP/PUB only through route params (`projetoId`)
and receives updated project state by **re-reading** from `proj-service` on (re)entry (ADR-PROJ-001).

> **Reconciled against `proj-service/contracts/api-contract.md` (M3).** The endpoints below were
> DRAFT direction in the Vision phase; they are now aligned with the authoritative contract. Two
> divergences were corrected: (a) the download URL is nested under the project
> (`/projetos/{projetoId}/publicacoes/{publicacaoId}/download`), not a flat `/publicacoes/{id}/download`;
> (b) tenancy is resolved **server-side from the JWT `empresa` claim** (api-contract §2/§3), not from an
> `X-Empresa-Id` header — the shared interceptor may still emit the header for observability, but it is
> **not** the scoping authority. A third correction: PROJ is **not** write-free — the T08
> "Ajustar metadados / Ajustar layout" action performs a `reopen` write (see §4).

## 2. Data Access Pattern

- Components never touch `HttpClient`. All I/O goes through `ProjetoApiService` (`libs/proj/data-access`),
  which uses `@cordele/shared/access-http-base` (interceptors inject Correlation + `X-Empresa-Id`,
  normalize errors).
- Facades call the service, map responses into VMs, and publish `signal<T>` read via `.asReadonly()`;
  components bind to signals with `OnPush`.

Endpoints (firmed in Specs against `proj-service/contracts/api-contract.md`):

| Action | Method / path | Scope | Notes |
|---|---|---|---|
| List projects (empresa-scoped) | `GET /api/proj/projetos` | `proj:read` | returns `ProjetoCard[]` (composed: status, counters, author, `ultimoEpubcheckStatus`); tenant from JWT claim |
| Get project detail | `GET /api/proj/projetos/{projetoId}` | `proj:read` | `ProjetoDetail` — T08 header (name, status, autor, `manuscriptSummary`, `publicationHistory`, `degraded`) |
| List publications of a project | `GET /api/proj/projetos/{projetoId}/publicacoes` | `proj:read` | reverse-chronological `PublicacaoHistoryItem[]` |
| Resolve a download URL | `GET /api/proj/projetos/{projetoId}/publicacoes/{publicacaoId}/download` | `proj:read` | returns `{ arquivoUrl, expiresAt }` short-TTL signed URL; browser downloads directly (no proxy). `409` if `epubcheckStatus ∈ {erros_criticos, pendente}` |
| Reopen for a new revision | `POST /api/proj/projetos/{projetoId}/reopen` | `proj:write` | T08 "Ajustar metadados / Ajustar layout"; flips `publicado\|com_erros → em_composicao`, returns `ProjetoDetail`; `409` from `rascunho` |
| Delete / LGPD erasure | `DELETE /api/proj/projetos/{projetoId}` | `proj:delete` | privileged; `204`; no affordance in the T02/T08 prototype (UI deferred — data-access capability only) |

**Create** ("Novo projeto") is **not** a PROJ write in the MVP: the T02 CTA navigates to IMP `/upload`,
and IMP creates the project in-process via `CreateProjetoEditorialUseCase` (D-C). PROJ's own write is
`reopen` (T08). Forward status transitions (`advanceTo`) are performed by IMP/COMP/PUB on the backend;
PROJ observes them by re-reading (ADR-PROJ-001).

## 3. Cache Strategy

Default: **call the API on each navigation** — no client cache of the project list or history.
Rationale: the library must be truthful the moment the editor returns from IMP/COMP/PUB (where a
status may have advanced or a new `Publicacao` was written), and there is **no broker** to invalidate
a cache (`messaging.enabled=false`). Re-fetching on entry is the simplest correct strategy for POC
volume (≤ ~20 projects). If a Spec later justifies caching (e.g. instant back/forward within PROJ),
it is scoped per empresa and **invalidated on empresa switch and on return from any sibling module**.

## 4. Writes and Optimistic Updates

**No optimistic updates.** PROJ is read-oriented; the two side-effecting actions are handled
pessimistically:

- **Download** (`GET .../download`) is a read that mints a signed URL; the browser then navigates to
  object storage. No local state to update or roll back (§ADR-PROJ-001, D-F).
- **Reopen** (`POST /projetos/{id}/reopen`, `proj:write`) — the T08 "Ajustar metadados / Ajustar
  layout" action. It is **pessimistic**: `HistoryFacade` awaits the `200 ProjetoDetail`, then routes
  to COMP with `projetoId`; on return the library/history re-fetch (ADR-PROJ-001) surface the new
  `em_composicao` status. No optimistic status flip — there is nothing to roll back, and an illegal
  reopen (`409`) must not have already mutated the visible status.

Any future write (rename/archive) must declare its own rollback strategy in a Spec.

## 5. Error Handling

- BE returns RFC-7807 `ProblemDetail`; the ErrorNormalize interceptor converts it to a normalized
  `AppError` (code, title, detail, correlationId).
- Mapping to UI (URNs from api-contract §5):
  - `list / history 5xx / network` → error state replacing the grid / list, with a "Tentar novamente" retry.
  - **Partial degradation** (`degraded:true`, a cross-context read port down) → the library/detail
    still render each project's own identity and status; the degraded fields (counters, author,
    `ultimoEpubcheckStatus`, history) show a subtle "temporariamente indisponível" placeholder — the
    view **never fails** because IMP/COMP/PUB is down (api-contract §4.2/§4.3, SPEC-07).
  - `403 urn:cordele:proj:forbidden` (missing `proj:read`) → access-denied feedback (should be pre-empted by the guard).
  - `404 urn:cordele:proj:not-found` (deep-link to a stale/cross-empresa `projetoId`) → "Projeto não encontrado" with a link back to the library.
  - `409 urn:cordele:proj:artifact-not-available` on a download of a `erros_criticos`/`pendente` publication → the "Baixar" affordance is not rendered (`arquivoUrl=null`), so this is a defensive-only mapping; if hit, inline feedback on the row.
  - `409 urn:cordele:proj:illegal-status-transition` on `reopen` from `rascunho` → defensive toast ("Este projeto ainda não pode ser reaberto"); the CTA is only shown for `publicado`/`com_erros`.
  - download signed-URL `404` / expired URL → inline feedback on the history row ("Não foi possível baixar — tente novamente"); re-request the signed URL (no state change).
- Correlation id (`traceId` mirrors `X-Correlation-Id`) from the interceptor is attached to every error for support/observability.

## 6. Breadcrumbs and Navigation State

- `libs/proj/navigation` feeds `BreadcrumbItem[]` and resolves stage-aware "Abrir":
  - On `/biblioteca-de-projetos`, breadcrumb = `Projetos`.
  - On `/download-e-historico`, breadcrumb = `Projetos › {nome} › Histórico`.
- The **stage-aware resolver** maps `ProjetoEditorial.status` → target route:
  `rascunho → IMP /upload` (or `/revisao-de-estrutura` if a manuscript exists),
  `em_composicao → COMP /config`, `publicado|com_erros → /download-e-historico`.
- **Reopen handoff:** on T08, "Ajustar metadados" / "Ajustar layout" first `POST .../reopen` (only when
  status is `publicado`/`com_erros`; a no-op `200` when already `em_composicao`), then route to COMP
  (`/config` or `/editor-de-layout-preview`) carrying `projetoId`. The prototype links straight to those
  COMP routes; production interposes the reopen call so the project is `em_composicao` before COMP opens.
- Navigation values come from `NavigationService` (Access Layer) + PROJ's `nav.config`; the shell
  never builds these ad hoc. Cross-module handoffs always carry `projetoId` as a route param.
