/**
 * ImpManuscriptSummaryAdapter — real HTTP adapter for ManuscriptSummaryPort.
 *
 * Calls IMP service's internal batch-query endpoint to retrieve manuscript
 * summaries for a list of project IDs. Registered under MANUSCRIPT_SUMMARY_PORT
 * when the IMP_SERVICE_URL environment variable is set (env-flag switch in
 * proj.module.ts — PROJ-INT-001).
 *
 * RULE-05: infrastructure must not import modules/.
 * RULE-06: this is the correct place for outbound HTTP clients.
 *
 * Error handling: when IMP is unreachable, the adapter returns empty Map
 * and logs WARN. Callers (GetProjetoLibraryUseCase) degrade gracefully.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  ManuscriptSummary,
  ManuscriptSummaryPort,
} from '../../../domain/proj/ports/outbound/manuscript-summary.port';

/**
 * Shape of the response from IMP's batch-query endpoint.
 * Adjust to match IMP's actual contract when IMP is scaffolded.
 */
interface ImpManuscriptResponse {
  projetoId: string;
  totalCapitulos: number;
  totalImagens: number;
}

@Injectable()
export class ImpManuscriptSummaryAdapter implements ManuscriptSummaryPort {
  private readonly logger = new Logger(ImpManuscriptSummaryAdapter.name);

  constructor(private readonly config: ConfigService) {}

  async summaries(
    projetoIds: string[],
    empresaId: string,
  ): Promise<Map<string, ManuscriptSummary>> {
    if (projetoIds.length === 0) {
      return new Map();
    }

    const baseUrl = this.config.get<string>('IMP_SERVICE_URL');
    if (!baseUrl) {
      this.logger.warn('IMP_SERVICE_URL not configured — returning empty summaries');
      return new Map();
    }

    try {
      const url = `${baseUrl}/api/v1/imp/manuscripts/summaries`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Empresa-Id': empresaId,
        },
        body: JSON.stringify({ projetoIds }),
      });

      if (!response.ok) {
        this.logger.warn(
          `IMP manuscript summaries returned ${response.status} — degrading`,
        );
        return new Map();
      }

      const data = (await response.json()) as ImpManuscriptResponse[];
      const result = new Map<string, ManuscriptSummary>();
      for (const item of data) {
        result.set(item.projetoId, {
          totalCapitulos: item.totalCapitulos,
          totalImagens: item.totalImagens,
        });
      }
      return result;
    } catch (err) {
      this.logger.warn(
        `ImpManuscriptSummaryAdapter error — degrading: ${(err as Error).message}`,
      );
      return new Map();
    }
  }
}
