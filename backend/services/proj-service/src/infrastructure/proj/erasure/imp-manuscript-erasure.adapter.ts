/**
 * ImpManuscriptErasureAdapter — real HTTP adapter for ManuscriptErasurePort.
 *
 * Calls IMP service's internal erasure endpoint to purge all manuscript data
 * for a project. Registered under MANUSCRIPT_ERASURE_PORT when
 * IMP_SERVICE_URL is configured (env-flag switch in erasure-ports.module.ts —
 * PROJ-INT-004).
 *
 * RULE-05: infrastructure must not import modules/.
 * RULE-06: this is the correct place for outbound HTTP clients.
 *
 * Error handling: must not degrade silently — an unreachable IMP or a
 * non-2xx response throws, so DeleteProjetoUseCase (PROJ-016) aborts the
 * cascade before the DB delete runs (this is the last leaf before step 4).
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { ManuscriptErasurePort } from '../../../domain/proj/ports/outbound/manuscript-erasure.port';

@Injectable()
export class ImpManuscriptErasureAdapter implements ManuscriptErasurePort {
  private readonly logger = new Logger(ImpManuscriptErasureAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async erase(projetoId: string, empresaId: string, bearerToken?: string): Promise<void> {
    const baseUrl = this.config.get<string>('IMP_SERVICE_URL');
    if (!baseUrl) {
      throw new Error('IMP_SERVICE_URL not configured — cannot purge manuscript data');
    }

    const headers: Record<string, string> = {};
    if (bearerToken) {
      headers['Authorization'] = `Bearer ${bearerToken}`;
      this.logger.debug('ImpManuscriptErasureAdapter: Authorization header mounted');
    }

    let response: Response;
    try {
      const url = `${baseUrl}/api/v1/imp/projetos/${projetoId}/erasure`;
      response = await fetch(url, {
        method: 'DELETE',
        headers,
      });
    } catch (err) {
      this.logger.error(
        `ImpManuscriptErasureAdapter unreachable for projetoId=${projetoId}: ${(err as Error).message}`,
      );
      throw err;
    }

    if (!response.ok) {
      const message = `IMP erasure returned ${response.status} for projetoId=${projetoId}`;
      this.logger.error(message);
      throw new Error(message);
    }

    this.logger.log(`IMP erasure completed for projetoId=${projetoId}`);
  }
}
