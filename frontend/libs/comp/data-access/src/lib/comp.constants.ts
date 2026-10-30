/**
 * comp.constants.ts — module-level constants for the COMP module (non-lazy entry point).
 * Extracted from comp.contract.ts to allow static import from apps/cordele-web
 * without triggering @nx/enforce-module-boundaries "lazy-loaded" violation.
 *
 * FE-COMP-001: MODULE_KEY, COMP_MENU_METADATA, COMP_PERMISSION_MAP, COMP_FEATURE_FLAGS
 * INT-FE-COMP-006 (P6): extracted so module-descriptors.ts can statically import these
 * constants from @cordele/comp/data-access (non-lazy) and then assemble the descriptor
 * inline using a dynamic loadChildren: () => import('@cordele/comp') (allowed in type:app).
 *
 * Note: COMP_MODULE_DESCRIPTOR itself is NOT exported here because its loadChildren
 * function needs to dynamically import @cordele/comp (type:feature), and type:data-access
 * cannot depend on type:feature per @nx/enforce-module-boundaries.
 * module-descriptors.ts (type:app) assembles the full descriptor inline.
 *
 * Track D: created by fe-architect-promote COMP @ cordele (D-494).
 * Created in @cordele/comp/data-access (P6 boundary fix — INT-FE-COMP-006).
 */

// ── Shared type definitions ────────────────────────────────────────────────────

export interface ModuleMenuMetadata {
  label: string;
  icon: string;
  order: number;
  isHome: boolean;
  hiddenFromNav: boolean;
  route: string;
}

export interface ModulePermissionEntry {
  beScope: string;
}

export type ModulePermissionMap = Record<string, ModulePermissionEntry>;

export interface ModuleFeatureFlagEntry {
  defaultState: 'on' | 'off';
}

export type ModuleFeatureFlags = Record<string, ModuleFeatureFlagEntry>;

/** ModuleDescriptor shape — used by module-descriptors.ts to type the registry array. */
export interface ModuleDescriptor {
  key: string;
  menu: ModuleMenuMetadata;
  permissions: ModulePermissionMap;
  flags: ModuleFeatureFlags;
  loadChildren: () => Promise<unknown>;
}

// ── FE-COMP-001: Module constants ─────────────────────────────────────────────

/** Canonical key for the COMP module (matches BE module prefix). */
export const MODULE_KEY = 'comp';

/**
 * COMP_MENU_METADATA — describes how the shell positions COMP.
 * hiddenFromNav: true → COMP does NOT appear in the global left-nav.
 * order: 2 → second in the pipeline step-bar (IMP=1, COMP=2, PUB=3).
 */
export const COMP_MENU_METADATA: ModuleMenuMetadata = {
  label: 'Composição',
  icon: 'tune',
  order: 2,
  isHome: false,
  hiddenFromNav: true,
  route: '/projetos/:projetoId/config',
};

/**
 * COMP_PERMISSION_MAP — maps FE permission keys to BE scopes.
 * comp.view  → comp:read  (required to access T05/T06)
 * comp.edit  → comp:write (required to save metadados/layout)
 */
export const COMP_PERMISSION_MAP: ModulePermissionMap = {
  'comp.view': { beScope: 'comp:read' },
  'comp.edit': { beScope: 'comp:write' },
};

/**
 * COMP_FEATURE_FLAGS — feature flags for COMP.
 * comp.coverUpload     → capa upload enabled by default (T05, SPEC-04 §4)
 * comp.imageAlignment  → image alignment badge enabled by default (T06, SPEC-02 §5)
 */
export const COMP_FEATURE_FLAGS: ModuleFeatureFlags = {
  'comp.coverUpload': { defaultState: 'on' },
  'comp.imageAlignment': { defaultState: 'on' },
};
