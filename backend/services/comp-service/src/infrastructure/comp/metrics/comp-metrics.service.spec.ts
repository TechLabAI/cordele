import { CompMetricsService, COMP_METRICS } from './comp-metrics.service';

describe('CompMetricsService', () => {
  let service: CompMetricsService;

  beforeEach(() => {
    service = new CompMetricsService();
  });

  // -------------------------------------------------------------------------
  // increment — no labels
  // -------------------------------------------------------------------------

  describe('increment() without labels', () => {
    it('starts at 0 and returns 1 after first increment', () => {
      service.increment(COMP_METRICS.METADATA_UPSERT_TOTAL);
      expect(service.getCount(COMP_METRICS.METADATA_UPSERT_TOTAL)).toBe(1);
    });

    it('accumulates across multiple increments', () => {
      service.increment(COMP_METRICS.COVER_UPLOAD_TOTAL);
      service.increment(COMP_METRICS.COVER_UPLOAD_TOTAL);
      service.increment(COMP_METRICS.COVER_UPLOAD_TOTAL);
      expect(service.getCount(COMP_METRICS.COVER_UPLOAD_TOTAL)).toBe(3);
    });

    it('tracks each metric independently', () => {
      service.increment(COMP_METRICS.METADATA_UPSERT_TOTAL);
      service.increment(COMP_METRICS.LAYOUT_UPSERT_TOTAL);
      service.increment(COMP_METRICS.LAYOUT_UPSERT_TOTAL);

      expect(service.getCount(COMP_METRICS.METADATA_UPSERT_TOTAL)).toBe(1);
      expect(service.getCount(COMP_METRICS.LAYOUT_UPSERT_TOTAL)).toBe(2);
      expect(service.getCount(COMP_METRICS.COVER_UPLOAD_TOTAL)).toBe(0);
    });

    it('returns 0 for a metric that has never been incremented', () => {
      expect(service.getCount(COMP_METRICS.PREVIEW_CONTEXT_TOTAL)).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // increment — with labels
  // -------------------------------------------------------------------------

  describe('increment() with labels', () => {
    it('tracks comp_cover_rejection_total separately per reason label', () => {
      service.increment(COMP_METRICS.COVER_REJECTION_TOTAL, { reason: '413' });
      service.increment(COMP_METRICS.COVER_REJECTION_TOTAL, { reason: '413' });
      service.increment(COMP_METRICS.COVER_REJECTION_TOTAL, { reason: '415' });

      expect(service.getCount(COMP_METRICS.COVER_REJECTION_TOTAL, { reason: '413' })).toBe(2);
      expect(service.getCount(COMP_METRICS.COVER_REJECTION_TOTAL, { reason: '415' })).toBe(1);
    });

    it('tracks comp_layout_rejection_total with reason=422', () => {
      service.increment(COMP_METRICS.LAYOUT_REJECTION_TOTAL, { reason: '422' });
      service.increment(COMP_METRICS.LAYOUT_REJECTION_TOTAL, { reason: '422' });

      expect(service.getCount(COMP_METRICS.LAYOUT_REJECTION_TOTAL, { reason: '422' })).toBe(2);
    });

    it('does not conflate labeled and unlabeled counters for the same metric name', () => {
      service.increment(COMP_METRICS.COVER_REJECTION_TOTAL);
      service.increment(COMP_METRICS.COVER_REJECTION_TOTAL, { reason: '413' });

      expect(service.getCount(COMP_METRICS.COVER_REJECTION_TOTAL)).toBe(1);
      expect(service.getCount(COMP_METRICS.COVER_REJECTION_TOTAL, { reason: '413' })).toBe(1);
    });

    it('produces consistent keys regardless of label insertion order', () => {
      service.increment('test_metric', { b: '2', a: '1' });
      service.increment('test_metric', { a: '1', b: '2' });

      // Both calls must map to the same key (labels sorted alphabetically).
      expect(service.getCount('test_metric', { a: '1', b: '2' })).toBe(2);
      expect(service.getCount('test_metric', { b: '2', a: '1' })).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // getSnapshot
  // -------------------------------------------------------------------------

  describe('getSnapshot()', () => {
    it('returns empty record when no increments have occurred', () => {
      expect(service.getSnapshot()).toEqual({});
    });

    it('returns all recorded counters including labeled dimensions', () => {
      service.increment(COMP_METRICS.METADATA_UPSERT_TOTAL);
      service.increment(COMP_METRICS.COVER_REJECTION_TOTAL, { reason: '413' });
      service.increment(COMP_METRICS.COVER_REJECTION_TOTAL, { reason: '415' });
      service.increment(COMP_METRICS.PREVIEW_STALE_OVERRIDES_TOTAL);
      service.increment(COMP_METRICS.PREVIEW_STALE_OVERRIDES_TOTAL);

      const snapshot = service.getSnapshot();

      expect(snapshot[COMP_METRICS.METADATA_UPSERT_TOTAL]).toBe(1);
      expect(snapshot[`${COMP_METRICS.COVER_REJECTION_TOTAL}{reason="413"}`]).toBe(1);
      expect(snapshot[`${COMP_METRICS.COVER_REJECTION_TOTAL}{reason="415"}`]).toBe(1);
      expect(snapshot[COMP_METRICS.PREVIEW_STALE_OVERRIDES_TOTAL]).toBe(2);
    });

    it('snapshot is a copy — mutations do not affect live counters', () => {
      service.increment(COMP_METRICS.LAYOUT_UPSERT_TOTAL);

      const snapshot = service.getSnapshot();
      (snapshot as Record<string, number>)[COMP_METRICS.LAYOUT_UPSERT_TOTAL] = 999;

      // Live counter must remain unchanged.
      expect(service.getCount(COMP_METRICS.LAYOUT_UPSERT_TOTAL)).toBe(1);
    });
  });

  // -------------------------------------------------------------------------
  // label grouping — all 7 canonical metrics
  // -------------------------------------------------------------------------

  describe('canonical metrics — label grouping coverage', () => {
    it('increments all 7 COMP canonical metrics without throwing', () => {
      service.increment(COMP_METRICS.METADATA_UPSERT_TOTAL);
      service.increment(COMP_METRICS.COVER_UPLOAD_TOTAL);
      service.increment(COMP_METRICS.COVER_REJECTION_TOTAL, { reason: '413' });
      service.increment(COMP_METRICS.COVER_REJECTION_TOTAL, { reason: '415' });
      service.increment(COMP_METRICS.LAYOUT_UPSERT_TOTAL);
      service.increment(COMP_METRICS.LAYOUT_REJECTION_TOTAL, { reason: '422' });
      service.increment(COMP_METRICS.PREVIEW_CONTEXT_TOTAL);
      service.increment(COMP_METRICS.PREVIEW_STALE_OVERRIDES_TOTAL);

      const snapshot = service.getSnapshot();

      expect(snapshot[COMP_METRICS.METADATA_UPSERT_TOTAL]).toBe(1);
      expect(snapshot[COMP_METRICS.COVER_UPLOAD_TOTAL]).toBe(1);
      expect(snapshot[`${COMP_METRICS.COVER_REJECTION_TOTAL}{reason="413"}`]).toBe(1);
      expect(snapshot[`${COMP_METRICS.COVER_REJECTION_TOTAL}{reason="415"}`]).toBe(1);
      expect(snapshot[COMP_METRICS.LAYOUT_UPSERT_TOTAL]).toBe(1);
      expect(snapshot[`${COMP_METRICS.LAYOUT_REJECTION_TOTAL}{reason="422"}`]).toBe(1);
      expect(snapshot[COMP_METRICS.PREVIEW_CONTEXT_TOTAL]).toBe(1);
      expect(snapshot[COMP_METRICS.PREVIEW_STALE_OVERRIDES_TOTAL]).toBe(1);
    });
  });
});
