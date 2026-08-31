import { Inject, Injectable, Logger } from '@nestjs/common';

import type { MetadadosRepository } from '../ports/metadados-repository.port';
import type { FileStoragePort } from '../ports/file-storage.port';
import type { DomainEventEmitter } from '../ports/domain-event-emitter.port';
import { COMP_METADADOS_REPO, COMP_FILE_STORAGE_PORT, COMP_EVENT_EMITTER } from '../comp.tokens';

export interface RemoveCoverInput {
  readonly projetoId: string;
  readonly empresaSlug: string;
}

/**
 * Removes the cover image for a project (COMP-005, T05, api-contract §4.4).
 *
 * Idempotent:
 *   - When no Metadados row exists → no-op (nothing to remove).
 *   - When row exists but capaUrl is null → clears nothing (no-op).
 *   - FileStoragePort.delete silences ENOENT/NOT_FOUND (adapter responsibility).
 *
 * Events:
 *   'MetadataUpdated' is emitted post-persist only when a real mutation occurred
 *   (i.e., when existing.capaUrl was non-null and was successfully cleared).
 *   No event is emitted for no-op cases (no row, or capaUrl already null).
 *
 * Does not delete the Metadados row — only clears capaUrl within it.
 *
 * RULE-04: this file is in modules/ and does NOT import from infrastructure/ repositories.
 */
@Injectable()
export class RemoveCoverUseCase {
  private readonly logger = new Logger(RemoveCoverUseCase.name);

  constructor(
    @Inject(COMP_METADADOS_REPO)
    private readonly metadadosRepo: MetadadosRepository,
    @Inject(COMP_FILE_STORAGE_PORT)
    private readonly fileStorage: FileStoragePort,
    @Inject(COMP_EVENT_EMITTER)
    private readonly eventEmitter: DomainEventEmitter,
  ) {}

  async execute(input: RemoveCoverInput): Promise<void> {
    this.logger.debug(`RemoveCover projetoId=${input.projetoId} empresa=${input.empresaSlug}`);

    const existing = await this.metadadosRepo.findByProjetoId(input.projetoId);
    if (!existing) {
      // No row yet — idempotent, nothing to remove.
      this.logger.debug(`RemoveCover no row found — no-op projetoId=${input.projetoId}`);
      return;
    }

    const hadCover = !!existing.capaUrl;

    if (existing.capaUrl) {
      // Delete binary from storage (adapter silences NOT_FOUND/ENOENT).
      await this.fileStorage.delete(existing.capaUrl);
    }

    const updated = existing.withoutCapa();
    const persisted = await this.metadadosRepo.upsert(updated);

    // Emit only when a real mutation occurred (cover was present and was removed).
    if (hadCover) {
      this.eventEmitter.emit('MetadataUpdated', {
        projetoId: persisted.projetoId,
        empresaSlug: persisted.empresaSlug,
        capaUrl: null,
      });
    }
  }
}
