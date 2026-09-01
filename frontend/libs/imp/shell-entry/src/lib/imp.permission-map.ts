/**
 * imp.permission-map.ts — FE permission keys for the IMP module.
 * FE-IMP-002 / SPEC-01 §2
 *
 * Keys follow the pattern `<module>.<action>`.
 * BE scopes follow `<module>:<verb>` (api-contract §auth).
 *
 * Consumed by:
 *   - AccessDecisionService.registerPermissions() at module bootstrap.
 *   - accessGuard('<perm>') in imp.routes.ts.
 *   - IMP_MODULE_DESCRIPTOR.permissions.
 */
import { ModulePermissionMap } from './imp.contract';

/**
 * IMP_PERMISSION_MAP — maps IMP FE permission keys to their BE scopes.
 *
 *   imp.import  → imp:write  (upload a new manuscript / start import job)
 *   imp.review  → imp:read   (view and curate the parsed structure T04)
 *   imp.confirm → imp:write  (confirm structure → triggers COMP job)
 */
export const IMP_PERMISSION_MAP: ModulePermissionMap = {
  'imp.import': { beScope: 'imp:write' },
  'imp.review': { beScope: 'imp:read' },
  'imp.confirm': { beScope: 'imp:write' },
} as const;
