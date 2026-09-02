/**
 * ProjetoEditorialLookupAdapter — infrastructure adapter for the inbound lookup port.
 *
 * Implements `ProjetoEditorialLookupPort` using `ProjetoEditorialRepository`.
 * Cross-tenant safety is guaranteed by the repository's `existsByIdAndEmpresa`:
 * it returns false — never throws — when the project belongs to a different empresa.
 *
 * Bound under `ProjetoEditorialLookupPort` token (PROJETO_EDITORIAL_LOOKUP alias)
 * in LookupPortsModule (@Global()), imported by AppModule (PROJ-006 / PROJ-008).
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
import { EmpresaContextStore } from '../../context/empresa.context';

@Injectable()
export class ProjetoEditorialLookupAdapter implements ProjetoEditorialLookupPort {
  constructor(
    @Inject(ProjetoEditorialRepository)
    private readonly repository: ProjetoEditorialRepository,
  ) {}

  /**
   * Returns true iff projetoId exists in the active empresa's schema.
   *
   * `empresaId` is resolved from the AsyncLocalStorage store populated by
   * `JwtAuthGuard.canActivate()` (via `EmpresaContextStore.enterWith()`).
   * This guarantees that a project belonging to empresa-A is invisible
   * when the request carries an empresa-B JWT — the Prisma tenant factory
   * executes `SET LOCAL search_path TO emp_<empresaId>`, so empresa-A's
   * rows are physically absent from the query scope.
   *
   * Never throws: any repository-level exception propagates to the caller;
   * cross-tenant access (wrong schema) returns false by design.
   */
  async exists(projetoId: string): Promise<boolean> {
    const empresaId = EmpresaContextStore.getEditoraId();
    return this.repository.existsByIdAndEmpresa(projetoId, empresaId);
  }
}
