/**
 * metadados.port.ts — re-export shim.
 * The actual implementation lives in @cordele/comp/data-access (P6 boundary fix).
 * This file is retained so internal imports within @cordele/comp (facades)
 * continue to resolve without path changes.
 * Track D: INT-FE-COMP-006 (P6).
 */
export { METADADOS_PORT } from '@cordele/comp/data-access';
export type { MetadadosPort } from '@cordele/comp/data-access';
