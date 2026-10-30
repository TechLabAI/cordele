// @cordele/shared/error-model — extended in the implement cycle (FE-COMP-010).
// Covers RFC 7807 ProblemDetail fields normalised by the ErrorNormalize interceptor.
export interface AppError {
  readonly code: string;
  readonly message: string;
  /** HTTP status code, when available. */
  readonly httpStatus?: number;
  /** `title` from RFC 7807 ProblemDetail. */
  readonly title?: string;
  /** `detail` from RFC 7807 ProblemDetail. */
  readonly detail?: string;
  /** Mirrors X-Correlation-Id; displayed to the user for support reference. */
  readonly correlationId?: string;
}
