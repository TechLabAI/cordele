/**
 * Unit tests for PubPublicationHistoryAdapter (PROJ-INT-003).
 *
 * Post-fix (2026-09-04) contract:
 *   - latest() empty projetoIds → empty Map (no HTTP call, not a degradation).
 *   - Missing PUB_SERVICE_URL → throws (callPort marks degraded).
 *   - Non-2xx HTTP → throws (callPort marks degraded for latest/history;
 *     propagates for signedDownloadUrl which is always a hard call).
 *   - Network error → propagates.
 *   - history() uses /publicacoes path (not /publications).
 *   - signedDownloadUrl() uses projetoId in path + /download endpoint.
 *   - Authorization header mounted when bearerToken provided.
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
const PUB_ID = 'pub-uuid-1';
const EMPRESA_ID = 'emp-aetos';
const BASE_URL = 'http://pub-service:3003';

describe('PubPublicationHistoryAdapter', () => {
  let adapter: PubPublicationHistoryAdapter;

  beforeEach(() => {
    mockConfig.get = jest.fn().mockReturnValue(BASE_URL);
    adapter = new PubPublicationHistoryAdapter(mockConfig);
  });

  // ---------------------------------------------------------------------------
  // latest()
  // ---------------------------------------------------------------------------

  describe('latest()', () => {
    it('returns empty Map for empty projetoIds (no HTTP call)', async () => {
      const result = await adapter.latest([], EMPRESA_ID);

      expect(result.size).toBe(0);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('makes exactly 1 call for any number of project IDs', async () => {
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
      expect(result.has('id-3')).toBe(false);
    });

    it('throws when PUB is unavailable (callPort will catch and mark degraded)', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(adapter.latest([PROJETO_ID], EMPRESA_ID)).rejects.toThrow('ECONNREFUSED');
    });

    it('throws when PUB returns non-200 (callPort will catch and mark degraded)', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 });

      await expect(adapter.latest([PROJETO_ID], EMPRESA_ID)).rejects.toThrow(/404/);
    });

    it('throws when PUB_SERVICE_URL is not configured', async () => {
      mockConfig.get = jest.fn().mockReturnValue(undefined);
      adapter = new PubPublicationHistoryAdapter(mockConfig);

      await expect(adapter.latest([PROJETO_ID], EMPRESA_ID)).rejects.toThrow(
        'PUB_SERVICE_URL not configured',
      );
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('mounts Authorization header when bearerToken is provided', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      await adapter.latest([PROJETO_ID], EMPRESA_ID, 'bearer-tok');

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer bearer-tok');
    });

    it('does NOT mount Authorization header when bearerToken is absent', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      await adapter.latest([PROJETO_ID], EMPRESA_ID);

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;
      expect(headers['Authorization']).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // history()
  // ---------------------------------------------------------------------------

  describe('history()', () => {
    it('maps records correctly', async () => {
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
      expect(result[0].publicacaoId).toBe('pub-2');
      expect(result[1].publicacaoId).toBe('pub-1');
    });

    it('calls the /publicacoes endpoint path (not /publications)', async () => {
      // Problem 3 fix: path was /publications, real endpoint is /publicacoes.
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      await adapter.history(PROJETO_ID, EMPRESA_ID);

      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toBe(`${BASE_URL}/api/v1/pub/projetos/${PROJETO_ID}/publicacoes`);
      expect(url).not.toContain('/publications');
    });

    it('throws when PUB is unavailable (callPort will catch and mark degraded)', async () => {
      mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(adapter.history(PROJETO_ID, EMPRESA_ID)).rejects.toThrow('ECONNREFUSED');
    });

    it('throws when PUB returns non-200 (callPort will catch and mark degraded)', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 });

      await expect(adapter.history(PROJETO_ID, EMPRESA_ID)).rejects.toThrow(/404/);
    });

    it('throws when PUB_SERVICE_URL is not configured', async () => {
      mockConfig.get = jest.fn().mockReturnValue(undefined);
      adapter = new PubPublicationHistoryAdapter(mockConfig);

      await expect(adapter.history(PROJETO_ID, EMPRESA_ID)).rejects.toThrow(
        'PUB_SERVICE_URL not configured',
      );
    });

    it('mounts Authorization header when bearerToken is provided', async () => {
      mockFetch.mockResolvedValue({ ok: true, json: async () => [] });

      await adapter.history(PROJETO_ID, EMPRESA_ID, 'bearer-tok');

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer bearer-tok');
    });
  });

  // ---------------------------------------------------------------------------
  // signedDownloadUrl()
  // ---------------------------------------------------------------------------

  describe('signedDownloadUrl()', () => {
    it('returns arquivoUrl and expiresAt', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          arquivoUrl: 'https://storage.example.com/romance.epub?sig=abc',
          expiresAt: '2026-08-25T15:00:00Z',
        }),
      });

      const result = await adapter.signedDownloadUrl(PUB_ID, PROJETO_ID, EMPRESA_ID);

      expect(result.arquivoUrl).toBe('https://storage.example.com/romance.epub?sig=abc');
      expect(result.expiresAt).toBe('2026-08-25T15:00:00Z');
    });

    it('uses projetoId in the /publicacoes/{pubId}/download path (Problem 3 fix)', async () => {
      // Real endpoint: /api/v1/pub/projetos/{projetoId}/publicacoes/{publicacaoId}/download
      // Old (wrong):   /api/v1/pub/publications/{publicacaoId}/signed-url
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ arquivoUrl: 'https://x', expiresAt: '2026-09-01T00:00:00Z' }),
      });

      await adapter.signedDownloadUrl(PUB_ID, PROJETO_ID, EMPRESA_ID);

      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toBe(
        `${BASE_URL}/api/v1/pub/projetos/${PROJETO_ID}/publicacoes/${PUB_ID}/download`,
      );
      expect(url).not.toContain('/signed-url');
    });

    it('throws when PUB returns non-200 (use case propagates as 5xx)', async () => {
      mockFetch.mockResolvedValue({ ok: false, status: 404 });

      await expect(
        adapter.signedDownloadUrl(PUB_ID, PROJETO_ID, EMPRESA_ID),
      ).rejects.toThrow();
    });

    it('throws when PUB_SERVICE_URL is not configured', async () => {
      mockConfig.get = jest.fn().mockReturnValue(undefined);
      adapter = new PubPublicationHistoryAdapter(mockConfig);

      await expect(
        adapter.signedDownloadUrl(PUB_ID, PROJETO_ID, EMPRESA_ID),
      ).rejects.toThrow('PUB_SERVICE_URL not configured');
    });

    it('mounts Authorization header when bearerToken is provided', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ arquivoUrl: 'https://x', expiresAt: '2026-09-01T00:00:00Z' }),
      });

      await adapter.signedDownloadUrl(PUB_ID, PROJETO_ID, EMPRESA_ID, 'bearer-tok');

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;
      expect(headers['Authorization']).toBe('Bearer bearer-tok');
    });

    it('does not validate epubcheckStatus — that is the use case responsibility (PROJ-013)', async () => {
      // The adapter is agnostic about epubcheckStatus. GetSignedDownloadUrlUseCase
      // checks epubcheckStatus and throws ConflictException BEFORE calling this port.
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          arquivoUrl: 'https://storage.example.com/romance.epub?sig=xyz',
          expiresAt: '2026-09-01T12:00:00Z',
        }),
      });

      const result = await adapter.signedDownloadUrl('pub-any', PROJETO_ID, EMPRESA_ID);

      expect(result.arquivoUrl).toBe('https://storage.example.com/romance.epub?sig=xyz');
    });
  });
});
