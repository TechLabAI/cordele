# SPEC-01 — Route Map — COMP (Composição) — Frontend

> Cordelê · module `comp` · prefix `COMP` · app `cordele-web` · scope `@cordele` · entry `@cordele/comp`
> COMP is **not** a landing module: it is entered with a `projetoId` from PROJ ("Abrir" for an
> `em_composicao` project / "Ajustar metadados·layout" after a reopen) or from IMP (post-confirm). Routes
> are reconciled with `comp-service/contracts/api-contract.md` (M3): every COMP REST resource is a
> **singleton child of a project** addressed only by `projetoId` (api-contract §0 D-J), so the FE routes
> are **parameterized by `:projetoId`** — mirroring how PROJ replaced its flat prototype route with
> `/projetos/:projetoId/historico` at Promote.

## 1. Route master table

| Path | Component | Feature Lib | Guards | Title | Breadcrumb |
|---|---|---|---|---|---|
| `/projetos/:projetoId/config` | `ConfiguracoesComponent` | `libs/comp/feature-metadata` | `authGuard`, `empresaGuard`, `accessGuard('comp.view')`, `compProjetoGuard`, `compStatusGuard` | "{nome} · Configurar" | [Projetos › {nome} › Configurar] |
| `/projetos/:projetoId/editor-de-layout-preview` | `EditorDeLayoutPreviewComponent` | `libs/comp/feature-layout` | `authGuard`, `empresaGuard`, `accessGuard('comp.view')`, `compProjetoGuard`, `compStatusGuard` | "{nome} · Edição" | [Projetos › {nome} › Edição] |

- The prototype flat routes `/config` and `/editor-de-layout-preview` are **replaced at Promote** by the
  `:projetoId`-parameterized routes above, so each screen carries the `projetoId` its API calls require
  (`GET/PUT /api/comp/projetos/{projetoId}/{metadados|layout|capa|preview-context}`, api-contract §4). This
  closes the Vision-phase gap (doc 05 left the "flat vs project-nested" route shape as a Specs decision).
- Sub-routes are lazy: the shell loads `@cordele/comp` via `loadChildren`; each screen is a `loadComponent`
  inside `comp.routes.ts`. Cross-module handoffs (PROJ↔COMP↔PUB) always carry `projetoId` as a route param.

## 2. Navigation transitions

COMP holds no shared in-memory store (ADR-COMP-001 / doc 05 §1): it reads/writes its own two aggregates
against `comp-service`, keyed by the route `projetoId`.

```
[PROJ "Abrir" em_composicao | PROJ "Ajustar metadados" (após reopen) | IMP confirm]
      │
      ▼
/projetos/:projetoId/config (T05 — Metadados)
  ├─ "Ir para preview" ── PUT .../metadados (pessimista) ──► /projetos/:projetoId/editor-de-layout-preview
  │                        (só quando titulo·autor·idioma válidos)
  └─ upload/remover capa ── POST/DELETE .../capa ───────────► permanece em T05

[PROJ "Ajustar layout" (após reopen)] ──────────────────────► /projetos/:projetoId/editor-de-layout-preview

/projetos/:projetoId/editor-de-layout-preview (T06 — Layout + Preview)
  ├─ "Exportar" ── PUT .../layout (pessimista) ─────────────► PUB /exportacao-e-validacao?projetoId=…
  │                (navegação — NÃO muda status; autoridade é do PROJ/PUB)
  └─ "Voltar" ─────────────────────────────────────────────► /projetos/:projetoId/config (re-hidrata metadados)
```

- **"Exportar" is navigation, not a status write** (M1.5/M2 handoff, api-contract §0 D-M / §4.6): COMP never
  calls `advanceTo` and never writes `projeto_editorial`. The status change (`em_composicao → publicado`)
  is authored downstream by PUB via PROJ's `AdvanceProjetoStatusUseCase`.
- The T06 structural toolbar present in the prototype (add / insert-image / remove page) is **not wired**
  (SPEC-05 §5, api-contract §0 D-H): the only page-level control is image **alignment**.

## 3. Guards

| Guard | Source | Responsibility |
|---|---|---|
| `authGuard` | `@cordele/shared/access-decision` | valid session; else redirect to login |
| `empresaGuard` | `@cordele/shared/empresa-context` | an active empresa is selected (POC: Editora Aetós) |
| `accessGuard('comp.view')` | `@cordele/shared/access-decision` | principal holds `comp.view` (BE `comp:read`) |
| `compProjetoGuard` | `libs/comp/access` | `:projetoId` is a well-formed UUID and resolvable in the active empresa; else route to "Projeto não encontrado" (pre-empts the api-contract §5 `404 urn:cordele:comp:projeto-not-found`) |
| `compStatusGuard` | `libs/comp/access` | the project is `em_composicao`; a deep-link into COMP for a `rascunho`/`publicado`/`com_erros` project redirects back to PROJ so no half-state opens. **FE-only UX guard** — the BE api-contract §5 defines no COMP illegal-status error (COMP writes are status-agnostic on the wire; the guard is a navigation affordance, not a security boundary) |

Tenancy note (reconciled): the BE resolves the empresa **from the JWT claim** (api-contract §2), never from
a path/query/body param. `empresaGuard` guarantees an active session-level empresa; COMP sends **no** empresa
on the wire (the shared interceptor may emit `X-Correlation-Id`; `X-Empresa-Id` is observability-only, never
the scoping authority). Components never test project status directly — `compStatusGuard` resolves it.

## Criterios de aceite (EARS)

- `IF the visitor has no valid session when a COMP route activates, THEN THE SYSTEM SHALL redirect to the login route and SHALL NOT render any COMP screen [comp-guard-session].`
- `IF no empresa is active when a COMP route activates, THEN THE SYSTEM SHALL block the route until an empresa is selected [comp-guard-empresa].`
- `IF the principal lacks comp.view when a COMP route activates, THEN THE SYSTEM SHALL deny the route and render access-denied feedback [comp-guard-permission].`
- `IF the :projetoId segment is malformed or not resolvable in the active empresa, THEN THE SYSTEM SHALL route to a "Projeto não encontrado" state with a link back to the library and SHALL NOT call any comp-service endpoint [comp-guard-projeto].`
- `IF the referenced project is not em_composicao, THEN THE SYSTEM SHALL redirect back to PROJ and SHALL NOT open a COMP screen [comp-guard-status].`
- `WHEN the editor activates "Exportar" on T06, THE SYSTEM SHALL navigate to PUB /exportacao-e-validacao carrying projetoId and SHALL NOT change the project status [comp-nav-export].`
