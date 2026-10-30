/**
 * CompositionErasureStub — in-memory fallback adapter for CompositionErasurePort.
 *
 * Registered under COMPOSITION_ERASURE_PORT in P6 (PROJ-015). Replaced by the
 * real HTTP adapter (CompCompositionErasureAdapter) once COMP_SERVICE_URL is
 * configured (PROJ-INT-005).
 *
 * Behaviour: logs WARN and resolves (no-op success) — mirrors
 * PublicationErasureStub so the cascade proceeds when COMP is not yet wired.
 *
 * RULE-05: infrastructure must not import modules/.
 * RULE-06: this file is the stub; the real HTTP client is in infrastructure/proj/erasure/.
 */

import { Logger } from '@nestjs/common';

import type { CompositionErasurePort } from '../../../domain/proj/ports/outbound/composition-erasure.port';

export class CompositionErasureStub implements CompositionErasurePort {
  private readonly logger = new Logger(CompositionErasureStub.name);

  async erase(projetoId: string, empresaId: string, _bearerToken?: string): Promise<void> {
    this.logger.warn(
      `degraded:true port=CompositionErasurePort empresaId=${empresaId} projetoId=${projetoId}`,
    );
  }
}
