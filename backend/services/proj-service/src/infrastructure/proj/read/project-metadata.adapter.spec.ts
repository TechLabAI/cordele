/**
 * Unit tests for CompProjectMetadataAdapter (PROJ-INT-002).
 *
 * Contract (post-chunking update):
 *   - Empty projetoIds → empty Map (no HTTP call, not a degradation).
 *   - ≤50 IDs → exactly 1 HTTP call (single chunk, unchanged behaviour).
 *   - 152 IDs → 4 HTTP calls (chunks 50+50+50+2).
 *   - All chunks succeed → merged Map, no exception.
 *   - Some chunks fail → throws PartialResultError with partial data.
 *   - All chunks fail → throws Error (not PartialResultError).
 *   - Missing COMP_SERVICE_URL → throws before any fetch.
 *   - Authorization header mounted when bearerToken provided.
 */

import { ConfigService } from '@nestjs/config';
import { CompProjectMetadataAdapter } from './project-metadata.adapter';
import { PartialResultError } from '../../../domain/shared/partial-result.error';

const mockConfig = {
  get: jest.fn(),
} as unknown as jest.Mocked<ConfigService>;

const mockFetch = jest.fn();
const originalFetch = globalThis.fetch;

beforeAll(() => { globalThis.fetch = mockFetch; });
afterAll(() => { globalThis.fetch = originalFetch; });
afterEach(() => { jest.clearAllMocks(); });

function makeIds(count: number): string[] {
  return Array.from({ length: count }, (_, i) => `id-${i + 1}`);
}

describe('CompProjectMetadataAdapter', () => {
  let adapter: CompProjectMetadataAdapter;

  beforeEach(() => {
    mockConfig.get = jest.fn().mockReturnValue('http://comp-service:3002');
    adapter = new CompProjectMetadataAdapter(mockConfig);
  });

  // ---------------------------------------------------------------------------
  // Legitimate empty input
  // ---------------------------------------------------------------------------

  it('returns empty Map for empty projetoIds (no HTTP call)', async () => {
    const result = await adapter.metadata([], 'emp-aetos');

    expect(result.size).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Happy path — small input (≤ 50 IDs → 1 chunk)
  // ---------------------------------------------------------------------------

  it('makes exactly 1 call to COMP for up to 50 project IDs', async () => {
    const ids = ['id-1', 'id-2'];
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { projetoId: 'id-1', autor: 'Ana Lima' },
        { projetoId: 'id-2', autor: null },
      ],
    });

    await adapter.metadata(ids, 'emp-aetos');

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('maps COMP response autor correctly', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ projetoId: 'id-1', autor: 'Eliana Moraes' }],
    });

    const result = await adapter.metadata(['id-1'], 'emp-aetos');

    expect(result.get('id-1')?.autor).toBe('Eliana Moraes');
  });

  it('returns { autor: null } when COMP returns project without autor field', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ projetoId: 'id-1' }],
    });

    const result = await adapter.metadata(['id-1'], 'emp-aetos');

    expect(result.get('id-1')?.autor).toBeNull();
  });

  it('project absent from COMP response is absent from the Map — no metadata is not an error', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],
    });

    const result = await adapter.metadata(['id-1'], 'emp-aetos');

    expect(result.has('id-1')).toBe(false);
    expect(result.size).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Chunking: 152 IDs → 4 blocks (50+50+50+2)
  // ---------------------------------------------------------------------------

  describe('chunking (152 IDs → 4 blocks)', () => {
    it('makes 4 HTTP calls for 152 project IDs', async () => {
      const ids = makeIds(152);
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      await adapter.metadata(ids, 'emp-aetos');

      expect(mockFetch).toHaveBeenCalledTimes(4);
    });

    it('sends correct chunk sizes: 50+50+50+2 for 152 IDs', async () => {
      const ids = makeIds(152);
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      await adapter.metadata(ids, 'emp-aetos');

      const chunkSizes = (mockFetch.mock.calls as [string, RequestInit][]).map((call) => {
        const body = JSON.parse(call[1].body as string) as { projetoIds: string[] };
        return body.projetoIds.length;
      });
      expect(chunkSizes).toEqual([50, 50, 50, 2]);
    });

    it('merges results from all chunks into one Map', async () => {
      const ids = makeIds(152);
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => [{ projetoId: 'id-1', autor: 'Autor A' }] })
        .mockResolvedValueOnce({ ok: true, json: async () => [{ projetoId: 'id-51', autor: 'Autor B' }] })
        .mockResolvedValueOnce({ ok: true, json: async () => [{ projetoId: 'id-101', autor: null }] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      const result = await adapter.metadata(ids, 'emp-aetos');

      expect(result.get('id-1')?.autor).toBe('Autor A');
      expect(result.get('id-51')?.autor).toBe('Autor B');
      expect(result.get('id-101')?.autor).toBeNull();
    });

    it('all chunks succeed → returns complete Map, no exception', async () => {
      const ids = makeIds(152);
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      await expect(adapter.metadata(ids, 'emp-aetos')).resolves.toBeInstanceOf(Map);
    });
  });

  // ---------------------------------------------------------------------------
  // Partial degradation: middle chunk fails
  // ---------------------------------------------------------------------------

  describe('partial degradation', () => {
    it('throws PartialResultError with partial data when middle chunk fails', async () => {
      const ids = makeIds(152);
      mockFetch
        .mockResolvedValueOnce({ ok: true, json: async () => [{ projetoId: 'id-1', autor: 'A' }] })
        .mockResolvedValueOnce({ ok: false, status: 400 })  // chunk 1 fails
        .mockResolvedValueOnce({ ok: true, json: async () => [{ projetoId: 'id-101', autor: 'B' }] })
        .mockResolvedValueOnce({ ok: true, json: async () => [] });

      let caught: unknown;
      try {
        await adapter.metadata(ids, 'emp-aetos');
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(PartialResultError);
      const partial = (caught as PartialResultError<Map<string, unknown>>).partial;
      expect(partial.size).toBe(2);
      expect(partial.has('id-1')).toBe(true);
      expect(partial.has('id-101')).toBe(true);

      const err = caught as PartialResultError<Map<string, unknown>>;
      expect(err.failedChunks).toBe(1);
      expect(err.totalChunks).toBe(4);
    });

    it('throws plain Error (not PartialResultError) when ALL chunks fail', async () => {
      const ids = makeIds(152);
      mockFetch.mockResolvedValue({ ok: false, status: 503 });

      let caught: unknown;
      try {
        await adapter.metadata(ids, 'emp-aetos');
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

  it('throws when COMP is unavailable (callPort will catch and mark degraded)', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(adapter.metadata(['id-1'], 'emp-aetos')).rejects.toThrow('ECONNREFUSED');
  });

  it('throws when COMP returns non-200 (callPort will catch and mark degraded)', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 502 });

    await expect(adapter.metadata(['id-1'], 'emp-aetos')).rejects.toThrow(/502/);
  });

  it('throws when COMP_SERVICE_URL is not configured (callPort will catch and mark degraded)', async () => {
    mockConfig.get = jest.fn().mockReturnValue(undefined);
    adapter = new CompProjectMetadataAdapter(mockConfig);

    await expect(adapter.metadata(['id-1'], 'emp-aetos')).rejects.toThrow(
      'COMP_SERVICE_URL not configured',
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Bearer token propagation (Problem 2 fix)
  // ---------------------------------------------------------------------------

  it('mounts Authorization header when bearerToken is provided', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

    await adapter.metadata(['id-1'], 'emp-aetos', 'my-token');

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer my-token');
  });

  it('does NOT mount Authorization header when bearerToken is absent', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

    await adapter.metadata(['id-1'], 'emp-aetos');

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });

  it('always sends X-Empresa-Id regardless of bearerToken', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

    await adapter.metadata(['id-1'], 'emp-aetos', 'tok');

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Record<string, string>;
    expect(headers['X-Empresa-Id']).toBe('emp-aetos');
  });
});
