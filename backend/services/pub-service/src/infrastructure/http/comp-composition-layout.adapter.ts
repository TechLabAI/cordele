import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { EmpresaContextService } from '../auth/empresa-context.service';
import type {
  CompositionLayoutPort,
  LayoutOverrideRead,
  LayoutRead,
} from '../../modules/pub/ports/composition-layout.port';

/**
 * Raw shape of one override item in the COMP layout response.
 *
 * COMP may return additional fields (e.g. `stale`) that PUB ignores.
 */
interface CompLayoutOverrideRaw {
  readonly id: string;
  readonly referenciaNo: string;
  readonly tipo: string;
  readonly alinhamento: 'full' | 'centralizado' | 'junto-esquerda' | 'junto-direita' | null;
  readonly ordem: number;
  [key: string]: unknown;
}

/**
 * Raw shape of the COMP `GET /api/v1/comp/projetos/:projetoId/layout` response.
 *
 * When `materialized === false`, the comp-service returns a synthesised default
 * (D-M / api-contract §4.5). PUB treats this as `null` — `null` layout is a
 * graceful fallback (EpubBuilder uses COMP defaults §7.2); unlike metadata,
 * absent layout does not abort the export.
 */
interface CompLayoutResponse {
  readonly projetoId: string;
  readonly fonteCorpoFamilia: 'serif' | 'sans-serif';
  readonly fonteCorpoTamanho: number;
  readonly espacamentoLinha: number;
  readonly margemLateral: number;
  readonly h1Tamanho: number;
  readonly h2Tamanho: number;
  readonly h3Tamanho: number;
  readonly overrides: readonly CompLayoutOverrideRaw[];
  readonly materialized: boolean;
  [key: string]: unknown;
}

/**
 * HTTP adapter for `CompositionLayoutPort` (INT-PUB-002, P10).
 *
 * Calls the COMP service:
 *   GET /api/v1/comp/projetos/{projetoId}/layout
 *
 * The bearer token is obtained from the ALS context via
 * `EmpresaContextService.getBearerToken()` — no change to the port signature.
 *
 * Override filtering: only items with `tipo === 'imagem' | 'em-branco'` are
 * included in the returned `LayoutRead.overrides`. COMP's own `LayoutOverrideViewDto`
 * already constrains `tipo` to these two values, but the filter is explicit here
 * for forward-compatibility.
 *
 * RULE-05: infrastructure/ does not import modules/; only port interfaces
 *   (type-only) are imported.
 * RULE-06: outbound HTTP clients live only in `infrastructure/http/`.
 * RULE-08: no console.log — Nest Logger only.
 */
@Injectable()
export class CompCompositionLayoutAdapter implements CompositionLayoutPort {
  private readonly logger = new Logger(CompCompositionLayoutAdapter.name);
  private readonly compBaseUrl: string;

  constructor(
    config: ConfigService,
    private readonly empresaContext: EmpresaContextService,
  ) {
    this.compBaseUrl = config.get<string>('COMP_SERVICE_URL') ?? 'http://localhost:3001';
  }

  async get(projetoId: string): Promise<LayoutRead | null> {
    const url = `${this.compBaseUrl}/api/v1/comp/projetos/${projetoId}/layout`;
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
        `COMP network error fetching layout for projeto ${projetoId}`,
        err as Error,
      );
      return null;
    }

    if (response.status === 404) {
      this.logger.debug(`COMP returned 404 for projeto ${projetoId} layout`);
      return null;
    }

    if (!response.ok) {
      this.logger.error(
        `COMP returned HTTP ${response.status} fetching layout for projeto ${projetoId}`,
      );
      return null;
    }

    let body: CompLayoutResponse;
    try {
      body = (await response.json()) as CompLayoutResponse;
    } catch (err) {
      this.logger.error(
        `COMP returned non-JSON response for projeto ${projetoId} layout`,
        err as Error,
      );
      return null;
    }

    // COMP returns materialized=false when no layout has been saved yet.
    // null layout is a graceful fallback (EpubBuilder uses COMP defaults §7.2).
    if (!body.materialized) {
      this.logger.debug(
        `COMP layout for projeto ${projetoId} is not materialized — returning null`,
      );
      return null;
    }

    return {
      projetoId: body.projetoId,
      fonteCorpoFamilia: body.fonteCorpoFamilia,
      fonteCorpoTamanho: body.fonteCorpoTamanho,
      espacamentoLinha: body.espacamentoLinha,
      margemLateral: body.margemLateral,
      h1Tamanho: body.h1Tamanho,
      h2Tamanho: body.h2Tamanho,
      h3Tamanho: body.h3Tamanho,
      overrides: mapOverrides(body.overrides),
    };
  }
}

/**
 * Maps raw COMP override items to PUB's `LayoutOverrideRead`.
 *
 * Filters to `tipo === 'imagem' | 'em-branco'` and drops COMP-only fields
 * (e.g. `stale`) that are not part of the PUB port contract.
 */
function mapOverrides(raw: readonly CompLayoutOverrideRaw[]): readonly LayoutOverrideRead[] {
  return raw
    .filter((o): o is CompLayoutOverrideRaw & { tipo: 'imagem' | 'em-branco' } =>
      o.tipo === 'imagem' || o.tipo === 'em-branco',
    )
    .map(
      (o): LayoutOverrideRead => ({
        id: o.id,
        referenciaNo: o.referenciaNo,
        tipo: o.tipo,
        alinhamento: o.alinhamento,
        ordem: o.ordem,
      }),
    );
}
