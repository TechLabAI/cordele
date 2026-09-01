/**
 * imp-error.mapper.spec.ts — unit tests for the IMP error mapper (FE-IMP-021).
 *
 * Coverage target (SPEC-07 §2):
 *   1. Every known URN maps to the correct channel + message.
 *   2. Unknown URN → generic fallback ('banner', network/5xx message).
 *   3. HTTP status fallbacks (413, 415, 504, 5xx) when no URN present.
 *   4. traceId is present in the return when the response carries it.
 *   5. traceId is taken from body.traceId first, X-Correlation-Id header second.
 */
import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { mapImpError, IMP_KNOWN_URNS } from './imp-error.mapper';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeErr(
  status: number,
  body: Record<string, unknown> = {},
  headers: Record<string, string> = {},
): HttpErrorResponse {
  return new HttpErrorResponse({
    status,
    error: body,
    headers: new HttpHeaders(headers),
    url: '/api/imp/test',
  });
}

// ── URN mapping — all 9 known URNs (SPEC-07 §2) ───────────────────────────────

describe('mapImpError — URN-based mapping', () => {
  it('urn:cordele:imp:unsupported-format → inline channel', () => {
    const result = mapImpError(makeErr(415, { type: 'urn:cordele:imp:unsupported-format' }));
    expect(result.channel).toBe('inline');
    expect(result.message).toContain('.docx');
  });

  it('urn:cordele:imp:file-too-large → inline channel, 50 MB limit mentioned', () => {
    const result = mapImpError(makeErr(413, { type: 'urn:cordele:imp:file-too-large' }));
    expect(result.channel).toBe('inline');
    expect(result.message).toContain('50 MB');
  });

  // FIX(imp-invalid-binding): api-contract uses 'invalid-binding', not 'invalid-project-binding'.
  // Updated to match the corrected URN constant in imp-error.mapper.ts.
  it('urn:cordele:imp:invalid-binding → inline channel', () => {
    const result = mapImpError(
      makeErr(422, { type: 'urn:cordele:imp:invalid-binding' }),
    );
    expect(result.channel).toBe('inline');
    expect(result.message).toContain('projeto');
  });

  it('urn:cordele:imp:projeto-not-found → banner channel', () => {
    const result = mapImpError(
      makeErr(422, { type: 'urn:cordele:imp:projeto-not-found' }),
    );
    expect(result.channel).toBe('banner');
    expect(result.message).toContain('não foi encontrado');
  });

  it('urn:cordele:imp:parse-failed → banner channel', () => {
    const result = mapImpError(makeErr(422, { type: 'urn:cordele:imp:parse-failed' }));
    expect(result.channel).toBe('banner');
    expect(result.message).toContain('Reimportar');
  });

  it('urn:cordele:imp:validation → inline channel', () => {
    const result = mapImpError(makeErr(400, { type: 'urn:cordele:imp:validation' }));
    expect(result.channel).toBe('inline');
    expect(result.message).toContain('inválida');
  });

  it('urn:cordele:imp:unauthorized → banner channel', () => {
    const result = mapImpError(makeErr(401, { type: 'urn:cordele:imp:unauthorized' }));
    expect(result.channel).toBe('banner');
    expect(result.message).toContain('Sessão');
  });

  it('urn:cordele:imp:forbidden → modal channel', () => {
    const result = mapImpError(makeErr(403, { type: 'urn:cordele:imp:forbidden' }));
    expect(result.channel).toBe('modal');
    expect(result.message).toContain('permissão');
  });

  it('urn:cordele:imp:not-found → banner channel', () => {
    const result = mapImpError(makeErr(404, { type: 'urn:cordele:imp:not-found' }));
    expect(result.channel).toBe('banner');
    expect(result.message).toContain('não encontrado');
  });

  it('IMP_KNOWN_URNS contains exactly 9 URNs (SPEC-07 §2 completeness)', () => {
    expect(IMP_KNOWN_URNS).toHaveLength(9);
    // Every URN in the list must produce a non-fallback message
    for (const urn of IMP_KNOWN_URNS) {
      const result = mapImpError(makeErr(400, { type: urn }));
      expect(result.message).not.toBe('Falha temporária. Tente novamente em instantes.');
    }
  });
});

// ── HTTP status fallbacks (no URN in body) ────────────────────────────────────

describe('mapImpError — HTTP status fallbacks', () => {
  it('413 without URN → inline, 50 MB message', () => {
    const result = mapImpError(makeErr(413, {}));
    expect(result.channel).toBe('inline');
    expect(result.message).toContain('50 MB');
  });

  it('415 without URN → inline, format message', () => {
    const result = mapImpError(makeErr(415, {}));
    expect(result.channel).toBe('inline');
    expect(result.message).toContain('.docx');
  });

  it('504 (timeout) without URN → banner, timeout message', () => {
    const result = mapImpError(makeErr(504, {}));
    expect(result.channel).toBe('banner');
    expect(result.message).toContain('demorou');
  });

  it('status 0 (network/client timeout) → banner', () => {
    const result = mapImpError(makeErr(0, {}));
    expect(result.channel).toBe('banner');
    expect(result.message).toContain('demorou');
  });

  it('500 (server error) without URN → banner, "Falha temporária"', () => {
    const result = mapImpError(makeErr(500, {}));
    expect(result.channel).toBe('banner');
    expect(result.message).toContain('Falha temporária');
  });

  it('403 without URN → modal, permission message', () => {
    const result = mapImpError(makeErr(403, {}));
    expect(result.channel).toBe('modal');
    expect(result.message).toContain('permissão');
  });

  it('404 without URN → banner, not-found message', () => {
    const result = mapImpError(makeErr(404, {}));
    expect(result.channel).toBe('banner');
    expect(result.message).toContain('não encontrado');
  });
});

// ── Unknown URN → generic fallback ───────────────────────────────────────────

describe('mapImpError — unknown/missing URN', () => {
  it('unknown URN falls through to HTTP status fallback, then generic', () => {
    const result = mapImpError(makeErr(418, { type: 'urn:cordele:imp:teapot' }));
    // 418 is not in the status map → generic fallback
    expect(result.channel).toBe('banner');
    expect(result.message).toContain('Falha temporária');
  });

  it('empty error body with unknown status → generic fallback', () => {
    const result = mapImpError(makeErr(418, {}));
    expect(result.channel).toBe('banner');
    expect(result.message).toBe('Falha temporária. Tente novamente em instantes.');
  });
});

// ── traceId extraction (SPEC-07 §4 "attach traceId") ─────────────────────────

describe('mapImpError — traceId', () => {
  it('returns traceId from body.traceId when present', () => {
    const result = mapImpError(
      makeErr(422, { type: 'urn:cordele:imp:parse-failed', traceId: 'trace-abc-123' }),
    );
    expect(result.traceId).toBe('trace-abc-123');
  });

  it('falls back to X-Correlation-Id header when body has no traceId', () => {
    const result = mapImpError(
      makeErr(500, {}, { 'X-Correlation-Id': 'corr-xyz-456' }),
    );
    expect(result.traceId).toBe('corr-xyz-456');
  });

  it('prefers body.traceId over header when both are present', () => {
    const result = mapImpError(
      makeErr(
        500,
        { traceId: 'body-trace' },
        { 'X-Correlation-Id': 'header-trace' },
      ),
    );
    expect(result.traceId).toBe('body-trace');
  });

  it('traceId is undefined when neither body nor header carries it', () => {
    const result = mapImpError(makeErr(500, {}));
    expect(result.traceId).toBeUndefined();
  });
});
