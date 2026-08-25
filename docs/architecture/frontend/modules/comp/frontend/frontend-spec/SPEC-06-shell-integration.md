# SPEC-06 — Shell Integration — COMP (Composição) — Frontend

> How COMP plugs into the `cordele-web` shell: the descriptor fallback, the integration service, and the
> bootstrap lifecycle. COMP is **not** the home module — it is a mid-pipeline step reached with a `projetoId`
> from PROJ ("Abrir" em_composicao / reopen) or IMP (post-confirm); its nav entry is hidden
> (`hiddenFromNav`, SPEC-05 §1).

## 1. `module-descriptors.ts` (Shell fallback)

The shell reads `COMP_MODULE_DESCRIPTOR` (SPEC-05 §4) to lazy-load the module and resolve its step-bar
metadata. If the runtime module registry is unavailable, the shell falls back to the static descriptor:

```ts
// apps/cordele-web/src/app/module-descriptors.ts (fallback registry)
export const MODULE_DESCRIPTORS: ModuleDescriptor[] = [
  PROJ_MODULE_DESCRIPTOR,   // key 'proj', isHome:true, order 0 → app landing
  IMP_MODULE_DESCRIPTOR,    // order 1
  COMP_MODULE_DESCRIPTOR,   // key 'comp', order 2, hiddenFromNav (deep-linked with projetoId)
  // PUB, ...
];
```

- COMP contributes **no** top-level nav entry (it is `hiddenFromNav`); the shell still needs the descriptor to
  lazy-load `@cordele/comp` and to place COMP on the pipeline **step bar** (Importar › Configurar › Edição ›
  Exportar). Its label/icon (`Composição` / `tune`) come from `COMP_MENU_METADATA`; the shell never hard-codes
  them.

## 2. `CompShellIntegrationService` (`libs/comp/integration`)

A `type:domain` service the shell calls to register COMP's cross-cutting hooks. It owns **no UI state**.

```ts
@Injectable({ providedIn: 'root' })
export class CompShellIntegrationService {
  private readonly nav = inject(NavigationService);   // @cordele/shared/access-decision
  register(): void {
    this.nav.registerModuleNav(COMP_NAV_CONFIG);      // step-bar positions + breadcrumb templates
  }
  // emits navigation breadcrumbs (metadata opened, layout opened, exported) to the pipeline-event
  // stream via the shared observability hook — no messaging bus (doc 02 §5).
}
```

- Responsibilities: register `COMP_NAV_CONFIG` (the `em_composicao` step positions from `libs/comp/navigation`
  and the breadcrumb templates `Projetos › {nome} › Configurar|Edição`), and surface COMP's analytics
  breadcrumbs. It does **not** hold the metadata/layout state (those live in the facades, ADR-COMP-001).

## 3. `comp.bootstrap.ts`

```ts
export function compInit(): void {
  inject(CompShellIntegrationService).register();   // nav config + hooks
}
export function compDestroy(): void {
  // cancel any in-flight metadata/layout/preview request; no shared store to tear down
}
```

- `init()` — registers nav config and observability hooks; **no** data prefetch (each screen fetches on entry
  per ADR-COMP-001 / SPEC-04 §1).
- `destroy()` — cancels in-flight requests; leaves no residual cross-module state (the live-preview edit is
  ephemeral and discarded on leave).

## 4. Nx boundaries

`libs/comp/integration` is `scope:comp type:domain`; it imports `@cordele/shared/access-decision` and
`libs/comp/navigation` only. A module lib imports solely `scope:comp` + `scope:shared`
(`@nx/enforce-module-boundaries`, `nx-boundaries.md`). The shell imports COMP **only** through `@cordele/comp`
(the shell-entry importPath) and the descriptor — never a feature lib directly. COMP imports **no** IMP/PROJ/PUB
lib: cross-module data flows through `comp-service` (preview-context) and cross-module control through route
handoffs carrying `projetoId`.

## Criterios de aceite (EARS)

- `WHEN the shell boots, THE SYSTEM SHALL register COMP_MODULE_DESCRIPTOR and lazy-load COMP through @cordele/comp without adding a top-level nav entry [comp-shell-descriptor].`
- `WHEN CompShellIntegrationService.register runs, THE SYSTEM SHALL install COMP_NAV_CONFIG with the em_composicao step-bar positions and the breadcrumb templates [comp-shell-navconfig].`
- `THE SYSTEM SHALL NOT prefetch metadata, layout or preview during bootstrap; each screen SHALL be fetched on route entry [comp-shell-no-prefetch].`
- `WHEN COMP is destroyed, THE SYSTEM SHALL cancel any in-flight metadata, layout or preview request and leave no cross-module state [comp-shell-destroy].`
