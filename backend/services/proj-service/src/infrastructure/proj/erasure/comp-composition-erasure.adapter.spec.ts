/**
 * Unit tests for CompCompositionErasureAdapter (PROJ-INT-005).
 *
 * Mirrors PubPublicationErasureAdapter's non-degraded contract: every failure
 * path must throw so DeleteProjetoUseCase aborts the cascade.
 */

import { ConfigService } from '@nestjs/config';
import { CompCompositionErasureAdapter } from './comp-composition-erasure.adapter';

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

describe('CompCompositionErasureAdapter', () => {
  let adapter: CompCompositionErasureAdapter;

  beforeEach(() => {
    mockConfig.get = jest.fn().mockReturnValue('http://comp-service:3002');
    adapter = new CompCompositionErasureAdapter(mockConfig);
  });

  it('resolves when COMP responds 2xx — calls COMP erase port exactly once', async () => {
    // Batching invariant: exactly 1 call to COMP per erase invocation.
    mockFetch.mockResolvedValue({ ok: true, status: 204 });

    await expect(adapter.erase('projeto-1', 'emp-aetos')).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('resolves (idempotent) when project has no COMP compositions — COMP returns 204 no-op', async () => {
    // COMP is idempotent: when there are no compositions for the project it returns 204 (safe no-op).
    // The adapter must complete without error so the LGPD cascade (PROJ-016) can proceed.
    mockFetch.mockResolvedValue({ ok: true, status: 204 });

    await expect(adapter.erase('projeto-sem-composicao', 'emp-aetos')).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws when COMP_SERVICE_URL is not configured', async () => {
    mockConfig.get = jest.fn().mockReturnValue(undefined);
    adapter = new CompCompositionErasureAdapter(mockConfig);

    await expect(adapter.erase('projeto-1', 'emp-aetos')).rejects.toThrow();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws when COMP returns a non-2xx response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503 });

    await expect(adapter.erase('projeto-1', 'emp-aetos')).rejects.toThrow();
  });

  it('throws when COMP is unreachable', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(adapter.erase('projeto-1', 'emp-aetos')).rejects.toThrow('ECONNREFUSED');
  });

  it('never sends X-Empresa-Id — isolation is enforced via JWT claim, not via request header', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 });

    await adapter.erase('projeto-1', 'emp-aetos');

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit | undefined];
    const headers = (options?.headers ?? {}) as Record<string, string>;
    expect(headers['X-Empresa-Id']).toBeUndefined();
  });

  it('mounts Authorization header when bearerToken is provided', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 });

    await adapter.erase('projeto-1', 'emp-aetos', 'test-bearer-token');

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit | undefined];
    const headers = (options?.headers ?? {}) as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer test-bearer-token');
  });

  it('does NOT mount Authorization header when bearerToken is absent', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 204 });

    await adapter.erase('projeto-1', 'emp-aetos');

    const [, options] = mockFetch.mock.calls[0] as [string, RequestInit | undefined];
    const headers = (options?.headers ?? {}) as Record<string, string>;
    expect(headers['Authorization']).toBeUndefined();
  });
});
