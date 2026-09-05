/**
 * PubPublicationErasureAdapter — real HTTP adapter for PublicationErasurePort.
 *
 * Calls PUB service's internal erasure endpoint to purge all publication data
 * for a project. Registered under PUBLICATION_ERASURE_PORT when
 * PUB_SERVICE_URL is configured (env-flag switch in erasure-ports.module.ts —
 * PROJ-INT-006).
 *
 * RULE-05: infrastructure must not import modules/.
 * RULE-06: this is the correct place for outbound HTTP clients.
 *
 * Error handling: unlike the P4 read adapters, this adapter MUST NOT degrade
 * silently — an unreachable PUB or a non-2xx response throws, so
 * DeleteProjetoUseCase (PROJ-016) aborts the cascade before COMP/IMP purge
 * and the DB delete run (contract: "falha em PUB nao deleta").
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { PublicationErasurePort } from '../../../domain/proj/ports/outbound/publication-erasure.port';

@Injectable()
export class PubPublicationErasureAdapter implements PublicationErasurePort {
  private readonly logger = new Logger(PubPublicationErasureAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async erase(projetoId: string, empresaId: string): Promise<void> {
    const baseUrl = this.config.get<string>('PUB_SERVICE_URL');
    if (!baseUrl) {
      throw new Error('PUB_SERVICE_URL not configured — cannot purge publications');
    }

    let response: Response;
    try {
      const url = `${baseUrl}/api/v1/pub/projetos/${projetoId}/erasure`;
      response = await fetch(url, {
        method: 'DELETE',
      });
    } catch (err) {
      this.logger.error(
        `PubPublicationErasureAdapter unreachable for projetoId=${projetoId}: ${(err as Error).message}`,
      );
      throw err;
    }

    if (!response.ok) {
      const message = `PUB erasure returned ${response.status} for projetoId=${projetoId}`;
      this.logger.error(message);
      throw new Error(message);
    }

    this.logger.log(`PUB erasure completed for projetoId=${projetoId}`);
  }
}
