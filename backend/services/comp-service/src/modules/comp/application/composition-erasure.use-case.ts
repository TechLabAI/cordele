import { Inject, Injectable, Logger } from '@nestjs/common';

import type { CompositionErasurePort } from '../../../domain/ports/composition-erasure.port';
import type { MetadadosRepository } from '../ports/metadados-repository.port';
import type { FileStoragePort } from '../ports/file-storage.port';
import { COMP_METADADOS_REPO, COMP_FILE_STORAGE_PORT } from '../comp.tokens';

/**
 * Application use case implementing `CompositionErasurePort` (COMP-017).
 *
 * Idempotent LGPD erasure of all COMP data for a project:
 *  1. Fetch metadados to capture `capaUrl` before deletion.
 *  2. Delete the cover binary via `FileStoragePort` (best-effort — storage
 *     errors are logged but do NOT abort the operation).
 *  3. Delete the `metadados` row via `MetadadosRepository` (cascade removes
 *     `configuracao_layout` and `layout_override` rows via DB FK constraint).
 *
 * A second call for the same `projetoId` completes without error because
 * `MetadadosRepository.delete` uses `deleteMany` (silences not-found) and
 * `FileStoragePort.delete` is idempotent by contract.
 *
 * Exported from CompModule via `COMP_COMPOSITION_ERASURE_PORT` for in-process
 * consumption by PROJ (LGPD erasure workflow). No HTTP call involved.
 *
 * Multi-empresa: schema routing is handled by the repository adapter via
 * AsyncLocalStorage (RULE-07). Callers must execute in a request context
 * where EmpresaContext is set (populated by EmpresaContextMiddleware).
 *
 * RULE-01/02: no @prisma/client in this class — delegates to port interfaces.
 * RULE-04: does not import from infrastructure/ directly.
 */
@Injectable()
export class CompositionErasureUseCase implements CompositionErasurePort {
  private readonly logger = new Logger(CompositionErasureUseCase.name);

  constructor(
    @Inject(COMP_METADADOS_REPO)
    private readonly metadadosRepo: MetadadosRepository,
    @Inject(COMP_FILE_STORAGE_PORT)
    private readonly fileStorage: FileStoragePort,
  ) {}

  /**
   * Idempotent erasure of all COMP data for the given project.
   *
   * Safe to call multiple times — subsequent calls on an already-erased project
   * complete without error.
   *
   * @param projetoId  UUID of the project whose COMP data should be erased.
   */
  async purge(projetoId: string): Promise<void> {
    this.logger.debug(`purge start projetoId=${projetoId}`);

    // 1. Fetch metadados to capture capaUrl before deleting it.
    //    Returns null when no row exists (idempotent path — no-op below).
    const meta = await this.metadadosRepo.findByProjetoId(projetoId);
    const capaUrl: string | null = meta?.capaUrl ?? null;

    // 2. Remove cover file from storage (best-effort, before DB delete).
    //    Storage errors are logged but do NOT abort the erasure operation.
    if (capaUrl) {
      try {
        await this.fileStorage.delete(capaUrl);
        this.logger.debug(`purge cover removed projetoId=${projetoId}`);
      } catch (err) {
        this.logger.warn(
          `purge: cover removal failed for projetoId=${projetoId} capaUrl=${capaUrl}: ${String(err)}`,
        );
      }
    }

    // 3. Delete metadados (cascade removes configuracao_layout + layout_override rows).
    //    deleteMany is idempotent — silences NOT_FOUND when row is already absent.
    await this.metadadosRepo.delete(projetoId);

    this.logger.debug(`purge done projetoId=${projetoId}`);
  }
}
