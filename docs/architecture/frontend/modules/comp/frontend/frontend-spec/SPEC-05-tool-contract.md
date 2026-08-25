# SPEC-05 — Module Contract — COMP (Composição) — Frontend

> Cordelê uses the **module** convention, not the template's `@hub/tool` symbols. The 1:1 mapping is:
> `TOOL_KEY → MODULE_KEY`, `TOOL_MENU_METADATA → COMP_MENU_METADATA`,
> `TOOL_PERMISSION_MAP → COMP_PERMISSION_MAP`, `TOOL_FEATURE_FLAGS → COMP_FEATURE_FLAGS`,
> tool descriptor → `COMP_MODULE_DESCRIPTOR`. Contract files live in `libs/comp/shell-entry/src/lib/`.
> Permissions reconciled with api-contract §2 scopes (`comp:read`, `comp:write`).

## 1. `comp.contract.ts`

```ts
export const MODULE_KEY = 'comp' as const;

export const COMP_MENU_METADATA: ModuleMenuMetadata = {
  key: MODULE_KEY,
  label: 'Composição',
  icon: 'tune',
  order: 2,                 // after IMP; COMP is a mid-pipeline step, never the home landing
  isHome: false,
  route: '/projetos/:projetoId/config',   // deep-linked with projetoId (never a bare landing)
  hiddenFromNav: true,      // COMP is reached from PROJ/IMP, not from a top-level nav entry (doc 04 §2)
};

export const COMP_PERMISSION_MAP: ModulePermissionMap = {
  'comp.view': { beScope: 'comp:read'  },  // GET metadados/layout/preview-context — every COMP screen
  'comp.edit': { beScope: 'comp:write' },  // PUT metadados/layout, POST/DELETE capa (advance/export/cover/alignment)
};

export const COMP_FEATURE_FLAGS: ModuleFeatureFlags = {
  'comp.coverUpload':    { defaultState: 'on', description: 'Cover drop zone on T05 (POST/DELETE .../capa, D-L)' },
  'comp.imageAlignment': { defaultState: 'on', description: 'Per-image alignment override control on T06 (D-H)' },
};

export const COMP_ROUTES: Route[] = [ /* see SPEC-01 / comp.routes.ts */ ];
```

## 2. Permission rationale

| Permission | Guards which route/action | Why a distinct permission |
|---|---|---|
| `comp.view` | both COMP routes (route guard) + every `GET` (metadata, layout, preview-context) | the baseline read capability; maps to BE `comp:read`; an editor may open composition read-only |
| `comp.edit` | "Ir para preview" (metadata upsert), "Exportar" (layout upsert), cover upload/remove, image-alignment change | the single COMP **write** capability (BE `comp:write`); distinct from read so a viewer cannot mutate the two aggregates |

- Only **two** permissions: COMP's whole write surface is one scope on the wire (`comp:write`), so a finer FE
  split (e.g. a separate `comp.cover`) would not map to distinct BE scopes and is not introduced.
- COMP declares **no** `delete`/lifecycle permission: it never writes `projeto_editorial` or changes status
  (api-contract §0 D-M / §2). LGPD erasure of COMP rows is orchestrated by PROJ via `CompositionErasurePort`
  (api-contract §6.5) — an **in-process** port, not a COMP UI affordance.

## 3. Feature-flag rationale

| Flag | Default | Why a flag |
|---|---|---|
| `comp.coverUpload` | on | kill-switch for the cover drop zone if `FileStoragePort` (ADR-003) is not yet live in an environment; the rest of T05 keeps working (cover is optional, D-L) |
| `comp.imageAlignment` | on | kill-switch for the per-image alignment control if the override write path is not enabled; typography editing on T06 stays available |

## 4. Descriptor & bootstrap

```ts
export const COMP_MODULE_DESCRIPTOR: ModuleDescriptor = {
  key: MODULE_KEY,
  menu: COMP_MENU_METADATA,
  permissions: COMP_PERMISSION_MAP,
  flags: COMP_FEATURE_FLAGS,
  loadChildren: () => import('@cordele/comp').then(m => m.CompModule),
};
```

`comp.bootstrap.ts` `init()` registers navigation config (`COMP_NAV_CONFIG` — the step bar
Importar › Configurar › Edição › Exportar and the breadcrumbs) with `NavigationService`; `destroy()` cancels
any in-flight metadata/layout/preview request. No cross-module state is created or torn down (ADR-COMP-001).

## 5. T06 write surface is alignment-only (api-contract §0 D-H / §7.3)

The prototype T06 ships a **structural toolbar** (Adicionar página, Inserir imagem, Remover página). Under the
reconciled boundary these are **structural edits**, deferred in the POC (FE `structuralEdits=false`):

- **Removed at Promote:** the add-page, insert-image and remove-page toolbar buttons — the SPA never renders
  them. The BE **rejects** a `tipo=em-branco` override with `422 urn:cordele:comp:structural-edit-deferred`,
  so the FE also never constructs such a payload (defensive symmetry, SPEC-07).
- **Kept:** the per-image **alignment** control (`full` | `centralizado` | `junto-esquerda` | `junto-direita`)
  — an alignment is a *parameter the PUB stylesheet honours*, not a content edit.
- **Honoured-parameters invariant:** the T06 style panel exposes **exactly** the parameter set PUB honours
  (api-contract §7.3): `fonteCorpoFamilia`, `fonteCorpoTamanho`, `espacamentoLinha`, `margemLateral`,
  `h1/h2/h3Tamanho`, plus per-image `alinhamento`. No control is offered that PUB would ignore
  (ADR-COMP-001 mitigation).

## Criterios de aceite (EARS)

- `THE SYSTEM SHALL evaluate every COMP permission through AccessDecisionService and SHALL NOT test roles directly in components [comp-perm-accessdecision].`
- `WHILE the principal lacks comp.edit, THE SYSTEM SHALL hide or disable the advance, export, cover and image-alignment affordances [comp-perm-edit].`
- `WHERE the feature flag comp.coverUpload is off, THE SYSTEM SHALL NOT render the cover drop zone on T05 [comp-flag-coverupload].`
- `WHERE the feature flag comp.imageAlignment is off, THE SYSTEM SHALL NOT render the per-image alignment control on T06 [comp-flag-imagealignment].`
- `THE SYSTEM SHALL restrict the T06 toolbar to image alignment and SHALL NOT render add-page, remove-page or insert-image controls [comp-toolbar-alignment-only].`
- `THE SYSTEM SHALL expose in the T06 style panel only the parameters that PUB's stylesheet honours per api-contract section 7 point 3 [comp-honoured-params-only].`
