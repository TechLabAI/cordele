/**
 * Unit tests for PubPublicationErasureAdapter (PROJ-INT-006).
 *
 * Unlike the P4 read adapters, this adapter must NOT degrade silently — every
 * failure path (missing config, non-2xx, network error) must throw so the
 * caller (DeleteProjetoUseCase) aborts the LGPD erasure cascade.
 */

import { ConfigService } from '@nestjs/config';
import { PubPublicationErasureAdapter } from './pub-publication-erasure.adapter';

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

describe('PubPublicationErasureAdapter', () => {
  let adapter: PubPublicationErasureAdapter;

  beforeEach(() => {
    mockConfig.get = jest.fn().mockReturnValue('http://pub-service:3003');
    adapter = new PubPublicationErasureAdapter(mockConfig);
  });

  it('resolves when PUB responds 2xx — calls PUB erase port exactly once', async () => {
    // Batching invariant: exactly 1 call to PUB per erase invocation.
    mockFetch.mockResolvedValue({ ok: true, status: 204 });

    await expect(adapter.erase('projeto-1', 'emp-aetos')).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('resolves (idempotent) when project has no publications — PUB returns 204 no-op', async () => {
    // PUB is idempotent: when there are no publications for the project it returns 204 (safe no-op).
    // The adapter must complete without error so the LGPD cascade (PROJ-016) can proceed.
    // PUB erasure is the first step (leaf before COMP and IMP) — must not block the cascade.
    mockFetch.mockResolvedValue({ ok: true, status: 204 });

    await expect(adapter.erase('projeto-sem-publicacoes', 'emp-aetos')).resolves.toBeUndefined();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws when PUB_SERVICE_URL is not configured', async () => {
    mockConfig.get = jest.fn().mockReturnValue(undefined);
    adapter = new PubPublicationErasureAdapter(mockConfig);

    await expect(adapter.erase('projeto-1', 'emp-aetos')).rejects.toThrow();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws when PUB returns a non-2xx response', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 503 });

    await expect(adapter.erase('projeto-1', 'emp-aetos')).rejects.toThrow();
  });

  it('throws when PUB is unreachable', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(adapter.erase('projeto-1', 'emp-aetos')).rejects.toThrow('ECONNREFUSED');
  });
});
