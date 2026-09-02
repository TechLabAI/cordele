/**
 * pub.descriptor.ts — static descriptor for shell lazy-loading and step-bar registration.
 * FE-PUB-003 / FE-PUB-004 / SPEC-06 §shell
 *
 * Consumed by:
 *   - apps/cordele-web/src/app/module-descriptors.ts (MODULE_DESCRIPTORS registry).
 *   - Shell step-bar (PUB = order:3, visible in global left-nav).
 *
 * PUB is the final step of the publishing pipeline:
 *   order: 3 → third step (IMP=1, COMP=2, PUB=3)
 *   hiddenFromNav: false → visible in global left-nav
 *   isHome: false → default landing module is IMP
 *
 * Track D: FE-PUB-003 / FE-PUB-004 (P1 Foundation).
 */
import {
  ModuleMenuMetadata,
  ModuleFeatureFlags,
  ModulePermissionMap,
  PUB_MENU_METADATA,
  PUB_PERMISSION_MAP,
  PUB_FEATURE_FLAGS,
  MODULE_KEY,
} from './pub.contract';

/** Descriptor shape (mirrors ModuleDescriptor from @cordele/comp/data-access at the app layer). */
export interface PubModuleDescriptor {
  key: string;
  menu: ModuleMenuMetadata;
  permissions: ModulePermissionMap;
  flags: ModuleFeatureFlags;
  loadChildren: () => Promise<unknown>;
}

/**
 * PUB_MODULE_DESCRIPTOR — static descriptor for the PUB module.
 * Registered in MODULE_DESCRIPTORS at position 2 (order:3, after IMP=1 and COMP=2).
 */
export const PUB_MODULE_DESCRIPTOR: PubModuleDescriptor = {
  key: MODULE_KEY,
  menu: PUB_MENU_METADATA,
  permissions: PUB_PERMISSION_MAP,
  flags: PUB_FEATURE_FLAGS,
  loadChildren: () => import('./pub.routes').then(m => m.PUB_ROUTES),
};
