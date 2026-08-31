/**
 * comp.providers.ts — re-export shim.
 * The actual DI factory lives in @cordele/comp/data-access (P6 boundary fix).
 * Retained for backwards compatibility within @cordele/comp internal usage.
 * Track D: INT-FE-COMP-006 (P6).
 */
export { provideComp } from '@cordele/comp/data-access';
export type { CompFeatureConfig } from '@cordele/comp/data-access';
