/**
 * CompCompositionErasureAdapter — real HTTP adapter for CompositionErasurePort.
 *
 * Calls COMP service's internal erasure endpoint to purge all composition
 * data for a project. Registered under COMPOSITION_ERASURE_PORT when
 * COMP_SERVICE_URL is configured (env-flag switch in erasure-ports.module.ts —
 * PROJ-INT-005).
 *
 * RULE-05: infrastructure must not import modules/.
 * RULE-06: this is the correct place for outbound HTTP clients.
 *
 * Error handling: must not degrade silently — an unreachable COMP or a
 * non-2xx response throws, so DeleteProjetoUseCase (PROJ-016) aborts the
 * cascade before IMP purge and the DB delete run.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { CompositionErasurePort } from '../../../domain/proj/ports/outbound/composition-erasure.port';

@Injectable()
export class CompCompositionErasureAdapter implements CompositionErasurePort {
  private readonly logger = new Logger(CompCompositionErasureAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async erase(projetoId: string, empresaId: string): Promise<void> {
    const baseUrl = this.config.get<string>('COMP_SERVICE_URL');
    if (!baseUrl) {
      throw new Error('COMP_SERVICE_URL not configured — cannot purge composition data');
    }

    let response: Response;
    try {
      const url = `${baseUrl}/api/v1/comp/projetos/${projetoId}/erasure`;
      response = await fetch(url, {
        method: 'DELETE',
        headers: { 'X-Empresa-Id': empresaId },
      });
    } catch (err) {
      this.logger.error(
        `CompCompositionErasureAdapter unreachable for projetoId=${projetoId}: ${(err as Error).message}`,
      );
      throw err;
    }

    if (!response.ok) {
      const message = `COMP erasure returned ${response.status} for projetoId=${projetoId}`;
      this.logger.error(message);
      throw new Error(message);
    }

    this.logger.log(`COMP erasure completed for projetoId=${projetoId}`);
  }
}
