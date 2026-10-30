/**
 * comp.contract.ts — module-level constants for the COMP module.
 * FE-COMP-001: MODULE_KEY, COMP_MENU_METADATA, COMP_PERMISSION_MAP, COMP_FEATURE_FLAGS
 * FE-COMP-003: COMP_MODULE_DESCRIPTOR
 *
 * COMP is a mid-pipeline module (hiddenFromNav: true), accessed via handoff from PROJ/IMP
 * with a projetoId parameter. It is NEVER a landing page.
 *
 * SPEC-05 §1–§4 / api-contract §0 §2
 */

// ── Shared type definitions (local until @cordele/shared defines them) ─────────

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

// ── FE-COMP-003: Module descriptor ────────────────────────────────────────────

/**
 * COMP_MODULE_DESCRIPTOR — static descriptor for shell lazy-loading and step-bar registration.
 * Consumed by module-descriptors.ts (FE-COMP-005) and comp.bootstrap.ts (FE-COMP-003).
 * loadChildren → resolves COMP_ROUTES from @cordele/comp.
 * ADR-COMP-001: no prefetch; each screen loads its own data on route entry.
 */
export const COMP_MODULE_DESCRIPTOR: ModuleDescriptor = {
  key: MODULE_KEY,
  menu: COMP_MENU_METADATA,
  permissions: COMP_PERMISSION_MAP,
  flags: COMP_FEATURE_FLAGS,
  loadChildren: () => import('./comp.routes').then(m => m.COMP_ROUTES),
};
