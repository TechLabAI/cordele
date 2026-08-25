# SPEC-06 — Shell Integration — PUB (Publicação) — Frontend

> How `cordele-web` (the Shell) discovers, mounts and unmounts PUB. Aligns with
> `standards/module-pattern.md` and `standards/bootstrap-flow.md`. Prose + one EARS section.

## 1. `module-descriptors.ts` (Shell registry) fallback

The Shell registers modules through `module-descriptors.ts`, which imports each module's descriptor:

```ts
// apps/cordele-web/src/app/shell/module-descriptors.ts
import { PUB_MODULE_DESCRIPTOR } from '@cordele/pub';   // from libs/pub/shell-entry

export const MODULE_DESCRIPTORS: ModuleDescriptor[] = [
  IMP_MODULE_DESCRIPTOR,
  COMP_MODULE_DESCRIPTOR,
  PROJ_MODULE_DESCRIPTOR,
  PUB_MODULE_DESCRIPTOR,
  // ...
];
```

`PUB_MODULE_DESCRIPTOR` (from `pub.descriptor.ts`) carries: `key='pub'`, `PUB_MENU_METADATA`,
`loadChildren: () => import('@cordele/pub').then(m => m.PubModule)`, `PUB_PERMISSION_MAP`,
`PUB_FEATURE_FLAGS`. If dynamic discovery is unavailable, this static array is the **fallback** source
of truth (the Shell never hard-codes PUB routes inline). PUB is **not** a home module (`isHome:false`)
— it is reached on handoff from COMP/PROJ with a `projetoId`.

## 2. `PubShellIntegrationService` (`libs/pub/integration`)

A `type:domain` service that adapts PUB to Shell-provided cross-cutting services without PUB reaching
into the Shell:

- **Registers** PUB's navigation contributions (the step-bar **stage 4 "Exportar"** entry + breadcrumb
  roots) with `NavigationService` (`@cordele/shared/access-decision`) at `init`.
- **Subscribes** to `EmpresaContext` (active empresa) and exposes an `empresaChanged` signal that
  `ExportFacade` uses to **cancel the in-flight status poll** on tenant switch.
- **Publishes** publication lifecycle breadcrumbs to the pipeline event stream (correlation id from the
  shared interceptor) — export requested / verdict shown / downloaded.
- Holds **no** `HttpClient` and **no** business state; it is pure integration glue.

## 3. `pub.bootstrap.ts`

```ts
export function init(ctx: ModuleBootstrapContext): void {
  ctx.nav.register(PUB_NAV_CONFIG);              // step-bar (stage 4 Exportar) + breadcrumb roots
  ctx.integration = inject(PubShellIntegrationService);
  ctx.integration.start();                        // empresa subscription + lifecycle breadcrumbs
}

export function destroy(ctx: ModuleBootstrapContext): void {
  ctx.integration.stop();                         // unsubscribe empresa, flush breadcrumbs
  ctx.nav.unregister(MODULE_KEY);                 // remove step-bar/breadcrumb contributions
  // ExportFacade/HistoryFacade are provided at the lazy route scope → GC'd with the route injector;
  // any in-flight status-poll subscription is torn down here (empresa-switch / leave-flow safety).
}
```

- `init` runs when the lazy `@cordele/pub` entry is first activated; `destroy` when the Shell unmounts
  the module (e.g. switching to a different top-level area) — it must leave **no** dangling empresa
  subscription and **no** live poll.
- The 4-step top bar (Importar · Configurar · Visualizar · **Exportar**) is fed from `PUB_NAV_CONFIG`
  (`libs/pub/navigation`) for **stage 4**; steps 1–3 belong to IMP/COMP and are contributed by those
  modules — PUB never renders them ad hoc.

## Criterios de aceite (EARS)

- `WHEN the Shell builds its module registry, THE SYSTEM SHALL source PUB's route, menu and permissions from PUB_MODULE_DESCRIPTOR and SHALL NOT hard-code PUB routes in the Shell [pub-shell-descriptor].`
- `WHEN the PUB lazy entry is first activated, THE SYSTEM SHALL register PUB's step-bar (stage 4 Exportar) and breadcrumb contributions through NavigationService [pub-shell-nav-register].`
- `WHEN the Shell unmounts the PUB module, THE SYSTEM SHALL unregister PUB's navigation contributions and cancel any in-flight status poll [pub-shell-unmount].`
- `WHEN the active empresa changes, THE SYSTEM SHALL notify ExportFacade so it cancels an in-flight status poll scoped to the previous empresa [pub-empresa-cancel].`
- `THE SYSTEM SHALL keep PubShellIntegrationService free of direct HttpClient usage and business state [pub-shell-nohttp].`
