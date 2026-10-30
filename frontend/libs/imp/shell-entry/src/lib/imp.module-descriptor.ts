/**
 * imp.module-descriptor.ts — static descriptor for shell lazy-loading and step-bar registration.
 * FE-IMP-003 / FE-IMP-005 / SPEC-06 §shell
 *
 * Consumed by:
 *   - apps/cordele-web/src/app/module-descriptors.ts (MODULE_DESCRIPTORS registry).
 *   - Shell step-bar (IMP=order:1, visible in global left-nav).
 *
 * IMP is the entry point of the publishing pipeline:
 *   order: 1 → first step (IMP → COMP → PUB)
 *   hiddenFromNav: false → visible in global left-nav
 *   isHome: true → default landing module for authenticated users
 *
 * Track D: FE-IMP-003 (D-494 / shell registration).
 */
import { ModuleMenuMetadata, ModuleFeatureFlags, ModulePermissionMap } from './imp.contract';
import { IMP_PERMISSION_MAP } from './imp.permission-map';
import { IMP_FEATURE_FLAGS } from './imp.feature-flags';

/** Descriptor shape (mirrors ModuleDescriptor from @cordele/comp at the app layer). */
export interface ImpModuleDescriptor {
  key: string;
  menu: ModuleMenuMetadata;
  permissions: ModulePermissionMap;
  flags: ModuleFeatureFlags;
  loadChildren: () => Promise<unknown>;
}

/**
 * IMP_MODULE_DESCRIPTOR — static descriptor for the IMP module.
 * Registered in MODULE_DESCRIPTORS at position 0 (order:1, before COMP and PUB).
 */
export const IMP_MODULE_DESCRIPTOR: ImpModuleDescriptor = {
  key: 'imp',
  menu: {
    label: 'Importação',
    icon: 'upload',
    order: 1,
    isHome: true,
    hiddenFromNav: false,
    route: '/imp',
  },
  permissions: IMP_PERMISSION_MAP,
  flags: IMP_FEATURE_FLAGS,
  loadChildren: () => import('./imp.routes').then(m => m.IMP_ROUTES),
};
