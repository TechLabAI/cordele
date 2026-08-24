# SPEC-06 — Shell Integration — IMP (Importação) — Frontend

> How `cordele-web` (the Shell) discovers, mounts and unmounts IMP. Aligns with
> `standards/module-pattern.md` and `standards/bootstrap-flow.md`. Prose + one EARS section.

## 1. `module-descriptors.ts` (Shell registry) fallback

The Shell registers modules through `module-descriptors.ts`, which imports each module's descriptor:

```ts
// apps/cordele-web/src/app/shell/module-descriptors.ts
import { IMP_MODULE_DESCRIPTOR } from '@cordele/imp';   // from libs/imp/shell-entry

export const MODULE_DESCRIPTORS: ModuleDescriptor[] = [
  IMP_MODULE_DESCRIPTOR,
  // COMP_MODULE_DESCRIPTOR, PUB_MODULE_DESCRIPTOR, PROJ_MODULE_DESCRIPTOR, ...
];
```

`IMP_MODULE_DESCRIPTOR` (from `imp.descriptor.ts`) carries: `key='imp'`, `IMP_MENU_METADATA`,
`loadChildren: () => import('@cordele/imp').then(m => m.ImpModule)`, `IMP_PERMISSION_MAP`,
`IMP_FEATURE_FLAGS`. If dynamic discovery is unavailable, this static array is the **fallback**
source of truth (the Shell never hard-codes IMP routes inline).

## 2. `ImpShellIntegrationService` (`libs/imp/integration`)

A `type:domain` service that adapts IMP to Shell-provided cross-cutting services without IMP
reaching into the Shell:

- **Registers** IMP's navigation contributions (step-bar entries + breadcrumb roots) with
  `NavigationService` (`@cordele/shared/access-decision`) at `init`.
- **Subscribes** to `EmpresaContext` (active empresa) and exposes an `empresaChanged` signal that
  `ImportFacade` uses to cancel in-flight uploads on tenant switch.
- **Publishes** import lifecycle breadcrumbs to the pipeline event stream (correlation id from the
  shared interceptor) — import started / import succeeded / import failed.
- Holds **no** `HttpClient` and **no** business state; it is pure integration glue.

## 3. `imp.bootstrap.ts`

```ts
export function init(ctx: ModuleBootstrapContext): void {
  ctx.nav.register(IMP_NAV_CONFIG);              // step-bar (step 1 Importar) + breadcrumb roots
  ctx.integration = inject(ImpShellIntegrationService);
  ctx.integration.start();                        // empresa subscription + lifecycle breadcrumbs
}

export function destroy(ctx: ModuleBootstrapContext): void {
  ctx.integration.stop();                         // unsubscribe empresa, flush breadcrumbs
  ctx.nav.unregister(MODULE_KEY);                 // remove step-bar/breadcrumb contributions
  // ImportFacade/ReviewFacade are provided at the lazy route scope → GC'd with the route injector;
  // any in-flight upload subscription is torn down here (empresa-switch / leave-flow safety).
}
```

- `init` runs when the lazy `@cordele/imp` entry is first activated; `destroy` when the Shell unmounts
  the module (e.g. switching to a different top-level area) — it must leave **no** dangling empresa
  subscription and **no** live upload request.
- The 4-step top bar (Importar · Configurar · Visualizar · Exportar) is fed from `IMP_NAV_CONFIG`
  (`libs/imp/navigation`) for step 1; steps 2–4 belong to COMP/PUB and are contributed by those
  modules — IMP never renders them ad hoc.

## Criterios de aceite (EARS)

- `WHEN the Shell builds its module registry, THE SYSTEM SHALL source IMP's route, menu and permissions from IMP_MODULE_DESCRIPTOR and SHALL NOT hard-code IMP routes in the Shell [imp-shell-descriptor].`
- `WHEN the IMP lazy entry is first activated, THE SYSTEM SHALL register IMP's step-bar and breadcrumb contributions through NavigationService [imp-shell-nav-register].`
- `WHEN the Shell unmounts the IMP module, THE SYSTEM SHALL unregister IMP's navigation contributions and cancel any in-flight upload subscription [imp-shell-unmount].`
- `WHEN the active empresa changes, THE SYSTEM SHALL notify ImportFacade so it cancels an in-flight upload scoped to the previous empresa [imp-empresa-cancel].`
- `THE SYSTEM SHALL keep ImpShellIntegrationService free of direct HttpClient usage and business state [imp-shell-nohttp].`
