import { Inject, Injectable, Logger } from '@nestjs/common';

import { Metadados, type Idioma } from '../../../domain/comp/metadados.aggregate';
import type { MetadadosRepository } from '../ports/metadados-repository.port';
import type { DomainEventEmitter } from '../ports/domain-event-emitter.port';
import { COMP_METADADOS_REPO, COMP_EVENT_EMITTER } from '../comp.tokens';

export interface UpdateMetadadosInput {
  readonly projetoId: string;
  readonly empresaSlug: string;
  readonly titulo: string;
  readonly autor: string;
  readonly idioma: Idioma;
  readonly isbn?: string | null;
  readonly categoria?: string | null;
}

/**
 * Idempotent upsert of editorial metadata (COMP-004, T05, api-contract §4.2).
 *
 * Creates the row on first call; re-sending an identical body is a safe no-op.
 * Domain invariants (titulo/autor non-blank, idioma valid) are enforced by
 * Metadados.update() which marks the result as materialized=true.
 *
 * Concurrency: DB UNIQUE(projeto_id) serializes concurrent writes — no
 * optimistic-lock or distributed lock is required (per-project singleton).
 *
 * Idempotency (COMP-004 SPEC-05):
 *   When the existing row already has the same five editable fields (titulo,
 *   autor, idioma, isbn, categoria), the use case returns the existing entity
 *   WITHOUT calling upsert() again and WITHOUT emitting MetadataUpdated.
 *   This is detected via Metadados.hasSameContentAs() in the aggregate.
 *
 * Events:
 *   'MetadataUpdated' is emitted post-persist via DomainEventEmitter only when
 *   the operation causes a real write (new row or changed field).
 *
 * RULE-04: this file is in modules/ and does NOT import from infrastructure/.
 */
@Injectable()
export class UpdateMetadadosUseCase {
  private readonly logger = new Logger(UpdateMetadadosUseCase.name);

  constructor(
    @Inject(COMP_METADADOS_REPO)
    private readonly metadadosRepo: MetadadosRepository,
    @Inject(COMP_EVENT_EMITTER)
    private readonly eventEmitter: DomainEventEmitter,
  ) {}

  async execute(input: UpdateMetadadosInput): Promise<Metadados> {
    this.logger.debug(
      `UpdateMetadados projetoId=${input.projetoId} empresa=${input.empresaSlug}`,
    );

    const existing = await this.metadadosRepo.findByProjetoId(input.projetoId);

    // Idempotency check (COMP-004 / SPEC-05): if a row exists and all five
    // editable fields are unchanged, skip the write and return the current state.
    if (existing?.materialized) {
      const sameContent = existing.hasSameContentAs({
        titulo: input.titulo,
        autor: input.autor,
        idioma: input.idioma,
        isbn: input.isbn,
        categoria: input.categoria,
      });
      if (sameContent) {
        this.logger.debug(
          `UpdateMetadados no-op (identical payload) projetoId=${input.projetoId}`,
        );
        return existing;
      }
    }

    const base = existing ?? Metadados.defaultsFor(input.projetoId, input.empresaSlug);

    const updated = base.update({
      titulo: input.titulo,
      autor: input.autor,
      idioma: input.idioma,
      isbn: input.isbn,
      categoria: input.categoria,
    });

    const persisted = await this.metadadosRepo.upsert(updated);

    // Emit post-persist event (only on real mutation).
    this.eventEmitter.emit('MetadataUpdated', {
      projetoId: persisted.projetoId,
      empresaSlug: persisted.empresaSlug,
      titulo: persisted.titulo,
      autor: persisted.autor,
      idioma: persisted.idioma,
    });

    return persisted;
  }
}
