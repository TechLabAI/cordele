/**
 * Shared chunking utilities for cross-service batch adapters.
 *
 * CROSS_SERVICE_BATCH_LIMIT is a contractual limit agreed with all three
 * downstream batch endpoints (IMP, COMP, PUB). Requests exceeding this limit
 * receive HTTP 400. The limit is documented in each service's api-contract.md.
 *
 * Keeping the constant here — rather than as a magic literal in each adapter —
 * makes the origin of the value visible and ensures a single point of change
 * if the contract is renegotiated.
 */

/**
 * Maximum number of project IDs per request to IMP, COMP, and PUB batch
 * endpoints. Contractual limit: requests with more IDs return HTTP 400.
 */
export const CROSS_SERVICE_BATCH_LIMIT = 50;

/**
 * Splits `arr` into consecutive sub-arrays each of length at most `size`.
 * The last element may be shorter when `arr.length` is not a multiple of `size`.
 *
 * @example
 *   chunkArray(['a','b','c','d'], 3) → [['a','b','c'], ['d']]
 */
export function chunkArray<T>(arr: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}
