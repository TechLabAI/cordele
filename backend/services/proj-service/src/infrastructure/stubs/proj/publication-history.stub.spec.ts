/**
 * Unit spec for PublicationHistoryStub (PROJ-009).
 *
 * Verified behaviours:
 *  1. latest([]) returns empty Map and does NOT warn.
 *  2. latest([id1]) returns empty Map and logs WARN with 'degraded:true'.
 *  3. history(projetoId) returns empty array and logs WARN with 'degraded:true'.
 *  4. signedDownloadUrl() returns { arquivoUrl, expiresAt } — never throws.
 *  5. Each method logs 'port=PublicationHistoryPort' for observability.
 *
 * RULE-05: infrastructure spec, does not import from modules/.
 */

import { Logger } from '@nestjs/common';

import { PublicationHistoryStub } from './publication-history.stub';

const EMPRESA_ID = 'empresa-id-aetos';
const PROJETO_ID = 'proj-uuid-001';

describe('PublicationHistoryStub — compile + degraded log (PROJ-009)', () => {
  let stub: PublicationHistoryStub;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    stub = new PublicationHistoryStub();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // latest() — empty array path
  // ---------------------------------------------------------------------------

  it('latest([]) returns empty Map and does NOT warn when projetoIds is empty', async () => {
    const result = await stub.latest([], EMPRESA_ID);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // latest() — non-empty array
  // ---------------------------------------------------------------------------

  it('latest([id1]) returns empty Map and logs degraded WARN', async () => {
    const result = await stub.latest([PROJETO_ID], EMPRESA_ID);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0); // stub: no publications available
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [warnMessage] = warnSpy.mock.calls[0] as [string];
    expect(warnMessage).toContain('degraded:true');
    expect(warnMessage).toContain('port=PublicationHistoryPort');
  });

  // ---------------------------------------------------------------------------
  // history()
  // ---------------------------------------------------------------------------

  it('history() returns empty array', async () => {
    const result = await stub.history(PROJETO_ID, EMPRESA_ID);

    expect(Array.isArray(result)).toBe(true);
    expect(result).toHaveLength(0);
  });

  it('history() logs degraded WARN on every call', async () => {
    await stub.history(PROJETO_ID, EMPRESA_ID);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [warnMessage] = warnSpy.mock.calls[0] as [string];
    expect(warnMessage).toContain('degraded:true');
    expect(warnMessage).toContain('port=PublicationHistoryPort');
  });

  // ---------------------------------------------------------------------------
  // signedDownloadUrl() — never throws, returns stub URL
  // ---------------------------------------------------------------------------

  it('signedDownloadUrl() returns arquivoUrl and expiresAt without throwing', async () => {
    const result = await stub.signedDownloadUrl('pub-uuid-001', 'proj-uuid-test', EMPRESA_ID);

    expect(result).toHaveProperty('arquivoUrl');
    expect(result).toHaveProperty('expiresAt');
    expect(typeof result.arquivoUrl).toBe('string');
    expect(typeof result.expiresAt).toBe('string');
  });

  it('signedDownloadUrl() logs degraded WARN with publicacaoId', async () => {
    await stub.signedDownloadUrl('pub-uuid-001', 'proj-uuid-test', EMPRESA_ID);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [warnMessage] = warnSpy.mock.calls[0] as [string];
    expect(warnMessage).toContain('degraded:true');
    expect(warnMessage).toContain('port=PublicationHistoryPort');
  });

  // ---------------------------------------------------------------------------
  // Interface compliance — TypeScript compiles with implements clause (PROJ-009)
  // ---------------------------------------------------------------------------

  it('implements PublicationHistoryPort interface (latest returns Map)', async () => {
    const result = await stub.latest([PROJETO_ID], EMPRESA_ID);
    expect(result).toBeInstanceOf(Map);
  });
});
