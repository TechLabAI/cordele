/**
 * PublicationErasureStub — in-memory fallback adapter for PublicationErasurePort.
 *
 * Registered under PUBLICATION_ERASURE_PORT in P6 (PROJ-015). Replaced by the
 * real HTTP adapter (PubPublicationErasureAdapter) once PUB_SERVICE_URL is
 * configured (PROJ-INT-006).
 *
 * Behaviour: logs WARN and resolves (no-op success) — there is no local data
 * to purge when PUB is not wired, so the cascade proceeds instead of failing
 * the whole delete for a sibling that is not yet deployed.
 *
 * RULE-05: infrastructure must not import modules/.
 * RULE-06: this file is the stub; the real HTTP client is in infrastructure/proj/erasure/.
 */

import { Logger } from '@nestjs/common';

import type { PublicationErasurePort } from '../../../domain/proj/ports/outbound/publication-erasure.port';

export class PublicationErasureStub implements PublicationErasurePort {
  private readonly logger = new Logger(PublicationErasureStub.name);

  async erase(projetoId: string, empresaId: string, _bearerToken?: string): Promise<void> {
    this.logger.warn(
      `degraded:true port=PublicationErasurePort empresaId=${empresaId} projetoId=${projetoId}`,
    );
  }
}
