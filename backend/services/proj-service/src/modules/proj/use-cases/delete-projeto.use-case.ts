/**
 * DeleteProjetoUseCase — orchestrates the LGPD erasure cascade for a project
 * (P6 / PROJ-016).
 *
 * Business rules (plan §P6 / contract):
 *   - Purge order is PUB → COMP → IMP → DB delete, strictly sequential
 *     (NOT Promise.all) — each step must complete before the next starts.
 *   - Abort-on-failure: the first port that throws stops the cascade; the
 *     projeto_editorial row is NOT deleted, and the failure propagates as
 *     BadGatewayException (502).
 *   - Idempotent: each erasure port is expected to be a no-op success when
 *     called again for already-erased data, so retrying a partially-failed
 *     delete (e.g. PUB/COMP already purged, IMP failed last time) completes
 *     without error — this use case does not need special-case retry logic,
 *     it simply re-runs the full sequence.
 *   - Emits ProjectDeleted post-commit, only after the DB delete succeeds.
 *
 * RULE-04: this file is in modules/ and must NOT import from infrastructure/.
 */

import {
  BadGatewayException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import type { ProjetoEditorialRepository } from '../../../domain/proj/projeto-editorial.repository';
import type { PublicationErasurePort } from '../../../domain/proj/ports/outbound/publication-erasure.port';
import type { CompositionErasurePort } from '../../../domain/proj/ports/outbound/composition-erasure.port';
import type { ManuscriptErasurePort } from '../../../domain/proj/ports/outbound/manuscript-erasure.port';
import { ProjectDeletedEvent } from '../../../domain/proj/events/project-deleted.event';
import { type UsuarioContext } from '../../../domain/shared/usuario-context.interface';
import {
  PROJETO_EDITORIAL_REPOSITORY,
  PROJECT_EVENT_PUBLISHER,
  PUBLICATION_ERASURE_PORT,
  COMPOSITION_ERASURE_PORT,
  MANUSCRIPT_ERASURE_PORT,
} from '../proj.tokens';
import { type IProjectEventPublisher } from '../proj.event-publisher.interface';

export interface DeleteProjetoInput {
  readonly projetoId: string;
  /** JWT forwarded from the originating HTTP request so erasure ports can authenticate. */
  readonly bearerToken?: string;
}

@Injectable()
export class DeleteProjetoUseCase {
  private readonly logger = new Logger(DeleteProjetoUseCase.name);

  constructor(
    @Inject(PROJETO_EDITORIAL_REPOSITORY)
    private readonly repository: ProjetoEditorialRepository,
    @Inject(PUBLICATION_ERASURE_PORT)
    private readonly publicationErasure: PublicationErasurePort,
    @Inject(COMPOSITION_ERASURE_PORT)
    private readonly compositionErasure: CompositionErasurePort,
    @Inject(MANUSCRIPT_ERASURE_PORT)
    private readonly manuscriptErasure: ManuscriptErasurePort,
    @Inject(PROJECT_EVENT_PUBLISHER)
    private readonly eventPublisher: IProjectEventPublisher,
  ) {}

  /**
   * Executes the leaf-first LGPD erasure cascade for a project.
   *
   * @throws {NotFoundException} when the project does not exist in this empresa
   * @throws {BadGatewayException} when any erasure port fails — the project
   *         row is left intact so the cascade can be retried
   */
  async execute(input: DeleteProjetoInput, user: UsuarioContext): Promise<void> {
    const { projetoId, bearerToken } = input;
    const { empresaId } = user;

    const projeto = await this.repository.findById(projetoId, empresaId);
    if (!projeto) {
      throw new NotFoundException(
        `ProjetoEditorial ${projetoId} not found in this empresa`,
      );
    }

    // Step 1: PUB — leaf furthest from the source of truth.
    await this.erase(
      () => this.publicationErasure.erase(projetoId, empresaId, bearerToken),
      'PublicationErasurePort',
    );

    // Step 2: COMP.
    await this.erase(
      () => this.compositionErasure.erase(projetoId, empresaId, bearerToken),
      'CompositionErasurePort',
    );

    // Step 3: IMP.
    await this.erase(
      () => this.manuscriptErasure.erase(projetoId, empresaId, bearerToken),
      'ManuscriptErasurePort',
    );

    // Step 4: DB delete — only reached once every cross-context purge succeeded.
    await this.repository.delete(projetoId, empresaId);

    this.logger.log(`ProjetoEditorial ${projetoId} erasure cascade completed`);

    // Emit ProjectDeleted post-commit.
    const event = new ProjectDeletedEvent({
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      projetoId,
      editoraId: empresaId,
      solicitadoPor: user.id,
    });
    this.eventPublisher.publish('ProjectDeleted', event);
  }

  /**
   * Runs one erasure port call, converting any failure into a
   * BadGatewayException so the cascade aborts before the next step.
   */
  private async erase(fn: () => Promise<void>, portName: string): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.logger.error(
        `LGPD erasure cascade aborted at port=${portName}: ${(err as Error).message}`,
      );
      throw new BadGatewayException({
        message: `Erasure failed at port=${portName}`,
        type: 'urn:cordele:proj:erasure-failed',
        port: portName,
      });
    }
  }
}
