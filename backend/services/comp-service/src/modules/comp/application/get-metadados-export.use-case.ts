import { Inject, Injectable, Logger } from '@nestjs/common';

import type { MetadadosRepository } from '../ports/metadados-repository.port';
import { COMP_METADADOS_REPO } from '../comp.tokens';

/**
 * DTO returned by GetMetadadosExportUseCase (in-process export port for PUB).
 *
 * Shape matches api-contract §6.1 minus `materialized` (§6.5):
 * PUB only reads persisted metadata — non-materialized defaults are not exported.
 *
 * RULE-04: defined in modules/ — not a Prisma model, not an infrastructure type.
 */
export interface MetadadosRead {
  readonly projetoId: string;
  readonly titulo: string;
  readonly autor: string;
  readonly isbn: string | null;
  readonly idioma: string;
  readonly categoria: string | null;
  readonly capaUrl: string | null;
  readonly editoraNome: string | null;
  readonly atualizadoEm: Date;
}

/**
 * In-process export use case for the Metadados aggregate (COMP-016, D-I / G2).
 *
 * Called by PUB at ePub export time — NOT the HTTP controller path.
 * The HTTP path (`GET .../metadados`) uses `GetMetadadosViewUseCase`, which
 * returns a lazy default (`materialized=false`). This use case returns `null`
 * when no composition exists so that PUB can decide what to do (e.g. abort).
 *
 * Wiring: injected by token from CompModule; token declaration in comp.tokens.ts.
 *
 * RULE-04: does not import infrastructure/ directly; uses COMP_METADADOS_REPO token.
 * RULE-02: resides in modules/ — @nestjs/common decorators are permitted here.
 */
@Injectable()
export class GetMetadadosExportUseCase {
  private readonly logger = new Logger(GetMetadadosExportUseCase.name);

  constructor(
    @Inject(COMP_METADADOS_REPO)
    private readonly metadadosRepo: MetadadosRepository,
  ) {}

  /**
   * Returns the persisted `Metadados` as a `MetadadosRead` DTO, or `null` when
   * no row has been materialized yet for the given project.
   *
   * Never throws for an absent aggregate (null-safe, api-contract §6.5).
   */
  async get(projetoId: string): Promise<MetadadosRead | null> {
    this.logger.debug(`GetMetadadosExport projetoId=${projetoId}`);

    const metadados = await this.metadadosRepo.findByProjetoId(projetoId);

    if (!metadados) {
      this.logger.debug(`GetMetadadosExport: no row found for projetoId=${projetoId} — returning null`);
      return null;
    }

    // Map aggregate to the export DTO (api-contract §6.1 minus `materialized`).
    const read: MetadadosRead = {
      projetoId: metadados.projetoId,
      titulo: metadados.titulo,
      autor: metadados.autor,
      isbn: metadados.isbn,
      idioma: metadados.idioma,
      categoria: metadados.categoria,
      capaUrl: metadados.capaUrl,
      editoraNome: metadados.editoraNome,
      atualizadoEm: metadados.atualizadoEm,
    };

    return read;
  }
}
