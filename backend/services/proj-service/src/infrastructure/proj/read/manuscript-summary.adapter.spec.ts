/**
 * Unit tests for ImpManuscriptSummaryAdapter (PROJ-INT-001).
 *
 * Uses jest-fetch-mock pattern: replaces globalThis.fetch with a jest mock
 * to avoid real HTTP calls while keeping the adapter logic testable.
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

  it('returns empty Map for empty projetoIds (no HTTP call)', async () => {
    const result = await adapter.summaries([], 'emp-aetos');

    expect(result.size).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

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

  it('returns empty Map (not thrown error) when IMP returns non-200', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503 });

    const result = await adapter.summaries(['id-1'], 'emp-aetos');

    expect(result.size).toBe(0);
  });

  it('returns empty Map (not thrown error) when IMP is unreachable', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await adapter.summaries(['id-1'], 'emp-aetos');

    expect(result.size).toBe(0);
  });

  it('returns empty Map when IMP_SERVICE_URL is not configured', async () => {
    mockConfig.get = jest.fn().mockReturnValue(undefined);
    adapter = new ImpManuscriptSummaryAdapter(mockConfig);

    const result = await adapter.summaries(['id-1'], 'emp-aetos');

    expect(result.size).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
