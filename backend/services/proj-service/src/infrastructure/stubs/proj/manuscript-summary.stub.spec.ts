/**
 * Unit spec for ManuscriptSummaryStub (PROJ-017 observability assertion).
 *
 * Verified behaviours:
 *  1. summaries() called with an empty array returns an empty Map — no log emitted.
 *  2. summaries() called with non-empty ids returns a populated Map (default zeros).
 *  3. summaries() in degraded mode (non-empty ids) emits logger.warn() with a
 *     message containing 'degraded:true' and 'port=ManuscriptSummaryPort'
 *     (verifiable via Logger spy — satisfies PROJ-017 observability criterion).
 *
 * Note on correlationId: the ManuscriptSummaryPort interface only receives
 * projetoIds and empresaId; correlationId propagation into the stub log requires
 * a shared AsyncLocalStorage store (deferred — out of scope for PROJ-017 unit
 * tests; integration coverage would wire the CorrelationIdInterceptor context).
 */

import { Logger } from '@nestjs/common';

import { ManuscriptSummaryStub } from './manuscript-summary.stub';

const EMPRESA_ID = 'empresa-id-aetos';

describe('ManuscriptSummaryStub — observability (PROJ-017)', () => {
  let stub: ManuscriptSummaryStub;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    stub = new ManuscriptSummaryStub();
    // Spy on ALL instances of Logger via the prototype.
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns empty Map and does NOT warn when projetoIds is empty', async () => {
    const result = await stub.summaries([], EMPRESA_ID);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('returns a Map with default zero summaries for each projetoId', async () => {
    const ids = ['proj-1', 'proj-2'];
    const result = await stub.summaries(ids, EMPRESA_ID);

    expect(result.size).toBe(2);
    expect(result.get('proj-1')).toEqual({ totalCapitulos: 0, totalImagens: 0 });
    expect(result.get('proj-2')).toEqual({ totalCapitulos: 0, totalImagens: 0 });
  });

  it('emits logger.warn with degraded:true and port=ManuscriptSummaryPort when called with non-empty ids', async () => {
    await stub.summaries(['proj-id-1'], EMPRESA_ID);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [warnMessage] = warnSpy.mock.calls[0] as [string];
    expect(warnMessage).toContain('degraded:true');
    expect(warnMessage).toContain('port=ManuscriptSummaryPort');
  });

  it('includes empresaId in the warn message for traceability', async () => {
    await stub.summaries(['proj-id-1'], EMPRESA_ID);

    const [warnMessage] = warnSpy.mock.calls[0] as [string];
    expect(warnMessage).toContain(`empresaId=${EMPRESA_ID}`);
  });
});
