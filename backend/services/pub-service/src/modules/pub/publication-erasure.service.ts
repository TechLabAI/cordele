import { Inject, Injectable, Logger } from '@nestjs/common';

import type { PublicationErasurePort } from '../../domain/pub/ports/publication-erasure.port';
import type { PublicacaoRepositoryPort } from '../../domain/pub/ports/publicacao-repository.port';
import { FILE_STORAGE_PORT, PUBLICACAO_REPOSITORY_PORT } from './pub.tokens';
import type { FileStoragePort } from './ports/file-storage.port';

/**
 * PublicationErasureService — in-process implementation of PublicationErasurePort
 * (PUB-015, P6 — integration-contracts §1.2).
 *
 * Exported by PubModule under the PUBLICATION_ERASURE_PORT token so PROJ can
 * inject it directly in a co-located deployment. In microservice deployments,
 * PROJ uses the HTTP adapter (PubPublicationErasureAdapter) which calls PUB's
 * DELETE erasure endpoint backed by this service.
 *
 * Erasure is idempotent:
 *  - `deleteAllByProjeto` is a `deleteMany` — 0 rows deleted is not an error.
 *  - `FileStoragePort.delete` swallows ENOENT (DiskFileStorageAdapter, PUB-011).
 *  - A second call for an already-erased project therefore succeeds silently.
 *
 * Failure contract: any unexpected error (DB down, storage non-ENOENT failure)
 * propagates so the PROJ cascade aborts before deleting the project row
 * (contract: "falha em PUB nao deleta projeto_editorial", PROJ-016).
 *
 * RULE-04: this file is in modules/ and does NOT import from infrastructure/.
 *   Both ports arrive via DI constructor injection.
 * RULE-07: empresaId carried explicitly for logging — tenant isolation is at the
 *   schema level (schema-per-empresa, ADR-003).
 */
@Injectable()
export class PublicationErasureService implements PublicationErasurePort {
  private readonly logger = new Logger(PublicationErasureService.name);

  constructor(
    @Inject(PUBLICACAO_REPOSITORY_PORT)
    private readonly repository: PublicacaoRepositoryPort,
    @Inject(FILE_STORAGE_PORT)
    private readonly fileStorage: FileStoragePort,
  ) {}

  /**
   * Erases all publication records and ePub artifacts for a project.
   *
   * Sequence (leaf-first per PROJ-016 cascade contract):
   *  1. Load all publications to collect artefatoRefs BEFORE deleting DB rows
   *     (rows must exist for us to know which files to remove).
   *  2. Delete all DB rows (deleteMany — idempotent).
   *  3. Delete each storage artifact (idempotent via ENOENT absorption).
   *
   * @param projetoId - project UUID whose publications must be purged
   * @param empresaId - active tenant (logging/tracing)
   */
  async erase(projetoId: string, empresaId: string): Promise<void> {
    this.logger.log(
      `erase: starting purge projetoId=${projetoId} empresaId=${empresaId}`,
    );

    // Step 1: collect artefatoRefs before deleting (so we know what to remove from storage).
    const publications = await this.repository.listByProjeto(projetoId);
    const artefatoRefs = publications
      .map((p) => p.artefatoRef)
      .filter((ref): ref is string => ref !== undefined && ref !== null);

    // Step 2: delete DB rows (idempotent — 0 rows is fine).
    await this.repository.deleteAllByProjeto(projetoId);

    // Step 3: delete storage artifacts (idempotent — ENOENT absorbed by adapter).
    for (const ref of artefatoRefs) {
      await this.fileStorage.delete(ref);
      this.logger.debug(`erase: deleted artifact ref="${ref}"`);
    }

    this.logger.log(
      `erase: completed projetoId=${projetoId} ` +
      `rows=${publications.length} artifacts=${artefatoRefs.length}`,
    );
  }
}
