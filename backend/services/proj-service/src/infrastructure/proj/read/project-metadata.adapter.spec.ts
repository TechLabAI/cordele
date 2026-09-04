/**
 * Unit tests for CompProjectMetadataAdapter (PROJ-INT-002).
 *
 * Post-fix (2026-09-04) contract:
 *   - Empty projetoIds → empty Map (no HTTP call, not a degradation).
 *   - Missing COMP_SERVICE_URL → throws (callPort marks degraded).
 *   - Non-2xx HTTP → throws (callPort marks degraded).
 *   - Network error → propagates (callPort marks degraded).
 *   - Authorization header mounted when bearerToken provided.
 */

import { ConfigService } from '@nestjs/config';
import { CompProjectMetadataAdapter } from './project-metadata.adapter';

const mockConfig = {
  get: jest.fn(),
} as unknown as jest.Mocked<ConfigService>;

const mockFetch = jest.fn();
const originalFetch = globalThis.fetch;

beforeAll(() => { globalThis.fetch = mockFetch; });
afterAll(() => { globalThis.fetch = originalFetch; });
afterEach(() => { jest.clearAllMocks(); });

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
  // Happy path
  // ---------------------------------------------------------------------------

  it('makes exactly 1 call to COMP for any number of project IDs', async () => {
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
