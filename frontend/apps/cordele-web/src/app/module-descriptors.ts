/**
 * module-descriptors.ts — static registry of all module descriptors.
 * FE-COMP-005 / FE-IMP-005 / SPEC-06 §1
 *
 * The shell uses MODULE_DESCRIPTORS to:
 * - Lazy-load module chunks on demand.
 * - Build the step-bar (Importar › Configurar › Edição › Exportar).
 * - Apply nav config (breadcrumbs, hiddenFromNav).
 *
 * Order: IMP(1) → COMP(2) → PUB(3). PROJ is not in the step-bar.
 *
 * IMP is registered at order:1 (FE-IMP-005, P3).
 * COMP is registered at order:2 (after IMP=1, before PUB=3).
 * hiddenFromNav: true → COMP never appears in the global left-nav;
 * it is accessed only via handoff from PROJ or IMP with projetoId.
 *
 * INT-FE-COMP-006 (P6): COMP descriptor is assembled inline using constants from
 * @cordele/comp/data-access (non-lazy) to avoid static import of lazy @cordele/comp.
 * loadChildren uses a dynamic import (allowed — type:app can depend on type:feature).
 *
 * IMP descriptor assembled inline using constants from @cordele/imp/data-access (non-lazy).
 * Avoids static import of lazy @cordele/imp/shell-entry (lint: enforce-module-boundaries).
 *
 * PUB descriptor assembled inline using constants from @cordele/pub-data-access (non-lazy).
 * Avoids static import of lazy @cordele/pub-shell-entry (lint: enforce-module-boundaries).
 *
 * To add a module: import its descriptor constants from its data-access lib and push
 * an inline descriptor into the array in the correct order position.
 */
import type { ModuleDescriptor } from '@cordele/comp/data-access';
import {
  COMP_MENU_METADATA,
  COMP_PERMISSION_MAP,
  COMP_FEATURE_FLAGS,
  MODULE_KEY,
} from '@cordele/comp/data-access';

// IMP metadata from non-lazy @cordele/imp/data-access (fixes boundary lint error 3)
import {
  IMP_MODULE_KEY,
  IMP_MENU_METADATA,
  IMP_PERMISSION_MAP_METADATA,
  IMP_FEATURE_FLAGS_METADATA,
} from '@cordele/imp/data-access';

// PUB metadata from non-lazy @cordele/pub-data-access (fixes boundary lint error 4)
import {
  PUB_MODULE_KEY,
  PUB_MENU_METADATA_STATIC,
  PUB_PERMISSION_MAP_STATIC,
  PUB_FEATURE_FLAGS_STATIC,
} from '@cordele/pub-data-access';

/**
 * MODULE_DESCRIPTORS — ordered list of all module descriptors.
 * Order matches the pipeline step-bar: IMP(1) → COMP(2) → PUB(3).
 * PROJ does not appear in the step-bar (it is the orchestrator module).
 */
export const MODULE_DESCRIPTORS: ModuleDescriptor[] = [
  // IMP (order:1) — entry point of the pipeline; visible in global left-nav (FE-IMP-005, P3)
  // Assembled inline (non-lazy constants from @cordele/imp/data-access) to avoid
  // static import of lazy @cordele/imp/shell-entry (INT-FE-COMP-006 pattern).
  {
    key: IMP_MODULE_KEY,
    menu: IMP_MENU_METADATA,
    permissions: IMP_PERMISSION_MAP_METADATA,
    flags: IMP_FEATURE_FLAGS_METADATA,
    loadChildren: () =>
      import('@cordele/imp/shell-entry').then(m => m.IMP_ROUTES),
  } as ModuleDescriptor,
  // COMP (order:2) — mid-pipeline; hiddenFromNav=true; accessed via projetoId handoff
  // Assembled inline to avoid static import of lazy @cordele/comp (INT-FE-COMP-006 P6).
  // loadChildren uses a dynamic import — evaluated at navigation time, not at bundle load.
  {
    key: MODULE_KEY,
    menu: COMP_MENU_METADATA,
    permissions: COMP_PERMISSION_MAP,
    flags: COMP_FEATURE_FLAGS,
    loadChildren: () => import('@cordele/comp').then(r => r.COMP_ROUTES),
  },
  // PUB (order:3) — final pipeline step; visible in left-nav; accessed via projetoId from COMP/PROJ
  // Assembled inline (non-lazy constants from @cordele/pub-data-access) to avoid
  // static import of lazy @cordele/pub-shell-entry (same pattern as IMP/COMP).
  {
    key: PUB_MODULE_KEY,
    menu: PUB_MENU_METADATA_STATIC,
    permissions: PUB_PERMISSION_MAP_STATIC,
    flags: PUB_FEATURE_FLAGS_STATIC,
    loadChildren: () =>
      import('@cordele/pub-shell-entry').then(r => r.PUB_ROUTES),
  } as ModuleDescriptor,
];
