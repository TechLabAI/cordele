# SPEC-01 — Route Map — IMP (Importação) — Frontend

> Cordelê · module `imp` · prefix `IMP` · app `cordele-web` · scope `@cordele` · entry `@cordele/imp`
> Prototype-first (D-493): routes bind the promoted prototype screens `upload` (T03) and
> `revisao-de-estrutura` (T04). Naming follows `standards/module-pattern.md` (`imp.routes.ts`,
> `IMP_ROUTES`, `IMP_MODULE_DESCRIPTOR`) — **not** the generic `@hub/tool` symbols of the template.

## 1. Route master table

The Shell lazy-loads `@cordele/imp` at `shell_route = /imp` via `loadChildren`; feature screens are
`loadComponent`. Two project-binding entry shapes are supported (decision D-C, see §3):

| Path | Component | Feature Lib | Guards | Title | Breadcrumb |
|---|---|---|---|---|---|
| `/imp` | `ImpRootComponent` (redirect → `upload`) | `libs/imp/shell-entry` | `authGuard`, `empresaGuard`, `accessGuard('imp.import')` | "Importação" | `Projetos › Importar` |
| `/imp/upload` | `UploadComponent` | `libs/imp/feature-upload` | `authGuard`, `empresaGuard`, `accessGuard('imp.import')` | "Importar manuscrito" | `Projetos › Novo projeto › Importar` |
| `/imp/projetos/:projetoId/importar` | `UploadComponent` | `libs/imp/feature-upload` | `authGuard`, `empresaGuard`, `accessGuard('imp.import')`, `impProjetoGuard` | "Importar manuscrito" | `Projetos › {nomeProjeto} › Importar` |
| `/imp/manuscritos/:manuscritoId/revisao` | `RevisaoDeEstruturaComponent` | `libs/imp/feature-review` | `authGuard`, `empresaGuard`, `accessGuard('imp.review')` | "Revisão de estrutura" | `Projetos › {nomeProjeto} › Estrutura` |

Notes:

- **Flat `/imp/upload`** is the create-and-upload entry from the PROJ library ("Novo projeto"): no
  `projetoId` in the URL; the user types `projetoTitulo` in the form (D-C create path).
- **`/imp/projetos/:projetoId/importar`** is the re-import / attach-to-existing entry: the
  `projetoId` is a route param bound to `projetoId` in the request (D-C existing path). This
  resolves the doc 06 §2 open question (flat vs nested) — **both** exist, one per binding mode.
- **`/imp/manuscritos/:manuscritoId/revisao`** carries the `manuscritoId` (not `projetoId`) because
  T04 reviews a specific manuscript and must be **deep-linkable / reloadable** (ADR-IMP-001 §Decision
  step 4: a fresh load hydrates via a single `GET /api/imp/manuscripts/{manuscritoId}`).
- On confirm, T04 hands off to **COMP** at COMP's own route (`/comp/config` or the COMP-owned entry),
  passing `projetoId`. IMP does not own the COMP route; it only navigates to it.

## 2. Navigation transitions

```
[PROJ biblioteca] --"Novo projeto"------------> /imp/upload            (create-and-upload, projetoTitulo)
[PROJ biblioteca] --"Reimportar"/card--------> /imp/projetos/:id/importar (existing, projetoId)
/imp/upload            --201 Created----------> /imp/manuscritos/:manuscritoId/revisao
/imp/projetos/:id/importar --201 Created-----> /imp/manuscritos/:manuscritoId/revisao
/imp/manuscritos/:mid/revisao --"Reimportar"-> back to the originating upload route
/imp/manuscritos/:mid/revisao --"Confirmar"--> [COMP] /comp/config?projetoId=...
```

Navigation to T04 is **imperative** (`Router.navigate`) after the `POST` resolves, using the
`manuscritoId` returned in the `201` body — never a poll-then-route (ADR-IMP-001).

## 3. Guards

| Guard | Source | Responsibility |
|---|---|---|
| `authGuard` | `@cordele/shared/access-decision` | valid OIDC session; else redirect to login. |
| `empresaGuard` | `@cordele/shared/empresa-context` | an active empresa is selected; else redirect to empresa picker. |
| `accessGuard('imp.import')` / `accessGuard('imp.review')` | `@cordele/shared/access-decision` | the principal holds the permission (via `AccessDecisionService.can`); else redirect to a 403 page. Components never test roles directly. |
| `impProjetoGuard` | `libs/imp/access` | on the nested route, the `:projetoId` is a well-formed UUID and (best-effort) belongs to the active empresa; a hard existence check is the server's job (`422 projeto-not-found`). |

## Criterios de aceite (EARS)

- `IF the visitor has no valid session when a /imp route activates, THEN THE SYSTEM SHALL redirect to the login route and SHALL NOT render any IMP screen [imp-guard-session].`
- `IF no active empresa is selected when a /imp route activates, THEN THE SYSTEM SHALL redirect to the empresa selection route [imp-guard-empresa].`
- `IF the principal lacks the imp.import permission on /imp/upload, THEN THE SYSTEM SHALL redirect to the forbidden route and SHALL NOT issue the upload request [imp-guard-permission].`
- `IF the principal lacks the imp.review permission on /imp/manuscritos/:manuscritoId/revisao, THEN THE SYSTEM SHALL redirect to the forbidden route [imp-guard-permission].`
- `WHEN the upload POST responds 201 with a manuscritoId, THE SYSTEM SHALL navigate to /imp/manuscritos/{manuscritoId}/revisao [imp-sync-post].`
- `IF the :projetoId route parameter is not a well-formed UUID, THEN THE SYSTEM SHALL redirect to the project library and SHALL NOT issue the upload request [imp-guard-uuid].`
- `WHEN the review route is entered by deep-link or reload without in-memory manuscript state, THE SYSTEM SHALL hydrate T04 with a single GET on the manuscritoId and SHALL NOT poll [imp-deeplink-single-get].`
- `WHEN the editor activates "Confirmar" on T04 successfully, THE SYSTEM SHALL navigate to the COMP configuration route passing the projetoId [imp-confirm-pending].`
