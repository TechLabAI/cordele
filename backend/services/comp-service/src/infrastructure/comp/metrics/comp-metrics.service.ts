import { Injectable, Logger } from '@nestjs/common';

/**
 * Canonical metric names emitted by the COMP bounded context (COMP-019).
 *
 * Naming convention: `comp_<resource>_<verb>_total` (Prometheus counter style).
 */
export const COMP_METRICS = {
  METADATA_UPSERT_TOTAL: 'comp_metadata_upsert_total',
  COVER_UPLOAD_TOTAL: 'comp_cover_upload_total',
  COVER_REJECTION_TOTAL: 'comp_cover_rejection_total',
  LAYOUT_UPSERT_TOTAL: 'comp_layout_upsert_total',
  LAYOUT_REJECTION_TOTAL: 'comp_layout_rejection_total',
  PREVIEW_CONTEXT_TOTAL: 'comp_preview_context_total',
  PREVIEW_STALE_OVERRIDES_TOTAL: 'comp_preview_stale_overrides_total',
} as const;

export type CompMetricName = (typeof COMP_METRICS)[keyof typeof COMP_METRICS];

/**
 * Serialize a metric name and optional labels into a composite Map key.
 *
 * Format: `metric{key1="val1",key2="val2"}` when labels are present,
 * or just `metric` when no labels.  The key set is sorted so that
 * `{a: '1', b: '2'}` and `{b: '2', a: '1'}` produce the same key.
 *
 * @internal
 */
function makeKey(metric: string, labels?: Record<string, string>): string {
  if (!labels || Object.keys(labels).length === 0) {
    return metric;
  }
  const pairs = Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v}"`)
    .join(',');
  return `${metric}{${pairs}}`;
}

/**
 * In-process operation counter for the COMP bounded context (COMP-019 refactor).
 *
 * Replaces the old `CompMetricsService` (7 plain operation counters, no labels)
 * with a generic `increment(metric, labels?)` API that supports Prometheus-style
 * label dimensions — e.g. `comp_cover_rejection_total{reason="413"}`.
 *
 * Design:
 *   - Backed by a plain `Map<string, number>` (zero external dependencies).
 *   - `increment` is synchronous and lock-free.  Node.js is single-threaded so
 *     no explicit mutex is needed for in-process counters.
 *   - `getSnapshot()` returns a shallow copy (Record) so callers cannot mutate
 *     the live counters.
 *
 * RULE-04/05: lives in infrastructure/comp/metrics/ — no modules/ imports. ✓
 * RULE-08: no console.log — uses Nest Logger for debug traces.
 */
@Injectable()
export class CompMetricsService {
  private readonly logger = new Logger(CompMetricsService.name);
  private readonly counters = new Map<string, number>();

  /**
   * Increment the counter for `metric`.
   *
   * @param metric  Canonical metric name (use `COMP_METRICS.*` constants).
   * @param labels  Optional label set that qualifies this counter dimension,
   *                e.g. `{ reason: '413' }` for `comp_cover_rejection_total`.
   *
   * Thread-safety: no mutex required — Node.js event loop is single-threaded.
   */
  increment(metric: string, labels?: Record<string, string>): void {
    const key = makeKey(metric, labels);
    const current = this.counters.get(key) ?? 0;
    this.counters.set(key, current + 1);
    this.logger.debug(`counter ${key}=${current + 1}`);
  }

  /**
   * Return a snapshot of all current counter values.
   *
   * The returned object is a shallow copy — mutations do not affect live counters.
   * Keys follow the Prometheus-style composite format: `metric` or
   * `metric{label="value"}`.
   */
  getSnapshot(): Record<string, number> {
    return Object.fromEntries(this.counters);
  }

  /**
   * Return the current count for a specific metric + label combination.
   * Useful for assertions in unit tests.
   *
   * @param metric  Metric name.
   * @param labels  Optional labels — must match those passed to `increment`.
   */
  getCount(metric: string, labels?: Record<string, string>): number {
    return this.counters.get(makeKey(metric, labels)) ?? 0;
  }
}
