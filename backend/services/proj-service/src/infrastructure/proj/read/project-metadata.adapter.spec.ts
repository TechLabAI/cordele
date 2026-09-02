/**
 * Unit tests for CompProjectMetadataAdapter (PROJ-INT-002).
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

  it('returns empty Map for empty projetoIds (no HTTP call)', async () => {
    const result = await adapter.metadata([], 'emp-aetos');

    expect(result.size).toBe(0);
    expect(mockFetch).not.toHaveBeenCalled();
  });

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
    // COMP responds with the project but omits the autor field — adapter normalises to null.
    // autor is typed as string | null | undefined; adapter uses `?? null` to be explicit.
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ projetoId: 'id-1' }],
    });

    const result = await adapter.metadata(['id-1'], 'emp-aetos');

    expect(result.get('id-1')?.autor).toBeNull();
  });

  it('project absent from COMP response is absent from the Map — no metadata is not an error', async () => {
    // When COMP has no record for a project it simply omits it from the batch response.
    // The adapter must NOT insert the project into the Map with an undefined/null value;
    // it must leave it absent — callers treat absence as "no COMP data yet" (not degraded).
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [],  // COMP returns empty array — project has no COMP metadata yet
    });

    const result = await adapter.metadata(['id-1'], 'emp-aetos');

    expect(result.has('id-1')).toBe(false);
    expect(result.size).toBe(0);
  });

  it('returns empty Map (not thrown error) when COMP is unavailable', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await adapter.metadata(['id-1'], 'emp-aetos');

    expect(result.size).toBe(0);
  });

  it('returns empty Map (not thrown error) when COMP returns non-200', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 502 });

    const result = await adapter.metadata(['id-1'], 'emp-aetos');

    expect(result.size).toBe(0);
  });
});
