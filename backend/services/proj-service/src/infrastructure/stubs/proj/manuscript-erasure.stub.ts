/**
 * ManuscriptErasureStub — in-memory fallback adapter for ManuscriptErasurePort.
 *
 * Registered under MANUSCRIPT_ERASURE_PORT in P6 (PROJ-015). Replaced by the
 * real HTTP adapter (ImpManuscriptErasureAdapter) once IMP_SERVICE_URL is
 * configured (PROJ-INT-004).
 *
 * Behaviour: logs WARN and resolves (no-op success) — mirrors
 * PublicationErasureStub so the cascade proceeds when IMP is not yet wired.
 *
 * RULE-05: infrastructure must not import modules/.
 * RULE-06: this file is the stub; the real HTTP client is in infrastructure/proj/erasure/.
 */

import { Logger } from '@nestjs/common';

import type { ManuscriptErasurePort } from '../../../domain/proj/ports/outbound/manuscript-erasure.port';

export class ManuscriptErasureStub implements ManuscriptErasurePort {
  private readonly logger = new Logger(ManuscriptErasureStub.name);

  async erase(projetoId: string, empresaId: string, _bearerToken?: string): Promise<void> {
    this.logger.warn(
      `degraded:true port=ManuscriptErasurePort empresaId=${empresaId} projetoId=${projetoId}`,
    );
  }
}
