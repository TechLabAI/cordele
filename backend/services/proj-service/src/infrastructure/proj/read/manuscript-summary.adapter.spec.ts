/**
 * Unit tests for ImpManuscriptSummaryAdapter (PROJ-INT-001).
 *
 * Uses jest-fetch-mock pattern: replaces globalThis.fetch with a jest mock
 * to avoid real HTTP calls while keeping the adapter logic testable.
 *
 * Contract (post-chunking update):
 *   - Empty projetoIds → empty Map (no HTTP call, not a degradation).
 *   - ≤50 IDs → exactly 1 HTTP call (single chunk, unchanged behaviour).
 *   - 152 IDs → 4 HTTP calls (chunks 50+50+50+2).
 *   - All chunks succeed → merged Map, no exception.
 *   - Some chunks fail → throws PartialResultError with partial data.
 *   - All chunks fail → throws Error (not PartialResultError).
 *   - Missing IMP_SERVICE_URL → throws before any fetch.
 *   - Authorization header mounted when bearerToken provided.
 */

import { ConfigService } from '@nestjs/config';
import { ImpManuscriptSummaryAdapter } from './manuscript-summary.adapter';
import { PartialResultError } from '../../../domain/shared/partial-result.error';

// ---------------------------------------------------------------------------
// Setup: mock ConfigService + global fetch
// ---------------------------------------------------------------------------

const mockConfig = {
  get: jest.fn(),
} as unknown as jest.Mocked<ConfigService>;

const mockFetch = jest.fn();
const originalFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = mockFetch;
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

afterEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `id-${i + 1}`);
}

function okResponse(items: { projetoId: string; totalCapitulos: number; totalImagens: number }[]) {
  return { ok: true, json: async () => items };
}

describe('ImpManuscriptSummaryAdapter', () => {
  let adapter: ImpManuscriptSummaryAdapter;

  beforeEach(() => {
    mockConfig.get = jest.fn().mockReturnValue('http://imp-service:3001');
    adapter = new ImpManuscriptSummaryAdapter(mockConfig);
  });

  // ---------------------------------------------------------------------------
  // Legitimate empty input
  // ---------------------------------------------------------------------------

  it('returns empty Map for empty projetoIds (no HTTP call)', async () => {
    const result = await adapter.summaries([], 'emp-aetos');

    expect(result.size).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Happy path — small input (≤ 50 IDs → 1 chunk)
  // ---------------------------------------------------------------------------

  it('makes exactly 1 call to IMP for up to 50 project IDs', async () => {
    const ids = ['id-1', 'id-2', 'id-3'];
    mockFetch.mockResolvedValue(okResponse([
      { projetoId: 'id-1', totalCapitulos: 5, totalImagens: 2 },
      { projetoId: 'id-2', totalCapitulos: 10, totalImagens: 0 },
      { projetoId: 'id-3', totalCapitulos: 3, totalImagens: 1 },
    ]));

    const result = await adapter.summaries(ids, 'emp-aetos');

    // ≤50 IDs → exactly 1 HTTP call
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.size).toBe(3);
    expect(result.get('id-1')).toEqual({ totalCapitulos: 5, totalImagens: 2 });
  });

  it('maps IMP response to ManuscriptSummary shape correctly', async () => {
    mockFetch.mockResolvedValue(okResponse([
      { projetoId: 'id-1', totalCapitulos: 18, totalImagens: 3 },
    ]));

    const result = await adapter.summaries(['id-1'], 'emp-aetos');

    const summary = result.get('id-1');
    expect(summary).toBeDefined();
    expect(summary!.totalCapitulos).toBe(18);
    expect(summary!.totalImagens).toBe(3);
  });

  // ---------------------------------------------------------------------------
  // Chunking: 152 IDs → 4 blocks (50+50+50+2)
  // ---------------------------------------------------------------------------

  describe('chunking (152 IDs → 4 blocks)', () => {
    it('makes 4 HTTP calls for 152 project IDs', async () => {
      const ids = makeIds(152);
      mockFetch.mockResolvedValue(okResponse([]));

      await adapter.summaries(ids, 'emp-aetos');

      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('sends correct chunk sizes: 50+50+50+2 for 152 IDs', async () => {
      const ids = makeIds(152);
      mockFetch.mockResolvedValue(okResponse([]));

      await adapter.summaries(ids, 'emp-aetos');

      const chunkSizes = (mockFetch.mock.calls as [string, RequestInit][]).map((call) => {
        const body = JSON.parse(call[1].body as string) as { projetoIds: string[] };
        return body.projetoIds.length;
      });
      expect(chunkSizes).toEqual([50, 50, 50, 2]);
    });

    it('merges results from all chunks into one Map', async () => {
      const ids = makeIds(152);
      // Each chunk returns data for its first id only
      mockFetch
        .mockResolvedValueOnce(okResponse([{ projetoId: 'id-1', totalCapitulos: 10, totalImagens: 1 }]))
        .mockResolvedValueOnce(okResponse([{ projetoId: 'id-51', totalCapitulos: 20, totalImagens: 2 }]))
        .mockResolvedValueOnce(okResponse([{ projetoId: 'id-101', totalCapitulos: 30, totalImagens: 3 }]))
        .mockResolvedValueOnce(okResponse([{ projetoId: 'id-151', totalCapitulos: 40, totalImagens: 4 }]));

      const result = await adapter.summaries(ids, 'emp-aetos');

      expect(result.get('id-1')).toEqual({ totalCapitulos: 10, totalImagens: 1 });
      expect(result.get('id-51')).toEqual({ totalCapitulos: 20, totalImagens: 2 });
      expect(result.get('id-101')).toEqual({ totalCapitulos: 30, totalImagens: 3 });
      expect(result.get('id-151')).toEqual({ totalCapitulos: 40, totalImagens: 4 });
    });

    it('all chunks succeed → returns complete Map, no exception', async () => {
      const ids = makeIds(152);
      mockFetch.mockResolvedValue(okResponse([]));

      await expect(adapter.summaries(ids, 'emp-aetos')).resolves.toBeInstanceOf(Map);
    });
  });

  // ---------------------------------------------------------------------------
  // Partial degradation: middle chunk fails
  // ---------------------------------------------------------------------------

  describe('partial degradation', () => {
    it('throws PartialResultError with partial data when middle chunk fails', async () => {
      const ids = makeIds(152);
      mockFetch
        .mockResolvedValueOnce(okResponse([{ projetoId: 'id-1', totalCapitulos: 5, totalImagens: 1 }]))
        .mockResolvedValueOnce({ ok: false, status: 400 })  // chunk 1 fails
        .mockResolvedValueOnce(okResponse([{ projetoId: 'id-101', totalCapitulos: 8, totalImagens: 2 }]))
        .mockResolvedValueOnce(okResponse([]));

      let caught: unknown;
      try {
        await adapter.summaries(ids, 'emp-aetos');
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(PartialResultError);
      const partial = (caught as PartialResultError<Map<string, unknown>>).partial;
      expect(partial.size).toBe(2); // id-1 and id-101 from successful chunks
      expect(partial.has('id-1')).toBe(true);
      expect(partial.has('id-101')).toBe(true);

      const err = caught as PartialResultError<Map<string, unknown>>;
      expect(err.failedChunks).toBe(1);
      expect(err.totalChunks).toBe(4);
    });

    it('throws PartialResultError.failedChunks=2 when two chunks fail', async () => {
      const ids = makeIds(152);
      mockFetch
        .mockResolvedValueOnce(okResponse([{ projetoId: 'id-1', totalCapitulos: 5, totalImagens: 0 }]))
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce({ ok: false, status: 503 })
        .mockResolvedValueOnce(okResponse([]));

      let caught: unknown;
      try {
        await adapter.summaries(ids, 'emp-aetos');
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(PartialResultError);
      const err = caught as PartialResultError<Map<string, unknown>>;
      expect(err.failedChunks).toBe(2);
      expect(err.totalChunks).toBe(4);
      expect(err.partial.size).toBe(1); // only id-1 from chunk 0
    });

    it('throws plain Error (not PartialResultError) when ALL chunks fail', async () => {
      const ids = makeIds(152);
      mockFetch.mockResolvedValue({ ok: false, status: 400 });

      let caught: unknown;
      try {
        await adapter.summaries(ids, 'emp-aetos');
      } catch (err) {
        caught = err;
      }

      expect(caught).not.toBeInstanceOf(PartialResultError);
      expect(caught).toBeInstanceOf(Error);
    });
  });

  // ---------------------------------------------------------------------------
  // Degradation: adapter throws so callPort can mark degraded=true (Problem 1 fix)
  // ---------------------------------------------------------------------------

  it('throws when IMP returns non-200 for a single chunk (callPort will catch and mark degraded)', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503 });

    await expect(adapter.summaries(['id-1'], 'emp-aetos')).rejects.toThrow(
      /503/,
    );
  });

  it('throws when IMP is unreachable (callPort will catch and mark degraded)', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(adapter.summaries(['id-1'], 'emp-aetos')).rejects.toThrow(
      'ECONNREFUSED',
    );
  });

  it('throws when IMP_SERVICE_URL is not configured (callPort will catch and mark degraded)', async () => {
    mockConfig.get = jest.fn().mockReturnValue(undefined);
    adapter = new ImpManuscriptSummaryAdapter(mockConfig);

    await expect(adapter.summaries(['id-1'], 'emp-aetos')).rejects.toThrow(
      'IMP_SERVICE_URL not configured',
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Bearer token propagation (Problem 2 fix)
  // ---------------------------------------------------------------------------

  it('mounts Authorization header when bearerToken is provided', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

    await adapter.summaries(['id-1'], 'emp-aetos', 'test-token-123');

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-token-123');
  });

  it('does NOT mount Authorization header when bearerToken is absent', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

    await adapter.summaries(['id-1'], 'emp-aetos');

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('always sends X-Empresa-Id regardless of bearerToken', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

    await adapter.summaries(['id-1'], 'emp-aetos', 'tok');

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['X-Empresa-Id']).toBe('emp-aetos');
  });
});
