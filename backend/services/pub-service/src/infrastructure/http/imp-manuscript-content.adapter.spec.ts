/**
 * Unit spec for ImpManuscriptContentAdapter (INT-PUB-001, P6).
 *
 * All HTTP calls are intercepted via `jest.spyOn(global, 'fetch')` — no real
 * network calls. Covers the two-step IMP protocol (list → estrutura), the
 * null-on-404 contract, and resilient error handling.
 *
 * RULE-08: no console.log — logger calls are suppressed via NestJS Logger mock.
 */

import { ConfigService } from '@nestjs/config';

import { ImpManuscriptContentAdapter } from './imp-manuscript-content.adapter';

const PROJETO_ID = 'proj-aaa-111';
const MANUSCRITO_ID = 'ms-bbb-222';
const BEARER = 'test-jwt-token';
const IMP_URL = 'http://imp-test:3001';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeConfig(url = IMP_URL): ConfigService {
  return {
    get: (key: string) => (key === 'IMP_SERVICE_URL' ? url : undefined),
  } as unknown as ConfigService;
}

function mockFetch(responses: Array<{ status: number; body: unknown }>): jest.SpyInstance {
  let callCount = 0;
  return jest.spyOn(global, 'fetch').mockImplementation(async () => {
    const r = responses[callCount++] ?? { status: 200, body: {} };
    const bodyText = JSON.stringify(r.body);
    return new Response(bodyText, {
      status: r.status,
      headers: { 'Content-Type': 'application/json' },
    }) as Response;
  });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ImpManuscriptContentAdapter', () => {
  let adapter: ImpManuscriptContentAdapter;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    adapter = new ImpManuscriptContentAdapter(makeConfig());
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('returns null when the manuscript list is empty (no imported manuscript)', async () => {
    fetchSpy = mockFetch([{ status: 200, body: [] }]);

    const result = await adapter.getContentTree(PROJETO_ID, BEARER);

    expect(result).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(fetchSpy).toHaveBeenCalledWith(
      `${IMP_URL}/api/v1/imp/projetos/${PROJETO_ID}/manuscritos`,
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: `Bearer ${BEARER}` }) }),
    );
  });

  it('returns null when the manuscript list returns 404', async () => {
    fetchSpy = mockFetch([{ status: 404, body: { message: 'not found' } }]);

    const result = await adapter.getContentTree(PROJETO_ID, BEARER);

    expect(result).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it('returns null when the estrutura endpoint returns 404 (manuscript deleted between calls)', async () => {
    fetchSpy = mockFetch([
      { status: 200, body: [{ id: MANUSCRITO_ID }] },
      { status: 404, body: { message: 'not found' } },
    ]);

    const result = await adapter.getContentTree(PROJETO_ID, BEARER);

    expect(result).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it('returns the ContentTree on the happy path (two-step IMP protocol)', async () => {
    const chapters = [
      { id: 'ch-1', title: 'Capítulo 1', order: 1, sections: [] },
    ];
    fetchSpy = mockFetch([
      { status: 200, body: [{ id: MANUSCRITO_ID, status: 'CONFIRMADO', createdAt: '2026-08-01T00:00:00Z' }] },
      { status: 200, body: { manuscritoId: MANUSCRITO_ID, estrutura: { chapters, orphanUnparsedSegments: [] } } },
    ]);

    const result = await adapter.getContentTree(PROJETO_ID, BEARER);

    expect(result).not.toBeNull();
    expect(result!.manuscritoId).toBe(MANUSCRITO_ID);
    expect(result!.estrutura).toEqual(chapters);
  });

  it('selects the first (newest) manuscript when multiple are returned', async () => {
    const newerMs = { id: 'ms-newer', status: 'CONFIRMADO', createdAt: '2026-08-10T00:00:00Z' };
    const olderMs = { id: 'ms-older', status: 'CONFIRMADO', createdAt: '2026-08-01T00:00:00Z' };
    fetchSpy = mockFetch([
      { status: 200, body: [newerMs, olderMs] },
      { status: 200, body: { manuscritoId: 'ms-newer', estrutura: { chapters: [], orphanUnparsedSegments: [] } } },
    ]);

    const result = await adapter.getContentTree(PROJETO_ID, BEARER);

    expect(result!.manuscritoId).toBe('ms-newer');
    // Verify the second call used the newest manuscript id.
    expect(fetchSpy.mock.calls[1]![0]).toContain('ms-newer');
  });

  it('forwards Authorization header correctly in both requests', async () => {
    fetchSpy = mockFetch([
      { status: 200, body: [{ id: MANUSCRITO_ID }] },
      { status: 200, body: { manuscritoId: MANUSCRITO_ID, estrutura: { chapters: [], orphanUnparsedSegments: [] } } },
    ]);

    await adapter.getContentTree(PROJETO_ID, BEARER);

    for (const [, init] of fetchSpy.mock.calls) {
      expect((init as RequestInit).headers).toMatchObject({ Authorization: `Bearer ${BEARER}` });
    }
  });

  it('returns null (does not throw) when fetch throws a network error on list call', async () => {
    fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await adapter.getContentTree(PROJETO_ID, BEARER);

    expect(result).toBeNull();
  });

  it('returns null (does not throw) when fetch throws a network error on estrutura call', async () => {
    fetchSpy = jest.spyOn(global, 'fetch')
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: MANUSCRITO_ID }]), { status: 200, headers: { 'Content-Type': 'application/json' } }))
      .mockRejectedValueOnce(new Error('ETIMEDOUT'));

    const result = await adapter.getContentTree(PROJETO_ID, BEARER);

    expect(result).toBeNull();
  });

  it('returns null (does not throw) on non-2xx from list endpoint', async () => {
    fetchSpy = mockFetch([{ status: 503, body: { message: 'service unavailable' } }]);

    const result = await adapter.getContentTree(PROJETO_ID, BEARER);

    expect(result).toBeNull();
  });

  it('uses IMP_SERVICE_URL from config', async () => {
    const customUrl = 'http://custom-imp:9999';
    const customAdapter = new ImpManuscriptContentAdapter(makeConfig(customUrl));
    fetchSpy = mockFetch([{ status: 200, body: [] }]);

    await customAdapter.getContentTree(PROJETO_ID, BEARER);

    expect(fetchSpy.mock.calls[0]![0]).toContain(customUrl);
  });
});
