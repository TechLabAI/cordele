/**
 * imp.feature-flags.ts — feature flags for the IMP module.
 * FE-IMP-004 / SPEC-01 §4 / generator-config.yml §flags
 *
 * All flags default to `on` per SPEC. Runtime overrides are applied by
 * AccessDecisionService.setFlag() from server-side configuration.
 *
 * Consumed by:
 *   - AccessDecisionService.registerFlags() at module bootstrap.
 *   - IMP_MODULE_DESCRIPTOR.flags.
 */
import { ModuleFeatureFlags } from './imp.contract';

/**
 * IMP_FEATURE_FLAGS — default states for all IMP feature flags.
 *
 *   imp.reimport        → users can re-upload to replace a failed import (on by default)
 *   imp.ignoreFragment  → reviewers can ignore individual fragments in T04 (on by default)
 *   imp.existingProject → upload can be linked to an existing project (on by default)
 */
export const IMP_FEATURE_FLAGS: ModuleFeatureFlags = {
  'imp.reimport': { defaultState: 'on' },
  'imp.ignoreFragment': { defaultState: 'on' },
  'imp.existingProject': { defaultState: 'on' },
} as const;
