// @cordele/shared/observability — Wave-0 stub (D-328/FE-4); flesh out in the implement cycle.
// FE-PUB-026 (P8): ObservabilityService added as injectable no-op stub.

import { Injectable } from '@angular/core';

/** Telemetry port — implemented by ObservabilityService. */
export interface Telemetry {
  event(name: string, data?: Record<string, string>): void;
}

/**
 * ObservabilityService — injectable stub for telemetry events (FE-PUB-026).
 *
 * This is a no-op stub by design: the real telemetry backend (e.g. OpenTelemetry,
 * Datadog RUM, or a custom sink) is wired in a future iteration. The stub allows
 * call-sites to be established now without coupling to any specific backend.
 *
 * Rules:
 *   - No console.log / console.debug — arch-conformance gate blocks them.
 *   - No side-effects in the stub body.
 *   - Verifiable by unit-test spies: callers can spy on event() to assert payload.
 */
@Injectable({ providedIn: 'root' })
export class ObservabilityService implements Telemetry {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  event(_name: string, _data?: Record<string, string>): void {
    // Intentional no-op stub.
    // Real implementation added when telemetry backend is wired (P-future).
  }
}
