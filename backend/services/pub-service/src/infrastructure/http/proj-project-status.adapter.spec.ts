/**
 * Unit spec for ProjProjectStatusAdapter (INT-PUB-003, P6).
 *
 * All HTTP calls are intercepted via `jest.spyOn(global, 'fetch')` — no real
 * network calls. Covers:
 *  - Happy path: POST with Bearer token → HTTP 200 → AdvanceProjetoStatusResult
 *  - 409 illegal-status-transition → ProjectStatusAdvanceError
 *  - 404 project not found → ProjectStatusAdvanceError
 *  - Network error → ProjectStatusAdvanceError
 *  - Bearer token forwarding in Authorization header
 *
 * RULE-08: no console.log — NestJS Logger calls are naturally suppressed in
 * test environment.
 */

import { ConfigService } from '@nestjs/config';

import { ProjectStatusAdvanceError } from '../../domain/pub/errors/project-status-advance.error';
import { ProjProjectStatusAdapter } from './proj-project-status.adapter';

const PROJETO_ID = 'proj-ccc-333';
const BEARER = 'test-proj-jwt-token';
const PROJ_URL = 'http://proj-test:3002';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeConfig(url = PROJ_URL): ConfigService {
  return {
    get: (key: string) => (key === 'PROJ_SERVICE_BASE_URL' ? url : undefined),
  } as unknown as ConfigService;
}

function mockFetchOnce(status: number, body: unknown): jest.SpyInstance {
  return jest.spyOn(global, 'fetch').mockResolvedValueOnce(
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }) as Response,
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ProjProjectStatusAdapter', () => {
  let adapter: ProjProjectStatusAdapter;
  let fetchSpy: jest.SpyInstance;

  beforeEach(() => {
    adapter = new ProjProjectStatusAdapter(makeConfig());
  });

  afterEach(() => {
    fetchSpy?.mockRestore();
  });

  it('calls the correct PROJ endpoint with Authorization header and body', async () => {
    fetchSpy = mockFetchOnce(200, { projetoId: PROJETO_ID, newStatus: 'publicado', changed: true });

    await adapter.advanceTo({ projetoId: PROJETO_ID, targetStatus: 'publicado' }, BEARER);

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${PROJ_URL}/api/v1/proj/projetos/${PROJETO_ID}/advance-status`);
    expect((init.headers as Record<string, string>)['Authorization']).toBe(`Bearer ${BEARER}`);
    expect(init.method).toBe('POST');
    const bodyParsed = JSON.parse(init.body as string) as { targetStatus: string };
    expect(bodyParsed.targetStatus).toBe('publicado');
  });

  it('returns the AdvanceProjetoStatusResult on HTTP 200 (happy path)', async () => {
    fetchSpy = mockFetchOnce(200, { projetoId: PROJETO_ID, newStatus: 'publicado', changed: true });

    const result = await adapter.advanceTo({ projetoId: PROJETO_ID, targetStatus: 'publicado' }, BEARER);

    expect(result.projetoId).toBe(PROJETO_ID);
    expect(result.newStatus).toBe('publicado');
    expect(result.changed).toBe(true);
  });

  it('returns changed=false when PROJ reports the status was already set', async () => {
    fetchSpy = mockFetchOnce(200, { projetoId: PROJETO_ID, newStatus: 'com_erros', changed: false });

    const result = await adapter.advanceTo({ projetoId: PROJETO_ID, targetStatus: 'com_erros' }, BEARER);

    expect(result.changed).toBe(false);
    expect(result.newStatus).toBe('com_erros');
  });

  it('throws ProjectStatusAdvanceError with reason on HTTP 409 (illegal transition)', async () => {
    fetchSpy = mockFetchOnce(409, {
      type: 'urn:cordele:proj:illegal-status-transition',
      from: 'rascunho',
      to: 'publicado',
    });

    let caughtError: unknown;
    try {
      await adapter.advanceTo({ projetoId: PROJETO_ID, targetStatus: 'publicado' }, BEARER);
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ProjectStatusAdvanceError);
    expect(caughtError).toMatchObject({
      projetoId: PROJETO_ID,
      targetStatus: 'publicado',
      reason: expect.stringContaining('urn:cordele:proj:illegal-status-transition'),
    });
  });

  it('throws ProjectStatusAdvanceError on HTTP 404 (project not found)', async () => {
    fetchSpy = mockFetchOnce(404, { message: 'Projeto não encontrado' });

    await expect(
      adapter.advanceTo({ projetoId: PROJETO_ID, targetStatus: 'publicado' }, BEARER),
    ).rejects.toThrow(ProjectStatusAdvanceError);
  });

  it('throws ProjectStatusAdvanceError on network error (ECONNREFUSED)', async () => {
    fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('ECONNREFUSED'));

    let caughtError: unknown;
    try {
      await adapter.advanceTo({ projetoId: PROJETO_ID, targetStatus: 'publicado' }, BEARER);
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).toBeInstanceOf(ProjectStatusAdvanceError);
    // The reason includes the network error message (may be wrapped as "network error: <msg>")
    expect((caughtError as ProjectStatusAdvanceError).reason).toMatch(/network error/i);
  });

  it('throws ProjectStatusAdvanceError on generic 5xx error', async () => {
    fetchSpy = mockFetchOnce(503, { message: 'Service Unavailable' });

    await expect(
      adapter.advanceTo({ projetoId: PROJETO_ID, targetStatus: 'com_erros' }, BEARER),
    ).rejects.toThrow(ProjectStatusAdvanceError);
  });

  it('PUB never calls reopen — advanceTo only accepts publicado or com_erros', async () => {
    // This is a contract invariant: no `reopen` method exists on the port.
    // Verify at compile-time (no runtime check needed — TypeScript ensures this).
    const port: { advanceTo: unknown; reopen?: unknown } = adapter;
    expect(typeof port.reopen).toBe('undefined');
  });

  it('uses PROJ_SERVICE_BASE_URL from config', async () => {
    const customUrl = 'http://custom-proj:9999';
    const customAdapter = new ProjProjectStatusAdapter(makeConfig(customUrl));
    fetchSpy = mockFetchOnce(200, { projetoId: PROJETO_ID, newStatus: 'publicado', changed: true });

    await customAdapter.advanceTo({ projetoId: PROJETO_ID, targetStatus: 'publicado' }, BEARER);

    expect(fetchSpy.mock.calls[0]![0]).toContain(customUrl);
  });
});
