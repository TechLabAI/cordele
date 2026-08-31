/**
 * comp-error.mapper.spec.ts — unit tests for mapCompError and normalizeError.
 * FE-COMP-010: 9 URNs, correlationId propagation, normalizeError HTTP→AppError.
 */
import { describe, it, expect } from 'vitest';
import { mapCompError, normalizeError, COMP_URNS } from './comp-error.mapper';
import type { AppError } from './comp-error.mapper';

// ── mapCompError ──────────────────────────────────────────────────────────────

describe('mapCompError', () => {
  const corrId = 'corr-abc-123';

  it('validation (400) → inline-field channel', () => {
    const err: AppError = { code: COMP_URNS.validation, message: '', correlationId: corrId };
    const result = mapCompError(err);
    expect(result.channel).toBe('inline-field');
    expect(result.correlationId).toBe(corrId);
    expect(result.message).toBeTruthy();
  });

  it('unauthorized (401) → session-expired channel', () => {
    const err: AppError = { code: COMP_URNS.unauthorized, message: '' };
    const result = mapCompError(err);
    expect(result.channel).toBe('session-expired');
    expect(result.correlationId).toBeNull();
  });

  it('forbidden (403) → access-denied channel with pt-BR message', () => {
    const err: AppError = { code: COMP_URNS.forbidden, message: '', correlationId: corrId };
    const result = mapCompError(err);
    expect(result.channel).toBe('access-denied');
    expect(result.message).toContain('permissão');
    expect(result.correlationId).toBe(corrId);
  });

  it('projeto-not-found (404) → not-found channel', () => {
    const err: AppError = { code: COMP_URNS.projetoNotFound, message: '', correlationId: corrId };
    const result = mapCompError(err);
    expect(result.channel).toBe('not-found');
    expect(result.message).toContain('encontrado');
  });

  it('manuscript-missing (409) → empty-state channel with pt-BR message', () => {
    const err: AppError = { code: COMP_URNS.manuscriptMissing, message: '', correlationId: corrId };
    const result = mapCompError(err);
    expect(result.channel).toBe('empty-state');
    expect(result.message).toContain('manuscrito');
  });

  it('cover-too-large (413) → cover-inline channel with size message', () => {
    const err: AppError = { code: COMP_URNS.coverTooLarge, message: '', correlationId: corrId };
    const result = mapCompError(err);
    expect(result.channel).toBe('cover-inline');
    expect(result.message).toContain('10 MB');
  });

  it('unsupported-cover-format (415) → cover-inline channel with format message', () => {
    const err: AppError = { code: COMP_URNS.unsupportedCoverFormat, message: '', correlationId: corrId };
    const result = mapCompError(err);
    expect(result.channel).toBe('cover-inline');
    expect(result.message).toContain('JPEG');
  });

  it('override-ref-not-found (422) → toast channel', () => {
    const err: AppError = { code: COMP_URNS.overrideRefNotFound, message: '', correlationId: corrId };
    const result = mapCompError(err);
    expect(result.channel).toBe('toast');
    expect(result.correlationId).toBe(corrId);
  });

  it('structural-edit-deferred (422 defensive) → toast channel', () => {
    const err: AppError = { code: COMP_URNS.structuralEditDeferred, message: '' };
    const result = mapCompError(err);
    expect(result.channel).toBe('toast');
    expect(result.message).toContain('Edição estrutural');
  });

  it('unknown code → error-state channel', () => {
    const err: AppError = { code: 'urn:cordele:comp:unknown-500', message: '' };
    const result = mapCompError(err);
    expect(result.channel).toBe('error-state');
  });

  it('illegal-status does NOT exist — not mapped', () => {
    // api-contract §5 / SPEC-07 §2: urn:cordele:comp:illegal-status was removed.
    const err: AppError = { code: 'urn:cordele:comp:illegal-status', message: '' };
    const result = mapCompError(err);
    // Falls through to default (error-state) — no dedicated mapping
    expect(result.channel).toBe('error-state');
  });
});

// ── normalizeError ────────────────────────────────────────────────────────────

describe('normalizeError', () => {
  it('passes through an existing AppError unchanged', () => {
    const err: AppError = {
      code: COMP_URNS.validation,
      message: 'Validation failed',
      correlationId: 'corr-xyz',
    };
    const result = normalizeError(err);
    expect(result.code).toBe(COMP_URNS.validation);
    expect(result.correlationId).toBe('corr-xyz');
  });

  it('converts HttpErrorResponse with ProblemDetail body to AppError', () => {
    const httpErr = {
      status: 409,
      error: {
        type: COMP_URNS.manuscriptMissing,
        title: 'Manuscript missing',
        detail: 'No manuscript found',
        traceId: 'trace-001',
      },
      message: 'Http failure',
    };
    const result = normalizeError(httpErr);
    expect(result.code).toBe(COMP_URNS.manuscriptMissing);
    expect(result.correlationId).toBe('trace-001');
    expect(result.httpStatus).toBe(409);
  });

  it('derives URN from HTTP 413 status when ProblemDetail type is absent', () => {
    const httpErr = { status: 413, error: {}, message: 'Payload too large' };
    const result = normalizeError(httpErr);
    expect(result.code).toBe(COMP_URNS.coverTooLarge);
    expect(result.httpStatus).toBe(413);
  });

  it('derives URN from HTTP 415 status', () => {
    const httpErr = { status: 415, error: {}, message: 'Unsupported media type' };
    const result = normalizeError(httpErr);
    expect(result.code).toBe(COMP_URNS.unsupportedCoverFormat);
  });

  it('derives URN from HTTP 404 status', () => {
    const httpErr = { status: 404, error: {}, message: 'Not found' };
    const result = normalizeError(httpErr);
    expect(result.code).toBe(COMP_URNS.projetoNotFound);
  });
});
