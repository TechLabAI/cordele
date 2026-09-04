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
 * Degradation contract:
 *   - Empty projetoIds → returns empty Map (legitimate, not a degradation).
 *   - Missing IMP_SERVICE_URL → throws Error (callPort in use case marks degraded).
 *   - Non-2xx HTTP response → throws Error (callPort in use case marks degraded).
 *   - Network/fetch error → propagates (callPort in use case marks degraded).
 *
 * Bearer token is forwarded from the originating request so the IMP service
 * validates the same JWT principal and scope (imp:read). The header is mounted
 * only when a token is present; its value is never logged (security gate).
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type {
  ManuscriptSummary,
  ManuscriptSummaryPort,
} from '../../../domain/proj/ports/outbound/manuscript-summary.port';

/**
 * Shape of the response from IMP's batch-query endpoint.
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
    bearerToken?: string,
  ): Promise<Map<string, ManuscriptSummary>> {
    if (projetoIds.length === 0) {
      return new Map();
    }

    const baseUrl = this.config.get<string>('IMP_SERVICE_URL');
    if (!baseUrl) {
      throw new Error('IMP_SERVICE_URL not configured — cannot fetch manuscript summaries');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Empresa-Id': empresaId,
    };
    if (bearerToken) {
      headers['Authorization'] = `Bearer ${bearerToken}`;
      this.logger.debug('ImpManuscriptSummaryAdapter: Authorization header mounted');
    }

    const url = `${baseUrl}/api/v1/imp/manuscripts/summaries`;
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ projetoIds }),
    });

    if (!response.ok) {
      throw new Error(
        `IMP manuscripts/summaries returned ${response.status} for empresaId=${empresaId}`,
      );
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
  }
}
