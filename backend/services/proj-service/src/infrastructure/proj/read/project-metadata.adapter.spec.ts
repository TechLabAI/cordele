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

  it('returns { autor: null } when COMP has no metadata for a project', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [{ projetoId: 'id-1' }],
    });

    const result = await adapter.metadata(['id-1'], 'emp-aetos');

    expect(result.get('id-1')?.autor).toBeNull();
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
