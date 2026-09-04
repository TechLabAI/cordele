/**
 * Unit tests for ImpManuscriptSummaryAdapter (PROJ-INT-001).
 *
 * Uses jest-fetch-mock pattern: replaces globalThis.fetch with a jest mock
 * to avoid real HTTP calls while keeping the adapter logic testable.
 *
 * Post-fix (2026-09-04) contract:
 *   - Empty projetoIds → empty Map (no HTTP call, not a degradation).
 *   - Missing IMP_SERVICE_URL → throws (callPort marks degraded).
 *   - Non-2xx HTTP → throws (callPort marks degraded).
 *   - Network error → propagates (callPort marks degraded).
 *   - Authorization header mounted when bearerToken provided.
 */

import { ConfigService } from '@nestjs/config';
import { ImpManuscriptSummaryAdapter } from './manuscript-summary.adapter';

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
  // Happy path
  // ---------------------------------------------------------------------------

  it('makes exactly 1 call to IMP for any number of project IDs', async () => {
    const ids = ['id-1', 'id-2', 'id-3'];
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { projetoId: 'id-1', totalCapitulos: 5, totalImagens: 2 },
        { projetoId: 'id-2', totalCapitulos: 10, totalImagens: 0 },
        { projetoId: 'id-3', totalCapitulos: 3, totalImagens: 1 },
      ],
    });

    const result = await adapter.summaries(ids, 'emp-aetos');

    // Exactly 1 HTTP call (batching invariant)
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.size).toBe(3);
    expect(result.get('id-1')).toEqual({ totalCapitulos: 5, totalImagens: 2 });
  });

  it('maps IMP response to ManuscriptSummary shape correctly', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { projetoId: 'id-1', totalCapitulos: 18, totalImagens: 3 },
      ],
    });

    const result = await adapter.summaries(['id-1'], 'emp-aetos');

    const summary = result.get('id-1');
    expect(summary).toBeDefined();
    expect(summary!.totalCapitulos).toBe(18);
    expect(summary!.totalImagens).toBe(3);
  });

  // ---------------------------------------------------------------------------
  // Degradation: adapter throws so callPort can mark degraded=true (Problem 1 fix)
  // ---------------------------------------------------------------------------

  it('throws when IMP returns non-200 (callPort will catch and mark degraded)', async () => {
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
