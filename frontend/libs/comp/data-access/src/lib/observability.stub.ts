/**
 * observability.stub.ts — local ObservabilityService stub for COMP module.
 * FE-COMP-025 / P9.
 *
 * Used while @cordele/shared/observability (Wave-0, D-328/FE-4) does not yet
 * export an injectable ObservabilityService. This stub fulfils the interface so
 * the tracking points compile and link; the real service can be swapped in by
 * updating the import path once the shared lib provides it.
 *
 * TODO: substituir por @cordele/shared/observability quando disponível.
 */
import { Injectable } from '@angular/core';

export const OBSERVABILITY_IS_MOCK = true;

export interface ObservabilityEvent {
  name: string;
  projetoId: string;
  correlationId?: string;
  timestamp: string;
}

@Injectable({ providedIn: 'root' })
export class ObservabilityService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  track(event: ObservabilityEvent): void {
    if (OBSERVABILITY_IS_MOCK) {
      // Stub: emit to debug channel only — not sent to any backend.
      // Replace with real sink when @cordele/shared/observability ships ObservabilityService.
      // eslint-disable-next-line no-console
      console.debug('[COMP telemetry]', event.name, {
        projetoId: event.projetoId,
        correlationId: event.correlationId,
        timestamp: event.timestamp,
      });
    }
  }
}
