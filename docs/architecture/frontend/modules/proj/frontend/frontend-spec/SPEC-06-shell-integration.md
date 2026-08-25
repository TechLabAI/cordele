# SPEC-06 — Shell Integration — PROJ (Projetos) — Frontend

> How PROJ plugs into the `cordele-web` shell: the descriptor fallback, the integration service, and the
> bootstrap lifecycle. PROJ is the **home module** (default post-login landing, ADR-006 / doc 04 §2).

## 1. `module-descriptors.ts` (Shell fallback)

The shell reads `PROJ_MODULE_DESCRIPTOR` (SPEC-05 §4) to render the nav entry and lazy-load the module.
If the runtime module registry is unavailable, the shell falls back to the static descriptor:

```ts
// apps/cordele-web/src/app/module-descriptors.ts (fallback registry)
export const MODULE_DESCRIPTORS: ModuleDescriptor[] = [
  PROJ_MODULE_DESCRIPTOR,   // key 'proj', isHome:true, order 0 → app landing
  IMP_MODULE_DESCRIPTOR,
  // COMP, PUB, ...
];
```

- The shell redirects `''` → the `isHome` module's route (`/biblioteca-de-projetos`).
- PROJ's menu label/icon (`Projetos` / `library_books`) come from `PROJ_MENU_METADATA`; the shell never
  hard-codes them.

## 2. `ProjShellIntegrationService` (`libs/proj/integration`)

A `type:domain` service the shell calls to register PROJ's cross-cutting hooks. It owns **no UI state**.

```ts
@Injectable({ providedIn: 'root' })
export class ProjShellIntegrationService {
  private readonly nav = inject(NavigationService);   // @cordele/shared/access-decision
  register(): void {
    this.nav.registerModuleNav(PROJ_NAV_CONFIG);      // breadcrumbs + stage-aware "Abrir" targets
  }
  // emits navigation breadcrumbs (library viewed, project opened, version downloaded) to the
  // pipeline-event stream via the shared observability hook — no messaging bus (doc 02 §5).
}
```

- Responsibilities: register `PROJ_NAV_CONFIG` (breadcrumb templates + the stage-aware resolver from
  `libs/proj/navigation`), and surface PROJ's analytics breadcrumbs. It does **not** hold the project
  list or history (those live in the facades, ADR-PROJ-001).

## 3. `proj.bootstrap.ts`

```ts
export function projInit(): void {
  inject(ProjShellIntegrationService).register();   // nav config + hooks
}
export function projDestroy(): void {
  // cancel any in-flight library/history request; no shared store to tear down
}
```

- `init()` — registers nav config and observability hooks; **no** data prefetch (the library re-fetches
  on entry per ADR-PROJ-001).
- `destroy()` — cancels in-flight requests; leaves no residual cross-module state.

## 4. Nx boundaries

`libs/proj/integration` is `scope:proj type:domain`; it imports `@cordele/shared/access-decision` and
`libs/proj/navigation` only. A module lib imports solely `scope:proj` + `scope:shared`
(`@nx/enforce-module-boundaries`, `nx-boundaries.md`). The shell imports PROJ **only** through
`@cordele/proj` (the shell-entry importPath) and the descriptor — never a feature lib directly.

## Criterios de aceite (EARS)

- `WHEN the shell boots, THE SYSTEM SHALL register PROJ_MODULE_DESCRIPTOR and render the "Projetos" nav entry from PROJ_MENU_METADATA [proj-shell-descriptor].`
- `WHEN no module route is active after sign-in, THE SYSTEM SHALL redirect to /biblioteca-de-projetos as the home module [proj-shell-home-redirect].`
- `WHEN ProjShellIntegrationService.register runs, THE SYSTEM SHALL install PROJ_NAV_CONFIG with the breadcrumb templates and the stage-aware "Abrir" resolver [proj-shell-navconfig].`
- `THE SYSTEM SHALL NOT prefetch the project list during bootstrap; the library SHALL be fetched on route entry [proj-shell-no-prefetch].`
- `WHEN PROJ is destroyed, THE SYSTEM SHALL cancel any in-flight library or history request and leave no cross-module state [proj-shell-destroy].`
