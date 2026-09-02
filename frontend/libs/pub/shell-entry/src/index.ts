/**
 * Public API barrel for @cordele/pub-shell-entry.
 * P1 — Foundation (FE-PUB-001..004).
 *
 * Exports all public artifacts of the PUB shell-entry:
 *   - Routes barrel — consumed by app.routes.ts loadChildren
 *   - Contract constants — MODULE_KEY, PUB_MENU_METADATA, PUB_PERMISSION_MAP, PUB_FEATURE_FLAGS
 *   - Module descriptor — PUB_MODULE_DESCRIPTOR (consumed by module-descriptors.ts)
 *   - Bootstrap lifecycle — initPub / destroyPub
 */

// Routes — consumed by app.routes.ts loadChildren (FE-PUB-002)
export { PUB_ROUTES } from './lib/pub.routes';

// Contract — FE-PUB-001
export { MODULE_KEY, PUB_MENU_METADATA, PUB_PERMISSION_MAP, PUB_FEATURE_FLAGS } from './lib/pub.contract';
export type {
  PubContract,
  ModuleMenuMetadata,
  ModulePermissionEntry,
  ModulePermissionMap,
  ModuleFeatureFlagEntry,
  ModuleFeatureFlags,
} from './lib/pub.contract';

// Module descriptor — FE-PUB-003 / FE-PUB-004
export { PUB_MODULE_DESCRIPTOR } from './lib/pub.descriptor';
export type { PubModuleDescriptor } from './lib/pub.descriptor';

// Bootstrap lifecycle — FE-PUB-004
export { initPub, destroyPub } from './lib/pub.bootstrap';
