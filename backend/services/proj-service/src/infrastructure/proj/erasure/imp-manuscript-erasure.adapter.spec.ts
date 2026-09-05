/**
 * Unit tests for ImpManuscriptErasureAdapter (PROJ-INT-004).
 *
 * Mirrors PubPublicationErasureAdapter's non-degraded contract: every failure
 * path must throw so DeleteProjetoUseCase aborts the cascade.
 */

import { ConfigService } from '@nestjs/config';
import { ImpManuscriptErasureAdapter } from './imp-manuscript-erasure.adapter';

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

describe('ImpManuscriptErasureAdapter', () => {
  let adapter: ImpManuscriptErasureAdapter;

  beforeEach(() => {
    mockConfig.get = jest.fn().mockReturnValue('http://imp-service:3001');
    adapter = new ImpManuscriptErasureAdapter(mockConfig);
  });

  it('resolves when IMP responds 2xx — calls IMP erase port exactly once', async () => {
    // Batching invariant: exactly 1 call to IMP regardless of project size.
    mockFetch.mockResolvedValue({ ok: true, status: 204 });

    await expect(adapter.erase('projeto-1', 'emp-aetos')).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('resolves (idempotent) when project has no manuscripts — IMP returns 204 no-op', async () => {
    // IMP is idempotent: when there are no manuscripts for the project it returns 204 (safe no-op).
    // The adapter must complete without error so the LGPD cascade (PROJ-016) can proceed.
    mockFetch.mockResolvedValue({ ok: true, status: 204 });

    await expect(adapter.erase('projeto-sem-manuscritos', 'emp-aetos')).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws when IMP_SERVICE_URL is not configured', async () => {
    mockConfig.get = jest.fn().mockReturnValue(undefined);
    adapter = new ImpManuscriptErasureAdapter(mockConfig);

    await expect(adapter.erase('projeto-1', 'emp-aetos')).rejects.toThrow();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws when IMP returns a non-2xx response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503 });

    await expect(adapter.erase('projeto-1', 'emp-aetos')).rejects.toThrow();
  });

  it('throws when IMP is unreachable', async () => {
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
});
