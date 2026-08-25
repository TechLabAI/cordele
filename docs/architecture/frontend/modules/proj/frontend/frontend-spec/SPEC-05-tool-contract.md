# SPEC-05 — Module Contract — PROJ (Projetos) — Frontend

> Cordelê uses the **module** convention, not the template's `@hub/tool` symbols. The 1:1 mapping is:
> `TOOL_KEY → MODULE_KEY`, `TOOL_MENU_METADATA → PROJ_MENU_METADATA`,
> `TOOL_PERMISSION_MAP → PROJ_PERMISSION_MAP`, `TOOL_FEATURE_FLAGS → PROJ_FEATURE_FLAGS`,
> tool descriptor → `PROJ_MODULE_DESCRIPTOR`. Contract files live in `libs/proj/shell-entry/src/lib/`.
> Permissions reconciled with api-contract §2 scopes (`proj:read`, `proj:write`, `proj:delete`).

## 1. `proj.contract.ts`

```ts
export const MODULE_KEY = 'proj' as const;

export const PROJ_MENU_METADATA: ModuleMenuMetadata = {
  key: MODULE_KEY,
  label: 'Projetos',
  icon: 'library_books',
  order: 0,                 // PROJ is the home module → first in the nav
  isHome: true,            // default post-login landing (doc 04 §2)
  route: '/biblioteca-de-projetos',
};

export const PROJ_PERMISSION_MAP: ModulePermissionMap = {
  'proj.view':     { beScope: 'proj:read'  },  // list, detail, history, download-url
  'proj.download': { beScope: 'proj:read'  },  // gates the "Baixar" affordance
  'proj.reopen':   { beScope: 'proj:write' },  // gates T08 "Ajustar metadados / layout" (reopen)
  // 'proj.delete' (beScope 'proj:delete') is reserved for the LGPD erasure UI — deferred (no MVP affordance)
};

export const PROJ_FEATURE_FLAGS: ModuleFeatureFlags = {
  'proj.quickDownload': { defaultState: 'on', description: 'Per-card quick download on the library (T02)' },
  'proj.reopen':        { defaultState: 'on', description: 'Reopen-for-revision actions on history (T08)' },
};

export const PROJ_ROUTES: Route[] = [ /* see SPEC-01 / proj.routes.ts */ ];
```

## 2. Permission rationale

| Permission | Guards which route/action | Why a distinct permission |
|---|---|---|
| `proj.view` | `/biblioteca-de-projetos`, `/projetos/:id/historico` (route guard) | the baseline read capability; maps to BE `proj:read`; every PROJ screen requires it |
| `proj.download` | the "Baixar" (T08) and quick-download (T02) affordances + `resolveDownloadUrl` | an editor may browse the library without being entitled to export/download artifacts; keeps download separately grantable (still BE `proj:read`) |
| `proj.reopen` | the T08 "Ajustar metadados / Ajustar layout" actions (→ `POST .../reopen`) | reopen is the one PROJ **write** (BE `proj:write`); distinct from read so viewers cannot mutate lifecycle |

- `proj.open` (proposed in doc 04) is **dropped**: "Abrir" is pure navigation and needs only `proj.view`;
  the write it was conflated with is now the explicit `proj.reopen`.
- `proj.delete` (BE `proj:delete`) is reserved but has **no UI affordance** in the T02/T08 prototype
  (erasure UI deferred — SPEC-04 §1).

## 3. Feature-flag rationale

| Flag | Default | Why a flag |
|---|---|---|
| `proj.quickDownload` | on | lets ops hide the per-card download shortcut without a deploy if signed-URL minting misbehaves; core download on T08 stays available |
| `proj.reopen` | on | kill-switch for the reopen action if `proj-service` reopen (§4.7) is not yet live in an environment; hides both header CTAs cleanly |

## 4. Descriptor & bootstrap

```ts
export const PROJ_MODULE_DESCRIPTOR: ModuleDescriptor = {
  key: MODULE_KEY,
  menu: PROJ_MENU_METADATA,
  permissions: PROJ_PERMISSION_MAP,
  flags: PROJ_FEATURE_FLAGS,
  loadChildren: () => import('@cordele/proj').then(m => m.ProjModule),
};
```

`proj.bootstrap.ts` `init()` registers navigation config (`PROJ_NAV_CONFIG`) with `NavigationService`;
`destroy()` cancels any in-flight library/history request. No cross-module state is created or torn down
(ADR-PROJ-001).

## Criterios de aceite (EARS)

- `THE SYSTEM SHALL evaluate every PROJ permission through AccessDecisionService and SHALL NOT test roles directly in components [proj-perm-accessdecision].`
- `WHILE the principal lacks proj.download, THE SYSTEM SHALL hide the "Baixar" and quick-download affordances [proj-perm-download].`
- `WHILE the principal lacks proj.reopen, THE SYSTEM SHALL hide the "Ajustar metadados" and "Ajustar layout" actions [proj-perm-reopen].`
- `WHERE the feature flag proj.quickDownload is off, THE SYSTEM SHALL NOT render the per-card download shortcut on the library [proj-flag-quickdownload].`
- `WHERE the feature flag proj.reopen is off, THE SYSTEM SHALL NOT render the reopen actions on the history header [proj-flag-reopen].`
- `THE SYSTEM SHALL register PROJ as the home module so sign-in lands on /biblioteca-de-projetos [proj-contract-home].`
