# SPEC-01 — Route Map — PROJ (Projetos) — Frontend

> Cordelê · module `proj` · prefix `PROJ` · app `cordele-web` · scope `@cordele` · entry `@cordele/proj`
> PROJ is the **default landing module** (the library is the app home, ADR-006 + doc 04 §2). Routes are
> reconciled with `proj-service/contracts/api-contract.md` (M3): the T08 history route is parameterized
> by `projetoId` (Specs decision, closes doc 06 gap), and reopen is an editor write (§4.7).

## 1. Route master table

| Path | Component | Feature Lib | Guards | Title | Breadcrumb |
|---|---|---|---|---|---|
| `/biblioteca-de-projetos` | `BibliotecaDeProjetosComponent` | `libs/proj/feature-library` | `authGuard`, `empresaGuard`, `accessGuard('proj.view')` | "Projetos" | [Projetos] |
| `/projetos/:projetoId/historico` | `DownloadEHistoricoComponent` | `libs/proj/feature-history` | `authGuard`, `empresaGuard`, `accessGuard('proj.view')`, `projProjetoGuard` | "{nome} · Histórico" | [Projetos › {nome} › Histórico] |

- **Home:** the shell redirects `''` → `/biblioteca-de-projetos` (PROJ is the post-login landing module,
  `isHome: true`). The prototype flat route `/download-e-historico` is **replaced at Promote** by the
  parameterized `/projetos/:projetoId/historico` so the history screen carries the `projetoId` its API
  calls require (`GET /api/proj/projetos/{projetoId}` and `.../publicacoes`).
- Sub-routes are lazy: the shell loads `@cordele/proj` via `loadChildren`; each screen is a
  `loadComponent` inside `proj.routes.ts`.

## 2. Navigation transitions

Cross-module handoffs always carry `projetoId` as a route param; PROJ holds no shared in-memory store
(ADR-PROJ-001).

```
/biblioteca-de-projetos (T02)
  ├─ "Novo projeto" ─────────────────────────────► IMP /upload           (create is IMP's, D-C)
  ├─ card "Abrir"  ── stage-aware resolver ────────► rascunho     → IMP  /upload | /revisao-de-estrutura
  │                    (libs/proj/navigation)        em_composicao→ COMP /config
  │                                                  publicado|com_erros → /projetos/:id/historico (T08)
  └─ card quick-download ── GET .../download ───────► object storage (signed URL, new tab)

/projetos/:projetoId/historico (T08)
  ├─ "Ajustar metadados" ─ POST .../reopen ─► COMP /config                 (reopen then route)
  ├─ "Ajustar layout"    ─ POST .../reopen ─► COMP /editor-de-layout-preview
  ├─ "Nova exportação" ────────────────────► PUB  /exportacao-e-validacao
  ├─ row "Baixar" ── GET .../{pid}/download ─► object storage (signed URL, new tab)
  └─ "Voltar" ─────────────────────────────► /biblioteca-de-projetos
```

The **stage-aware "Abrir"** resolver lives in `libs/proj/navigation` (not hard-coded in the template):
`rascunho → IMP`, `em_composicao → COMP`, `publicado|com_erros → history`. No status dead-ends (doc 06 R3).

## 3. Guards

| Guard | Source | Responsibility |
|---|---|---|
| `authGuard` | `@cordele/shared/access-decision` | valid session; else redirect to login |
| `empresaGuard` | `@cordele/shared/empresa-context` | an active empresa is selected (POC: Editora Aetós) |
| `accessGuard('proj.view')` | `@cordele/shared/access-decision` | principal holds `proj.view` (BE `proj:read`) |
| `projProjetoGuard` | `libs/proj/access` | `:projetoId` is a well-formed UUID and resolvable in the active empresa; else route to "Projeto não encontrado" (pre-empts a `404`) |

Tenancy note (reconciled): the BE resolves the empresa **from the JWT claim** (api-contract §2), not
from a path/query/body param. `empresaGuard` guarantees an active session-level empresa; PROJ does not
pass empresa on the wire (the shared interceptor may emit `X-Correlation-Id`; `X-Empresa-Id` is
observability-only, never the scoping authority).

## Criterios de aceite (EARS)

- `IF the visitor has no valid session when a PROJ route activates, THEN THE SYSTEM SHALL redirect to the login route and SHALL NOT render any PROJ screen [proj-guard-session].`
- `IF no empresa is active when /biblioteca-de-projetos activates, THEN THE SYSTEM SHALL block the route until an empresa is selected [proj-guard-empresa].`
- `IF the principal lacks proj.view when a PROJ route activates, THEN THE SYSTEM SHALL deny the route and render access-denied feedback [proj-guard-permission].`
- `IF the :projetoId segment of /projetos/:projetoId/historico is malformed or not resolvable in the active empresa, THEN THE SYSTEM SHALL route to a "Projeto não encontrado" state with a link back to the library and SHALL NOT call the detail endpoint [proj-guard-projeto].`
- `WHEN sign-in completes, THE SYSTEM SHALL land the editor on /biblioteca-de-projetos as the home module [proj-home-landing].`
- `WHEN the editor activates a card whose status is publicado or com_erros, THE SYSTEM SHALL navigate to /projetos/{projetoId}/historico [proj-open-published].`
- `WHERE a card status is rascunho or em_composicao, THE SYSTEM SHALL resolve "Abrir" to the IMP or COMP route respectively and never to the history route [proj-open-stage-aware].`
