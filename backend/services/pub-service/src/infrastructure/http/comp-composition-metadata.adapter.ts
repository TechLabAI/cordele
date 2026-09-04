import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EmpresaContextService } from '../auth/empresa-context.service';
import type { CompositionMetadataPort, MetadadosRead } from '../../modules/pub/ports/composition-metadata.port';

/**
 * Raw shape of the COMP `GET /api/v1/comp/projetos/:projetoId/metadados` response.
 *
 * When `materialized === false`, the comp-service returns a synthesised default
 * (D-M / api-contract §4.1) — not a 404. PUB must treat this as "no data saved
 * yet" and return `null` so the export pre-flight can reject with 422
 * (metadata-incomplete) as documented in api-contract §7.1.
 */
interface CompMetadadosResponse {
  readonly projetoId: string;
  readonly titulo: string | null;
  readonly autor: string | null;
  readonly isbn: string | null;
  readonly idioma: string | null;
  readonly categoria: string | null;
  readonly capaUrl: string | null;
  readonly editoraNome: string | null;
  readonly atualizadoEm: string;
  readonly materialized: boolean;
  [key: string]: unknown;
}

/**
 * HTTP adapter for `CompositionMetadataPort` (INT-PUB-002, P10).
 *
 * Calls the COMP service:
 *   GET /api/v1/comp/projetos/{projetoId}/metadados
 *
 * The bearer token is obtained from the ALS context via
 * `EmpresaContextService.getBearerToken()` — no change to the port signature.
 * Inside `PublicationBuildJob`, the token is present in the ALS because
 * `GeneratePublicationUseCase` propagates it via `runAs(..., bearerToken)`.
 *
 * RULE-05: infrastructure/ does not import modules/; only port interfaces
 *   (type-only) are imported.
 * RULE-06: outbound HTTP clients live only in `infrastructure/http/`.
 * RULE-08: no console.log — Nest Logger only.
 */
@Injectable()
export class CompCompositionMetadataAdapter implements CompositionMetadataPort {
  private readonly logger = new Logger(CompCompositionMetadataAdapter.name);
  private readonly compBaseUrl: string;

  constructor(
    config: ConfigService,
    private readonly empresaContext: EmpresaContextService,
  ) {
    this.compBaseUrl = config.getOrThrow<string>('COMP_SERVICE_URL');
  }

  async get(projetoId: string): Promise<MetadadosRead | null> {
    const url = `${this.compBaseUrl}/api/v1/comp/projetos/${projetoId}/metadados`;
    const bearerToken = this.empresaContext.getBearerToken();

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (bearerToken) {
      headers['Authorization'] = `Bearer ${bearerToken}`;
    }

    let response: Response;
    try {
      response = await fetch(url, { method: 'GET', headers });
    } catch (err) {
      this.logger.error(
        `COMP network error fetching metadados for projeto ${projetoId}`,
        err as Error,
      );
      return null;
    }

    if (response.status === 404) {
      this.logger.debug(`COMP returned 404 for projeto ${projetoId} metadados`);
      return null;
    }

    if (!response.ok) {
      this.logger.error(
        `COMP returned HTTP ${response.status} fetching metadados for projeto ${projetoId}`,
      );
      return null;
    }

    let body: CompMetadadosResponse;
    try {
      body = (await response.json()) as CompMetadadosResponse;
    } catch (err) {
      this.logger.error(
        `COMP returned non-JSON response for projeto ${projetoId} metadados`,
        err as Error,
      );
      return null;
    }

    // COMP returns materialized=false when no composition data has been saved yet.
    // Treat as null so the export pre-flight rejects with 422 (api-contract §7.1).
    if (!body.materialized) {
      this.logger.debug(
        `COMP metadados for projeto ${projetoId} is not materialized — returning null`,
      );
      return null;
    }

    return {
      projetoId: body.projetoId,
      titulo: emptyToNull(body.titulo),
      autor: emptyToNull(body.autor),
      isbn: emptyToNull(body.isbn),
      idioma: emptyToNull(body.idioma),
      categoria: emptyToNull(body.categoria),
      capaUrl: emptyToNull(body.capaUrl),
      editoraNome: emptyToNull(body.editoraNome),
      atualizadoEm: body.atualizadoEm,
    };
  }
}

/** Coerces an empty string to `null`; passes through non-empty strings and `null`. */
function emptyToNull(value: string | null | undefined): string | null {
  if (value === '' || value == null) return null;
  return value;
}
