import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ProjectStatusAdvanceError } from '../../domain/pub/errors/project-status-advance.error';
import type {
  AdvanceProjetoStatusPort,
  AdvanceProjetoStatusResult,
  ProjetoTargetStatus,
} from '../../modules/pub/ports/advance-projeto-status.port';

/**
 * Expected shape of the PROJ `POST /api/v1/proj/projetos/:id/advance-status` success body.
 */
interface ProjAdvanceStatusResponse {
  readonly projetoId: string;
  readonly newStatus: string;
  readonly changed: boolean;
}

/**
 * Expected shape of PROJ error bodies (409 illegal-transition, 404 not-found).
 */
interface ProjErrorResponse {
  readonly type?: string;
  readonly message?: string;
  readonly from?: string;
  readonly to?: string;
}

/**
 * HTTP adapter for `AdvanceProjetoStatusPort` (INT-PUB-003, P6).
 *
 * Calls `POST /api/v1/proj/projetos/{projetoId}/advance-status` on the PROJ
 * service, forwarding the originating request's JWT so the PROJ service can
 * authenticate the call under the same principal.
 *
 * Error contract: any HTTP or network failure is surfaced as
 * `ProjectStatusAdvanceError` so `PublicationBuildJob.requestProjectStatus`
 * can log it without discarding the `Publicacao` outcome
 * (integration-contracts.md §2.4).
 *
 * RULE-05: infrastructure/ does not import modules/; only port interfaces
 *   (type-only) and domain error classes are imported.
 * RULE-06: outbound HTTP clients live only in `infrastructure/http/`.
 * RULE-08: no console.log — Nest Logger only.
 */
@Injectable()
export class ProjProjectStatusAdapter implements AdvanceProjetoStatusPort {
  private readonly logger = new Logger(ProjProjectStatusAdapter.name);
  private readonly projBaseUrl: string;

  constructor(config: ConfigService) {
    this.projBaseUrl = config.get<string>('PROJ_SERVICE_BASE_URL') ?? 'http://localhost:3002';
  }

  async advanceTo(
    input: { projetoId: string; targetStatus: ProjetoTargetStatus },
    bearerToken: string,
  ): Promise<AdvanceProjetoStatusResult> {
    const { projetoId, targetStatus } = input;
    const url = `${this.projBaseUrl}/api/v1/proj/projetos/${projetoId}/advance-status`;

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ targetStatus }),
      });
    } catch (err) {
      const cause = err instanceof Error ? err : new Error(String(err));
      this.logger.error(
        `PROJ network error advancing projeto ${projetoId} to "${targetStatus}"`,
        cause,
      );
      throw new ProjectStatusAdvanceError(projetoId, targetStatus, `network error: ${cause.message}`, cause);
    }

    if (response.ok) {
      let body: ProjAdvanceStatusResponse;
      try {
        body = (await response.json()) as ProjAdvanceStatusResponse;
      } catch (err) {
        throw new ProjectStatusAdvanceError(
          projetoId,
          targetStatus,
          `PROJ returned HTTP ${response.status} but non-JSON body`,
          err instanceof Error ? err : undefined,
        );
      }
      return {
        projetoId: body.projetoId,
        newStatus: body.newStatus as ProjetoTargetStatus,
        changed: body.changed,
      };
    }

    // Non-2xx: parse error body for richer logging.
    let errorBody: ProjErrorResponse = {};
    try {
      errorBody = (await response.json()) as ProjErrorResponse;
    } catch {
      // Ignore parse failure — use status code as the reason.
    }

    const reason = errorBody.type ?? errorBody.message ?? `HTTP ${response.status}`;
    this.logger.error(
      `PROJ returned HTTP ${response.status} advancing projeto ${projetoId} to "${targetStatus}": ${reason}`,
    );

    throw new ProjectStatusAdvanceError(projetoId, targetStatus, reason);
  }
}
