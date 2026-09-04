import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { ManuscriptContentPort, ManuscriptContentTree } from '../../modules/pub/ports/manuscript-content.port';

/**
 * Raw shape of the IMP `/api/v1/imp/projetos/:projetoId/manuscritos` response item.
 * Only the fields PUB needs are typed; extras are silently ignored.
 */
interface ImpManuscritoItem {
  readonly id: string;
  readonly status?: string;
  readonly createdAt?: string;
}

/**
 * Raw shape of the IMP `/api/v1/imp/manuscripts/:id/estrutura` response.
 * `estrutura` mirrors IMP's `ContentTree` (`{ chapters: Chapter[], orphanUnparsedSegments: ... }`).
 */
interface ImpEstruturaResponse {
  readonly manuscritoId: string;
  readonly estrutura: {
    readonly chapters?: readonly unknown[];
    readonly orphanUnparsedSegments?: readonly unknown[];
    [key: string]: unknown;
  };
}

/**
 * HTTP adapter for `ManuscriptContentPort` (INT-PUB-001, P6).
 *
 * Calls the IMP service via two sequential HTTP requests:
 *  1. `GET /api/v1/imp/projetos/{projetoId}/manuscritos` — resolve the most
 *     recent manuscritoId for the project (newest first per IMP's sort order).
 *  2. `GET /api/v1/imp/manuscripts/{manuscritoId}/estrutura` — fetch the
 *     canonical ContentTree and map it to `ManuscriptContentTree`.
 *
 * The bearer token from the originating request is forwarded as-is so the IMP
 * service can authenticate the call under the same user principal.
 *
 * RULE-05: infrastructure/ does not import modules/; only the port interface
 *   (type-only) and pure domain types are imported.
 * RULE-06: outbound HTTP clients live only in `infrastructure/http/`.
 * RULE-08: no console.log — Nest Logger only.
 */
@Injectable()
export class ImpManuscriptContentAdapter implements ManuscriptContentPort {
  private readonly logger = new Logger(ImpManuscriptContentAdapter.name);
  private readonly impBaseUrl: string;

  constructor(config: ConfigService) {
    this.impBaseUrl = config.getOrThrow<string>('IMP_SERVICE_URL');
  }

  async getContentTree(projetoId: string, bearerToken: string): Promise<ManuscriptContentTree | null> {
    const manuscritoId = await this.resolveManuscritoId(projetoId, bearerToken);
    if (!manuscritoId) {
      return null;
    }
    return this.fetchEstrutura(manuscritoId, bearerToken);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Step 1: retrieve the list of manuscripts for the project and return the
   * first (newest) manuscript id. Returns `null` when the project has no
   * imported manuscript (404 or empty list).
   */
  private async resolveManuscritoId(projetoId: string, bearerToken: string): Promise<string | null> {
    const url = `${this.impBaseUrl}/api/v1/imp/projetos/${projetoId}/manuscritos`;
    let response: Response;

    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          Accept: 'application/json',
        },
      });
    } catch (err) {
      this.logger.error(
        `IMP network error fetching manuscripts for projeto ${projetoId}`,
        err as Error,
      );
      return null;
    }

    if (response.status === 404) {
      this.logger.debug(`IMP returned 404 for projeto ${projetoId} manuscripts — no manuscript`);
      return null;
    }

    if (!response.ok) {
      this.logger.error(
        `IMP returned HTTP ${response.status} fetching manuscripts for projeto ${projetoId}`,
      );
      return null;
    }

    let items: ImpManuscritoItem[];
    try {
      items = (await response.json()) as ImpManuscritoItem[];
    } catch (err) {
      this.logger.error(
        `IMP returned non-JSON response for projeto ${projetoId} manuscripts`,
        err as Error,
      );
      return null;
    }

    if (!Array.isArray(items) || items.length === 0) {
      this.logger.debug(`IMP returned empty manuscript list for projeto ${projetoId}`);
      return null;
    }

    // IMP sorts manuscripts by createdAt DESC (newest first, per imp.service.ts).
    return items[0]!.id;
  }

  /**
   * Step 2: fetch the canonical ContentTree for the given manuscritoId.
   * Returns `null` on 404 (manuscript deleted between the list and the fetch).
   */
  private async fetchEstrutura(manuscritoId: string, bearerToken: string): Promise<ManuscriptContentTree | null> {
    const url = `${this.impBaseUrl}/api/v1/imp/manuscripts/${manuscritoId}/estrutura`;
    let response: Response;

    try {
      response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${bearerToken}`,
          Accept: 'application/json',
        },
      });
    } catch (err) {
      this.logger.error(
        `IMP network error fetching estrutura for manuscript ${manuscritoId}`,
        err as Error,
      );
      return null;
    }

    if (response.status === 404) {
      this.logger.debug(`IMP returned 404 for manuscript ${manuscritoId} — manuscript not found`);
      return null;
    }

    if (!response.ok) {
      this.logger.error(
        `IMP returned HTTP ${response.status} fetching estrutura for manuscript ${manuscritoId}`,
      );
      return null;
    }

    let body: ImpEstruturaResponse;
    try {
      body = (await response.json()) as ImpEstruturaResponse;
    } catch (err) {
      this.logger.error(
        `IMP returned non-JSON response for manuscript ${manuscritoId} estrutura`,
        err as Error,
      );
      return null;
    }

    // IMP's ContentTree has shape { chapters: Chapter[], orphanUnparsedSegments: [] }.
    // EpubBuilder expects estrutura to be an array of chapter-like nodes.
    const chapters = Array.isArray(body.estrutura?.chapters) ? body.estrutura.chapters : [];

    return {
      manuscritoId: body.manuscritoId,
      estrutura: chapters,
    };
  }
}
