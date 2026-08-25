# SPEC-05 — Module Contract — PUB (Publicação) — Frontend

> Cordelê uses the **module** contract convention (`standards/module-pattern.md`), not the generic
> `@hub/tool` symbols of the command template. The mapping is 1:1: `TOOL_KEY → MODULE_KEY`,
> `TOOL_MENU_METADATA → ModuleMenuMetadata`, `TOOL_PERMISSION_MAP → ModulePermissionMap`,
> `TOOL_FEATURE_FLAGS → ModuleFeatureFlags`, tool descriptor → `PUB_MODULE_DESCRIPTOR`.
> File: `libs/pub/shell-entry/src/lib/pub.contract.ts` (+ `pub.permission-map.ts`,
> `pub.feature-flags.ts`, `pub.descriptor.ts`).

## 1. `pub.contract.ts`

```ts
export const MODULE_KEY = 'pub' as const;

export const PUB_MENU_METADATA: ModuleMenuMetadata = {
  key: MODULE_KEY,
  label: 'Publicação',
  icon: 'publish',                     // Material Symbol (export/publish glyph)
  order: 40,                           // last step of the editorial pipeline (Exportar)
  section: 'projeto',
  route: '/pub',                       // not a landing; entered with projetoId from COMP/PROJ
  isHome: false,
};

export const PUB_PERMISSION_MAP: ModulePermissionMap = {
  'pub.view':     { description: 'Ver o histórico de publicações e o resultado de uma exportação' },
  'pub.export':   { description: 'Disparar a geração/validação de um ePub (nova exportação)' },
  'pub.download': { description: 'Baixar o arquivo .epub de uma publicação válida' },
};

export const PUB_FEATURE_FLAGS: ModuleFeatureFlags = {
  'pub.rexport':   { defaultState: 'on',  description: 'Permitir reexportar um projeto já publicado (nova Publicacao)' },
  'pub.pdfExport': { defaultState: 'off', description: 'Exportação em PDF (fora do escopo do MVP — reservado)' },
};
```

## 2. Permission rationale

| Permission | Guards which route/action | Why a distinct permission | BE scope (api-contract §2) |
|---|---|---|---|
| `pub.view` | `/pub`, T08 `/download-e-historico`, the history/stats/status reads | Reading the publication ledger + verdict is a lighter capability than exporting; separable for read-only reviewers who may see history without generating. | `pub:read` |
| `pub.export` | T07 `/exportacao-e-validacao`, the `POST .../publicacoes` trigger | Triggering a build creates data **and** drives the project to `publicado`/`com_erros` (via PROJ `advanceTo`) — a governance-bearing write; some roles review but do not publish. | `pub:write` |
| `pub.download` | the "Baixar ePub" / row-download action | Downloading the artefact can be withheld from a role that may still see history (e.g. audit-only). Enforced in the UI by disabling the download control; the server also gates §4.4. | `pub:read` |

> The api-contract exposes **only two** BE scopes — `pub:read` and `pub:write`. The three UI
> permissions collapse onto them: `pub.export → pub:write`; `pub.view` / `pub.download → pub:read`.
> The finer FE split exists for menu/affordance RBAC, not for a third server scope.

## 3. Feature-flag rationale

| Flag | Default | Why a flag |
|---|---|---|
| `pub.rexport` | on | The "Nova exportação" affordance on a `publicado`/`com_erros` project can be withdrawn per tenant/plan without a code change (a re-export is a new `Publicacao`, D-P). Off = one export per project. |
| `pub.pdfExport` | **off** | PDF export is explicitly **out of MVP scope** (doc 05). The flag reserves the affordance without shipping it; it stays hidden until a PDF build lands in `pub-service`. |

## 4. Descriptor & bootstrap

- `pub.descriptor.ts` exports `PUB_MODULE_DESCRIPTOR` (key, menu metadata, `loadChildren` to
  `@cordele/pub`, permission + flag maps) — consumed by the Shell's `module-descriptors.ts`.
- `pub.bootstrap.ts`: `init()` registers PUB nav (step-bar stage 4 "Exportar" + breadcrumb roots) with
  `NavigationService` and primes the `EmpresaContext` subscription; `destroy()` tears down the nav
  registration and **cancels any in-flight status poll** (empresa-switch / leave-flow safety).

## Criterios de aceite (EARS)

- `WHILE the principal lacks the pub.export permission, THE SYSTEM SHALL hide the "Exportar"/"Nova exportação" entry points and SHALL disable the export trigger control [pub-perm-export].`
- `WHILE the principal lacks the pub.view permission, THE SYSTEM SHALL NOT expose navigation into the download-and-history screen [pub-perm-view].`
- `WHILE the principal lacks the pub.download permission, THE SYSTEM SHALL disable the "Baixar ePub" control while still allowing history review [pub-perm-download].`
- `WHERE the pub.rexport feature flag is off, THE SYSTEM SHALL hide the "Nova exportação" affordance on a published project [pub-flag-rexport].`
- `WHERE the pub.pdfExport feature flag is off, THE SYSTEM SHALL NOT expose any PDF export affordance [pub-flag-pdf].`
- `THE SYSTEM SHALL evaluate every permission through AccessDecisionService and SHALL NOT test roles directly in components [pub-perm-accessdecision].`
