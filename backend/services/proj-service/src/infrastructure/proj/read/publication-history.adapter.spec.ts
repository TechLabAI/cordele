/**
 * Unit tests for PubPublicationHistoryAdapter (PROJ-INT-003).
 */

import { ConfigService } from '@nestjs/config';
import { PubPublicationHistoryAdapter } from './publication-history.adapter';

const mockConfig = {
  get: jest.fn(),
} as unknown as jest.Mocked<ConfigService>;

const mockFetch = jest.fn();
const originalFetch = globalThis.fetch;

beforeAll(() => { globalThis.fetch = mockFetch; });
afterAll(() => { globalThis.fetch = originalFetch; });
afterEach(() => { jest.clearAllMocks(); });

const PROJETO_ID = 'proj-uuid-1';
const EMPRESA_ID = 'emp-aetos';

describe('PubPublicationHistoryAdapter', () => {
  let adapter: PubPublicationHistoryAdapter;

  beforeEach(() => {
    mockConfig.get = jest.fn().mockReturnValue('http://pub-service:3003');
    adapter = new PubPublicationHistoryAdapter(mockConfig);
  });

  // --- latest() ---

  it('latest() makes exactly 1 call for any number of project IDs', async () => {
    const ids = ['id-1', 'id-2', 'id-3'];
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        { projetoId: 'id-1', publicacaoId: 'pub-1', epubcheckStatus: 'valido' },
        { projetoId: 'id-2', publicacaoId: 'pub-2', epubcheckStatus: 'avisos' },
      ],
    });

    const result = await adapter.latest(ids, EMPRESA_ID);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.size).toBe(2);
    expect(result.get('id-1')?.epubcheckStatus).toBe('valido');
    expect(result.get('id-2')?.epubcheckStatus).toBe('avisos');
    // id-3 has no publication — absent from Map
    expect(result.has('id-3')).toBe(false);
  });

  it('latest() returns empty Map (not thrown error) when PUB is unavailable', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await adapter.latest([PROJETO_ID], EMPRESA_ID);

    expect(result.size).toBe(0);
  });

  // --- history() ---

  it('history() maps records correctly', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => [
        {
          publicacaoId: 'pub-2',
          projetoId: PROJETO_ID,
          epubcheckStatus: 'avisos',
          totalErros: 0,
          totalAvisos: 2,
          criadoEm: '2026-06-19T16:30:00Z',
        },
        {
          publicacaoId: 'pub-1',
          projetoId: PROJETO_ID,
          epubcheckStatus: 'erros_criticos',
          totalErros: 3,
          totalAvisos: 0,
          criadoEm: '2026-06-14T09:15:00Z',
        },
      ],
    });

    const result = await adapter.history(PROJETO_ID, EMPRESA_ID);

    expect(result).toHaveLength(2);
    // Ordering is preserved as returned by PUB (PUB guarantees criadoEm DESC)
    expect(result[0].publicacaoId).toBe('pub-2');
    expect(result[1].publicacaoId).toBe('pub-1');
  });

  it('history() returns [] (not thrown error) when PUB is unavailable', async () => {
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await adapter.history(PROJETO_ID, EMPRESA_ID);

    expect(result).toEqual([]);
  });

  // --- signedDownloadUrl() ---

  it('signedDownloadUrl() returns arquivoUrl and expiresAt', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        arquivoUrl: 'https://storage.example.com/romance.epub?sig=abc',
        expiresAt: '2026-08-25T15:00:00Z',
      }),
    });

    const result = await adapter.signedDownloadUrl('pub-1', EMPRESA_ID);

    expect(result.arquivoUrl).toBe('https://storage.example.com/romance.epub?sig=abc');
    expect(result.expiresAt).toBe('2026-08-25T15:00:00Z');
  });

  it('signedDownloadUrl() throws when PUB returns non-200 (use case handles 409)', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });

    await expect(adapter.signedDownloadUrl('pub-1', EMPRESA_ID)).rejects.toThrow();
  });

  it('signedDownloadUrl() does not validate epubcheckStatus — that responsibility belongs to the use case (PROJ-013)', async () => {
    // Contract: the PORT itself is agnostic about epubcheckStatus.
    // GetSignedDownloadUrlUseCase (PROJ-013) is responsible for checking epubcheckStatus
    // and throwing ArtifactNotAvailableError (→ 409) BEFORE calling this port method.
    // The adapter just delegates to PUB and returns whatever PUB provides.
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        arquivoUrl: 'https://storage.example.com/romance.epub?sig=xyz',
        expiresAt: '2026-09-01T12:00:00Z',
      }),
    });

    // No epubcheckStatus guard in the adapter — it must not throw based on status alone
    const result = await adapter.signedDownloadUrl('pub-any-status', EMPRESA_ID);

    expect(result.arquivoUrl).toBe('https://storage.example.com/romance.epub?sig=xyz');
    expect(result.expiresAt).toBe('2026-09-01T12:00:00Z');
  });
});
