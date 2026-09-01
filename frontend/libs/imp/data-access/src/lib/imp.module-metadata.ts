/**
 * imp.module-metadata.ts — static module metadata for shell registration.
 * Exported from @cordele/imp/data-access so that cordele-web (type:app)
 * can import these constants WITHOUT statically importing the lazy
 * @cordele/imp/shell-entry chunk.
 *
 * Pattern: mirrors @cordele/comp/data-access (COMP_MENU_METADATA, etc.)
 * Fix: resolves lint boundary violation in apps/cordele-web/src/app/module-descriptors.ts
 * (rule: "Static imports of lazy-loaded libraries are forbidden").
 *
 * FE-IMP-003 / FE-IMP-005 / SPEC-06 §shell
 */

/** Canonical module key for the IMP module. */
export const IMP_MODULE_KEY = 'imp' as const;

/**
 * IMP_MENU_METADATA — describes how the shell positions IMP.
 * hiddenFromNav: false → IMP is visible in the global left-nav.
 * isHome: true → default landing module for authenticated users.
 * order: 1 → first in the pipeline step-bar (IMP=1, COMP=2, PUB=3).
 */
export const IMP_MENU_METADATA = {
  label: 'Importação',
  icon: 'upload',
  order: 1,
  isHome: true,
  hiddenFromNav: false,
  route: '/imp',
} as const;

/**
 * IMP_PERMISSION_MAP_METADATA — maps FE permission keys to BE scopes.
 * Mirrors IMP_PERMISSION_MAP in imp-shell-entry (FE-IMP-002).
 *   imp.import  → imp:write  (upload a new manuscript)
 *   imp.review  → imp:read   (view and curate the parsed structure T04)
 *   imp.confirm → imp:write  (confirm structure → triggers COMP job)
 */
export const IMP_PERMISSION_MAP_METADATA = {
  'imp.import': { beScope: 'imp:write' },
  'imp.review': { beScope: 'imp:read' },
  'imp.confirm': { beScope: 'imp:write' },
} as const;

/**
 * IMP_FEATURE_FLAGS_METADATA — default states for all IMP feature flags.
 * Mirrors IMP_FEATURE_FLAGS in imp-shell-entry (FE-IMP-004).
 *   imp.reimport        → on (re-upload to replace a failed import)
 *   imp.ignoreFragment  → on (reviewers can ignore individual fragments)
 *   imp.existingProject → on (upload can be linked to an existing project)
 */
export const IMP_FEATURE_FLAGS_METADATA = {
  'imp.reimport': { defaultState: 'on' as const },
  'imp.ignoreFragment': { defaultState: 'on' as const },
  'imp.existingProject': { defaultState: 'on' as const },
} as const;
