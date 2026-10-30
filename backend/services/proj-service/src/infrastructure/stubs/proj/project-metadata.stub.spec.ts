/**
 * Unit spec for ProjectMetadataStub (PROJ-009).
 *
 * Verified behaviours:
 *  1. metadata([]) returns empty Map and does NOT warn (safe zero-project path).
 *  2. metadata([id1, id2]) returns a Map with default { autor: null } entries.
 *  3. metadata() with non-empty ids logs WARN with 'degraded:true' and
 *     'port=ProjectMetadataPort' (verifiable via Logger spy — PROJ-009 criterion).
 *  4. Integration tests can override this stub via overrideProvider: stub is
 *     exported as a class so NestJS testing module can replace it under the token.
 *
 * RULE-05: infrastructure spec, does not import from modules/.
 */

import { Logger } from '@nestjs/common';

import { ProjectMetadataStub } from './project-metadata.stub';

const EMPRESA_ID = 'empresa-id-aetos';

describe('ProjectMetadataStub — compile + degraded log (PROJ-009)', () => {
  let stub: ProjectMetadataStub;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    stub = new ProjectMetadataStub();
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Empty array path — safe, no log
  // ---------------------------------------------------------------------------

  it('returns empty Map and does NOT warn when projetoIds is empty', async () => {
    const result = await stub.metadata([], EMPRESA_ID);

    expect(result).toBeInstanceOf(Map);
    expect(result.size).toBe(0);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  // ---------------------------------------------------------------------------
  // Non-empty array — returns defaults and logs
  // ---------------------------------------------------------------------------

  it('returns a Map with default { autor: null } for each projetoId', async () => {
    const ids = ['proj-1', 'proj-2'];
    const result = await stub.metadata(ids, EMPRESA_ID);

    expect(result.size).toBe(2);
    expect(result.get('proj-1')).toEqual({ autor: null });
    expect(result.get('proj-2')).toEqual({ autor: null });
  });

  it('emits logger.warn with degraded:true when called with non-empty ids', async () => {
    await stub.metadata(['proj-id-1'], EMPRESA_ID);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    const [warnMessage] = warnSpy.mock.calls[0] as [string];
    expect(warnMessage).toContain('degraded:true');
    expect(warnMessage).toContain('port=ProjectMetadataPort');
  });

  it('includes empresaId in the warn message for traceability', async () => {
    await stub.metadata(['proj-id-1'], EMPRESA_ID);

    const [warnMessage] = warnSpy.mock.calls[0] as [string];
    expect(warnMessage).toContain(`empresaId=${EMPRESA_ID}`);
  });

  // ---------------------------------------------------------------------------
  // Implements clause — TypeScript compiles with the interface (PROJ-009)
  // ---------------------------------------------------------------------------

  it('implements ProjectMetadataPort interface (summaries returns Map)', async () => {
    // If the class does not implement the interface, tsc --noEmit fails at build time.
    // This runtime check verifies the contract shape is correct.
    const result = await stub.metadata(['x'], EMPRESA_ID);
    expect(result).toBeInstanceOf(Map);
  });
});
