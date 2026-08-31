/**
 * comp-error.mapper.ts — maps AppError (normalized by ErrorNormalize interceptor) to COMP UI error state.
 * FE-COMP-010 / SPEC-07 §1–§4.
 *
 * This module covers two concerns:
 *   1. normalizeError(err) — converts Angular HttpErrorResponse or AppError to AppError
 *      (transition helper until @cordele/shared/access-http-base provides ErrorNormalize interceptor).
 *   2. mapCompError(appErr) — maps AppError.code URN to CompUiError { channel, message, correlationId }.
 *
 * URNs (9 total, api-contract §5 / SPEC-07 §1):
 *   urn:cordele:comp:validation                (400) → inline field errors
 *   urn:cordele:comp:unauthorized              (401) → session expired (handled by shell)
 *   urn:cordele:comp:forbidden                 (403) → access-denied banner
 *   urn:cordele:comp:projeto-not-found         (404) → route to not-found
 *   urn:cordele:comp:manuscript-missing        (409) → preview empty state
 *   urn:cordele:comp:cover-too-large           (413) → inline drop-zone error
 *   urn:cordele:comp:unsupported-cover-format  (415) → inline drop-zone error
 *   urn:cordele:comp:override-ref-not-found    (422) → defensive toast
 *   urn:cordele:comp:structural-edit-deferred  (422) → defensive toast (unreachable by construction)
 *
 * NOTE: urn:cordele:comp:illegal-status does NOT exist (api-contract §5 / SPEC-07 §2);
 *       the em_composicao gate is handled by compStatusGuard (FE-COMP-020).
 *
 * NOTE: AppError is defined locally here (not imported from @cordele/shared/error-model) because
 * comp is a buildable lib and error-model is non-buildable (@nx/enforce-module-boundaries).
 * When error-model is made buildable, replace the local definition with the shared import.
 */

// ── AppError (local definition) ───────────────────────────────────────────────
// Mirrors @cordele/shared/error-model AppError. Replace with shared import when
// error-model is made buildable (enforceBuildableLibDependency).

export interface AppError {
  readonly code: string;
  readonly message: string;
  readonly httpStatus?: number;
  readonly title?: string;
  readonly detail?: string;
  /** Mirrors X-Correlation-Id; displayed to the user for support reference. */
  readonly correlationId?: string;
}

// ── UI Error types ────────────────────────────────────────────────────────────

/**
 * Channel determines WHERE the error is surfaced:
 *   inline-field       → per-field validation messages in the form
 *   session-expired    → redirect to login (shell-handled)
 *   access-denied      → banner replacing content area
 *   not-found          → route-level "Projeto não encontrado" state
 *   empty-state        → in-content empty state (preview has no manuscript)
 *   cover-inline       → inline error below the cover drop zone
 *   toast              → transient dismissible notification (defensive paths)
 *   error-state        → full-page error state with "Tentar novamente"
 */
export type CompUiErrorChannel =
  | 'inline-field'
  | 'session-expired'
  | 'access-denied'
  | 'not-found'
  | 'empty-state'
  | 'cover-inline'
  | 'toast'
  | 'error-state';

export interface CompUiError {
  /** The URN from the BE ProblemDetail `type` field. */
  readonly code: string;
  readonly channel: CompUiErrorChannel;
  /** Translated message to display to the user (pt-BR). */
  readonly message: string;
  /** correlationId from X-Correlation-Id header; include in support interactions. */
  readonly correlationId: string | null;
}

// ── URN constants ─────────────────────────────────────────────────────────────

export const COMP_URNS = {
  validation:              'urn:cordele:comp:validation',
  unauthorized:            'urn:cordele:comp:unauthorized',
  forbidden:               'urn:cordele:comp:forbidden',
  projetoNotFound:         'urn:cordele:comp:projeto-not-found',
  manuscriptMissing:       'urn:cordele:comp:manuscript-missing',
  coverTooLarge:           'urn:cordele:comp:cover-too-large',
  unsupportedCoverFormat:  'urn:cordele:comp:unsupported-cover-format',
  overrideRefNotFound:     'urn:cordele:comp:override-ref-not-found',
  structuralEditDeferred:  'urn:cordele:comp:structural-edit-deferred',
} as const;

// ── Error normalization ───────────────────────────────────────────────────────

/** Shape of Angular's HttpErrorResponse (typed loosely to avoid angular/http dependency in this file). */
interface HttpLike {
  status?: number;
  error?: {
    type?: string;
    title?: string;
    detail?: string;
    traceId?: string;
  };
  message?: string;
}

/**
 * Converts an unknown caught error to `AppError`.
 * Handles:
 *   - Already-normalized AppError (pass-through when `code` is present)
 *   - Angular HttpErrorResponse carrying RFC 7807 ProblemDetail body
 *   - Generic errors
 * This helper will become a thin wrapper once the ErrorNormalize interceptor
 * in `@cordele/shared/access-http-base` is fully implemented (INT-FE-COMP-001).
 */
export function normalizeError(err: unknown): AppError {
  // Already an AppError
  if (err !== null && typeof err === 'object' && 'code' in err && typeof (err as AppError).code === 'string') {
    return err as AppError;
  }

  const httpErr = err as HttpLike;
  const problemType = httpErr?.error?.type;

  // Derive URN from the ProblemDetail `type` field if present; fall back to HTTP status.
  const code = problemType ?? deriveUrnFromStatus(httpErr?.status ?? 0);

  return {
    code,
    message: httpErr?.error?.detail ?? httpErr?.message ?? 'Ocorreu um erro inesperado.',
    httpStatus:      httpErr?.status,
    title:           httpErr?.error?.title,
    detail:          httpErr?.error?.detail,
    correlationId:   httpErr?.error?.traceId,
  };
}

function deriveUrnFromStatus(status: number): string {
  switch (status) {
    case 400: return COMP_URNS.validation;
    case 401: return COMP_URNS.unauthorized;
    case 403: return COMP_URNS.forbidden;
    case 404: return COMP_URNS.projetoNotFound;
    case 409: return COMP_URNS.manuscriptMissing;
    case 413: return COMP_URNS.coverTooLarge;
    case 415: return COMP_URNS.unsupportedCoverFormat;
    case 422: return COMP_URNS.overrideRefNotFound;  // default for 422
    default:  return `urn:cordele:comp:unknown-${status}`;
  }
}

// ── Error mapping ─────────────────────────────────────────────────────────────

/**
 * Maps a normalized `AppError` to a `CompUiError` that facades expose to templates.
 * The switch is exhaustive over the 9 URNs defined in api-contract §5 / SPEC-07 §1.
 */
export function mapCompError(err: AppError): CompUiError {
  const correlationId = err.correlationId ?? null;

  switch (err.code) {
    case COMP_URNS.validation:
      return {
        code: err.code,
        channel: 'inline-field',
        message: 'Verifique os campos destacados.',
        correlationId,
      };

    case COMP_URNS.unauthorized:
      return {
        code: err.code,
        channel: 'session-expired',
        message: '',   // shell handles redirect to login; no visible message needed
        correlationId,
      };

    case COMP_URNS.forbidden:
      return {
        code: err.code,
        channel: 'access-denied',
        message: 'Você não tem permissão para editar esta composição.',
        correlationId,
      };

    case COMP_URNS.projetoNotFound:
      return {
        code: err.code,
        channel: 'not-found',
        message: 'Projeto não encontrado.',
        correlationId,
      };

    case COMP_URNS.manuscriptMissing:
      return {
        code: err.code,
        channel: 'empty-state',
        message: 'Ainda não há manuscrito para pré-visualizar.',
        correlationId,
      };

    case COMP_URNS.coverTooLarge:
      return {
        code: err.code,
        channel: 'cover-inline',
        message: 'A capa excede 10 MB.',
        correlationId,
      };

    case COMP_URNS.unsupportedCoverFormat:
      return {
        code: err.code,
        channel: 'cover-inline',
        message: 'Formato inválido. Use JPEG, PNG ou WebP.',
        correlationId,
      };

    case COMP_URNS.overrideRefNotFound:
      return {
        code: err.code,
        channel: 'toast',
        message: 'Uma imagem referenciada mudou. Revise o layout.',
        correlationId,
      };

    case COMP_URNS.structuralEditDeferred:
      // Defensive: unreachable by construction (toolbar is alignment-only, FE never emits tipo='em-branco').
      return {
        code: err.code,
        channel: 'toast',
        message: 'Edição estrutural indisponível nesta versão.',
        correlationId,
      };

    default:
      // 5xx / network or any unrecognised code → full-page error state
      return {
        code: err.code,
        channel: 'error-state',
        message: 'Não foi possível carregar. Tente novamente.',
        correlationId,
      };
  }
}
