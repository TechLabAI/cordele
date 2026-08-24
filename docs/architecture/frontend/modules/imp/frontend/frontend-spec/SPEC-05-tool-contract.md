# SPEC-05 — Module Contract — IMP (Importação) — Frontend

> Cordelê uses the **module** contract convention (`standards/module-pattern.md`), not the generic
> `@hub/tool` symbols of the command template. The mapping is 1:1: `TOOL_KEY → MODULE_KEY`,
> `TOOL_MENU_METADATA → ModuleMenuMetadata`, `TOOL_PERMISSION_MAP → ModulePermissionMap`,
> `TOOL_FEATURE_FLAGS → ModuleFeatureFlags`, tool descriptor → `IMP_MODULE_DESCRIPTOR`.
> File: `libs/imp/shell-entry/src/lib/imp.contract.ts` (+ `imp.permission-map.ts`,
> `imp.feature-flags.ts`, `imp.descriptor.ts`).

## 1. `imp.contract.ts`

```ts
export const MODULE_KEY = 'imp' as const;

export const IMP_MENU_METADATA: ModuleMenuMetadata = {
  key: MODULE_KEY,
  label: 'Importação',
  icon: 'upload_file',                 // Material Symbol
  order: 10,                           // first step of the editorial pipeline
  section: 'projeto',
  route: '/imp/upload',                // default landing (create-and-upload)
};

export const IMP_PERMISSION_MAP: ModulePermissionMap = {
  'imp.import':  { description: 'Enviar manuscrito e criar/atualizar a importação' },
  'imp.review':  { description: 'Abrir a revisão de estrutura de um manuscrito' },
  'imp.confirm': { description: 'Confirmar a estrutura detectada e avançar para composição' },
};

export const IMP_FEATURE_FLAGS: ModuleFeatureFlags = {
  'imp.reimport':        { defaultState: 'on',  description: 'Permitir reimportar outro arquivo' },
  'imp.ignoreFragment':  { defaultState: 'on',  description: 'Permitir ignorar trechos não parseados' },
  'imp.existingProject': { defaultState: 'on',  description: 'Permitir anexar manuscrito a projeto existente (rota aninhada)' },
};
```

## 2. Permission rationale

| Permission | Guards which route/action | Why a distinct permission |
|---|---|---|
| `imp.import` | `/imp/upload`, `/imp/projetos/:id/importar`, the `POST` submit | Uploading creates data (and, via `projetoTitulo`, a PROJ project through the in-process port). It is a write; some roles (e.g. reviewers) may read structure without importing. |
| `imp.review` | `/imp/manuscritos/:manuscritoId/revisao`, T04 hydration `GET` | Reading a parse result is a lighter capability than importing; separable for read-only reviewers. |
| `imp.confirm` | the "Confirmar estrutura" action | Confirming advances the project lifecycle (a governance step); an assistant may review but not confirm. Enforced in the UI by hiding/disabling the confirm control. |

Maps to BE scopes: `imp.import` → `imp:write`; `imp.review`/`imp.confirm` → `imp:read`
(`imp.confirm` additionally gates the state-advancing handoff — see the M4 confirm-endpoint gap in
SPEC-04 §5).

## 3. Feature-flag rationale

| Flag | Default | Why a flag |
|---|---|---|
| `imp.reimport` | on | The "Reimportar outro arquivo" affordance can be withdrawn per tenant/plan without a code change. |
| `imp.ignoreFragment` | on | Some editorial policies may forbid ignoring unparsed content (must resolve everything); the flag hides the per-fragment "Ignorar" action when off. |
| `imp.existingProject` | on | Controls whether the nested `/imp/projetos/:id/importar` (attach-to-existing) route and its entry points are exposed; off = create-and-upload only. |

## 4. Descriptor & bootstrap

- `imp.descriptor.ts` exports `IMP_MODULE_DESCRIPTOR` (key, menu metadata, `loadChildren` to
  `@cordele/imp`, permission + flag maps) — consumed by the Shell's `module-descriptors.ts`.
- `imp.bootstrap.ts`: `init()` registers IMP nav (step-bar/breadcrumb) with `NavigationService` and
  primes `EmpresaContext` subscription; `destroy()` tears down the nav registration and cancels any
  in-flight import subscription (empresa-switch safety).

## Criterios de aceite (EARS)

- `WHILE the principal lacks the imp.import permission, THE SYSTEM SHALL hide the "Novo projeto"/import entry points and SHALL disable the import submit control [imp-flag-import].`
- `WHILE the principal lacks the imp.review permission, THE SYSTEM SHALL NOT expose navigation into the structure-review route [imp-flag-review].`
- `WHILE the principal lacks the imp.confirm permission, THE SYSTEM SHALL disable the "Confirmar estrutura" action while still allowing structure review [imp-flag-confirm].`
- `WHERE the imp.ignoreFragment feature flag is off, THE SYSTEM SHALL hide the per-fragment "Ignorar" action [imp-flag-ignore].`
- `WHERE the imp.reimport feature flag is off, THE SYSTEM SHALL hide the "Reimportar outro arquivo" affordance [imp-flag-reimport].`
- `WHERE the imp.existingProject feature flag is off, THE SYSTEM SHALL NOT expose the attach-to-existing-project route or its entry points [imp-flag-existing].`
- `THE SYSTEM SHALL evaluate every permission through AccessDecisionService and SHALL NOT test roles directly in components [imp-flag-accessdecision].`
