# SPEC-01 — Route Map — PUB (Publicação) — Frontend

> Cordelê · module `pub` · prefix `PUB` · app `cordele-web` · scope `@cordele` · entry `@cordele/pub`
> Prototype-first (D-493): routes bind the promoted prototype screens `exportacao-e-validacao` (T07)
> and `download-e-historico` (T08). Naming follows `standards/module-pattern.md` (`pub.routes.ts`,
> `PUB_ROUTES`, `PUB_MODULE_DESCRIPTOR`) — **not** the generic `@hub/tool` symbols of the template.
> Endpoints referenced here are the **ratified** `pub-service/contracts/api-contract.md` (M2 barrier);
> the doc 05 DRAFT shapes are reconciled in `contracts/backend-api-cross-link.md`.

## 1. Route master table

The Shell lazy-loads `@cordele/pub` at `shell_route = /pub` via `loadChildren`; feature screens are
`loadComponent`. PUB is **not a landing module** — it is entered with a `projetoId` from COMP's T06
"Exportar" (project `em_composicao`) or from PROJ / T08 "Nova exportação". Every publication resource
is a child of a project in the api-contract (`/api/pub/projetos/{projetoId}/...`), so both screens
deep-link under `/projetos/:projetoId/...` (mirrors COMP's deep-link convention).

| Path | Component | Feature Lib | Guards | Title | Breadcrumb |
|---|---|---|---|---|---|
| `/pub` | `PubRootComponent` (redirect → PROJ library; PUB has no standalone landing) | `libs/pub/shell-entry` | `authGuard`, `empresaGuard`, `accessGuard('pub.view')` | "Publicação" | `Projetos › Publicação` |
| `/projetos/:projetoId/exportacao-e-validacao` | `ExportacaoEValidacaoComponent` | `libs/pub/feature-export` | `authGuard`, `empresaGuard`, `accessGuard('pub.export')`, `pubProjetoGuard`, `pubStatusGuard('export')` | "Exportação e validação" | `Projetos › {nomeProjeto} › Exportar` |
| `/projetos/:projetoId/download-e-historico` | `DownloadEHistoricoComponent` | `libs/pub/feature-history` | `authGuard`, `empresaGuard`, `accessGuard('pub.view')`, `pubProjetoGuard`, `pubStatusGuard('history')` | "Download e histórico" | `Projetos › {nomeProjeto} › Publicação` |

Notes:

- **T07** (`/exportacao-e-validacao`) is the export + validation screen: on entry it triggers a build
  (`POST /api/pub/projetos/{projetoId}/publicacoes`, api-contract §4.1) and **polls**
  `GET .../publicacoes/{publicacaoId}/status` (§4.2) until terminal — **no SSE, no long-request** (D-N).
  Step bar: stage 4 (Exportar) active.
- **T08** (`/download-e-historico`) is the history + download screen: it lists
  `GET /api/pub/projetos/{projetoId}/publicacoes` (§4.3, newest-first), reads KPIs from
  `GET .../publicacoes/stats` (§4.5), and mints a signed URL per row via
  `GET .../publicacoes/{publicacaoId}/download` (§4.4) that the browser opens directly.
- **Intra-PUB handoff:** T07 "Baixar ePub" navigates to T08 for the same `projetoId` (§2). The
  "Ajustar layout / metadados" links **leave PUB for COMP** (`/projetos/:projetoId/editor-de-layout-preview`
  / `/projetos/:projetoId/config`); PUB never owns those routes. "Nova exportação" (T08) re-enters T07;
  a re-export of a `publicado`/`com_erros` project is interposed by a PROJ `reopen`
  (`POST /api/proj/projetos/{id}/reopen`) that returns the project to `em_composicao` — reopen is
  **PROJ's**, never a PUB endpoint (D-P).
- **Deep-link / reload:** entering T07 for a project with a build already in flight resumes the
  `gerando` state bound to the in-flight `Publicacao` (resolved via the history list, newest-first)
  rather than a fresh client timer (ADR-PUB-001). Entering T08 for a project never exported resolves to
  the empty state.

## 2. Navigation transitions

```
[COMP T06 "Exportar" | PROJ / T08 "Nova exportação"] --> /projetos/:id/exportacao-e-validacao (T07)
/projetos/:id/exportacao-e-validacao --POST 202 + poll: valido/avisos--> (result: válido, "Baixar ePub")
/projetos/:id/exportacao-e-validacao --"Baixar ePub"----------------> /projetos/:id/download-e-historico (T08)
/projetos/:id/exportacao-e-validacao --poll: erros_criticos--------> (result: erros, download blocked)
/projetos/:id/exportacao-e-validacao --"Ajustar layout"------------> [COMP] /projetos/:id/editor-de-layout-preview
/projetos/:id/download-e-historico   --"Nova exportação"-----------> /projetos/:id/exportacao-e-validacao
/projetos/:id/download-e-historico   --"Ajustar metadados/layout"--> [PROJ reopen] --> [COMP] /projetos/:id/config
/projetos/:id/download-e-historico   --"Voltar à biblioteca"-------> [PROJ] /biblioteca-de-projetos
```

Navigation into T08 from T07 is **imperative** (`Router.navigate`) carrying `projetoId`; every
cross-module handoff carries `projetoId` as a route param.

## 3. Guards

| Guard | Source | Responsibility |
|---|---|---|
| `authGuard` | `@cordele/shared/access-decision` | valid OIDC session; else redirect to login. |
| `empresaGuard` | `@cordele/shared/empresa-context` | an active empresa is selected; else redirect to empresa picker. |
| `accessGuard('pub.export')` / `accessGuard('pub.view')` | `@cordele/shared/access-decision` | the principal holds the permission (via `AccessDecisionService.can`); else redirect to a 403 page. Components never test roles directly. |
| `pubProjetoGuard` | `libs/pub/access` | the `:projetoId` is a well-formed UUID; a hard existence/tenant check is the server's job (`404 projeto-not-found`, api-contract §5). |
| `pubStatusGuard(mode)` | `libs/pub/access` | **export** mode admits T07 only for a project in `em_composicao` (a fresh export is valid only from a composed project); **history** mode admits T08 for a project with ≥1 `Publicacao` (typically `publicado`/`com_erros`). Redirects otherwise (to PROJ / COMP). The api-contract has no `illegal-status` URN — this gate is client-side; the server enforces its own pre-flight (`409 manuscript-missing` / `422 metadata-incomplete`). |

## Criterios de aceite (EARS)

- `IF the visitor has no valid session when a /pub route activates, THEN THE SYSTEM SHALL redirect to the login route and SHALL NOT render any PUB screen [pub-guard-session].`
- `IF no active empresa is selected when a /pub route activates, THEN THE SYSTEM SHALL redirect to the empresa selection route [pub-guard-empresa].`
- `IF the principal lacks the pub.export permission on the export screen, THEN THE SYSTEM SHALL redirect to the forbidden route and SHALL NOT trigger a build [pub-guard-permission].`
- `IF the :projetoId route parameter is not a well-formed UUID, THEN THE SYSTEM SHALL redirect to the project library and SHALL NOT issue any publication request [pub-guard-uuid].`
- `IF a project is not em_composicao when the export screen activates, THEN THE SYSTEM SHALL redirect to the project view rather than triggering an export [pub-guard-status-export].`
- `IF a project has no publication when the history screen activates, THEN THE SYSTEM SHALL render the empty state pointing to a new export rather than a broken list [pub-guard-status-history].`
- `WHEN the editor activates "Baixar ePub" on a valid export result, THE SYSTEM SHALL navigate to the download-and-history screen for the same projetoId [pub-nav-baixar-t08].`
