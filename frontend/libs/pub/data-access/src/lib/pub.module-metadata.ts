/**
 * pub.module-metadata.ts — static module metadata for shell registration.
 * Exported from @cordele/pub-data-access so that cordele-web (type:app)
 * can import these constants WITHOUT statically importing the lazy
 * @cordele/pub-shell-entry chunk.
 *
 * Pattern: mirrors @cordele/comp/data-access (COMP_MENU_METADATA, etc.)
 * Fix: resolves lint boundary violation in apps/cordele-web/src/app/module-descriptors.ts
 * (rule: "Static imports of lazy-loaded libraries are forbidden").
 *
 * FE-PUB-003 / FE-PUB-004 / SPEC-06 §shell
 */

/** Canonical module key for the PUB module. */
export const PUB_MODULE_KEY = 'pub' as const;

/**
 * PUB_MENU_METADATA_STATIC — describes how the shell positions PUB.
 * hiddenFromNav: false → PUB is visible in the global left-nav.
 * order: 3 → third in the pipeline step-bar (IMP=1, COMP=2, PUB=3).
 */
export const PUB_MENU_METADATA_STATIC = {
  label: 'Publicação',
  icon: 'publish',
  order: 3,
  isHome: false,
  hiddenFromNav: false,
  route: '/pub',
} as const;

/**
 * PUB_PERMISSION_MAP_STATIC — maps FE permission keys to BE scopes.
 * Mirrors PUB_PERMISSION_MAP in pub-shell-entry (FE-PUB-001).
 *   pub.view     → pub:read  (view publications and history)
 *   pub.export   → pub:write (trigger ePub generation)
 *   pub.download → pub:read  (download ePub via signed URL)
 */
export const PUB_PERMISSION_MAP_STATIC = {
  'pub.view': { beScope: 'pub:read' },
  'pub.export': { beScope: 'pub:write' },
  'pub.download': { beScope: 'pub:read' },
} as const;

/**
 * PUB_FEATURE_FLAGS_STATIC — toggleable features in the PUB module.
 *   pub.rexport:   on  → re-export allowed
 *   pub.pdfExport: off → PDF export outside MVP
 */
export const PUB_FEATURE_FLAGS_STATIC = {
  'pub.rexport': { defaultState: 'on' as const },
  'pub.pdfExport': { defaultState: 'off' as const },
} as const;
