/**
 * ProjetoEditorialLookupAdapter — infrastructure adapter for the inbound lookup port.
 *
 * Implements `ProjetoEditorialLookupPort` using `ProjetoEditorialRepository`.
 * Cross-tenant safety is guaranteed by the repository's `existsByIdAndEmpresa`:
 * it returns false — never throws — when the project belongs to a different empresa.
 *
 * Bound under `PROJETO_EDITORIAL_LOOKUP` token in proj.module.ts (PROJ-006).
 *
 * RULE-05: this file is in infrastructure/ — it must NOT import from modules/.
 * The `ProjetoEditorialRepository` symbol is declared in domain/ and used directly
 * as the injection token so there is no cross-layer modules/ dependency.
 */

import { Inject, Injectable } from '@nestjs/common';

import {
  ProjetoEditorialRepository,
} from '../../../domain/proj/projeto-editorial.repository';
import { type ProjetoEditorialLookupPort } from '../../../domain/proj/ports/inbound/projeto-editorial-lookup.port';

@Injectable()
export class ProjetoEditorialLookupAdapter implements ProjetoEditorialLookupPort {
  constructor(
    @Inject(ProjetoEditorialRepository)
    private readonly repository: ProjetoEditorialRepository,
  ) {}

  /**
   * Returns true iff projetoId exists in the active empresa's schema.
   *
   * EmpresaContext is read from AsyncLocalStorage by the underlying repository
   * adapter (wired in P3 / P5). For P2, the stub repository receives an empty
   * string — P3 will replace this with `EmpresaContext.getEmpresaId()`.
   */
  async exists(projetoId: string): Promise<boolean> {
    return this.repository.existsByIdAndEmpresa(projetoId, '');
  }
}
