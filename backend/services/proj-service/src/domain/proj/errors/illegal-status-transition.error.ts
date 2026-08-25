/**
 * Thrown when a status transition is attempted that is not in the
 * legal-transition table defined in api-contract §7.
 *
 * Pure domain error — no @nestjs/* or @prisma/client imports (RULE-01 / RULE-02).
 * REST callers map this to 409 urn:cordele:proj:illegal-status-transition.
 */
export class IllegalStatusTransitionError extends Error {
  /** Status the aggregate was in when the transition was requested. */
  readonly from: string;
  /** Status that was requested but is not reachable from `from`. */
  readonly to: string;
  /** Human-readable explanation. */
  readonly reason: string;

  constructor(from: string, to: string, reason: string) {
    super(`Illegal project status transition: ${from} → ${to}. ${reason}`);
    this.name = 'IllegalStatusTransitionError';
    this.from = from;
    this.to = to;
    this.reason = reason;
    // Restore prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
