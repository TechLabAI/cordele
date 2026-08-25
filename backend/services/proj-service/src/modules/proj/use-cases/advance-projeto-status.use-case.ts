/**
 * AdvanceProjetoStatusUseCase — the only mechanism for forward status transitions.
 *
 * Called by IMP (rascunho → em_composicao on confirm-estrutura) and PUB
 * (em_composicao → publicado|com_erros on export result). ADR-002 / D-D.
 *
 * Business rules (api-contract §7 / SPEC-02):
 *   - Delegates to ProjectStatusVO.advanceTo for transition validation.
 *   - On actual change: persists update + emits ProjectStatusChanged.
 *   - On idempotent no-op (same status): returns { changed: false } without event.
 *   - On illegal transition: surfaces IllegalStatusTransitionError.
 *
 * RULE-04: this file is in modules/ and does NOT import from infrastructure/.
 */

import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import { ProjectStatusVO } from '../../../domain/proj/value-objects/project-status.vo';
import { type ProjetoStatus } from '../../../domain/proj/value-objects/project-status.vo';
import { ProjectStatusChangedEvent } from '../../../domain/proj/events/project-status-changed.event';
import {
  ProjetoEditorialRepository,
  type ProjetoEditorialData,
} from '../../../domain/proj/projeto-editorial.repository';
import { type UsuarioContext } from '../../../domain/shared/usuario-context.interface';
import { PROJETO_EDITORIAL_REPOSITORY, PROJECT_EVENT_PUBLISHER } from '../proj.tokens';
import { type IProjectEventPublisher } from '../proj.event-publisher.interface';

export interface AdvanceProjetoStatusInput {
  readonly projetoId: string;
  readonly targetStatus: ProjetoStatus;
}

export interface AdvanceProjetoStatusResult {
  readonly projetoId: string;
  readonly newStatus: ProjetoStatus;
  readonly changed: boolean;
}

@Injectable()
export class AdvanceProjetoStatusUseCase {
  private readonly logger = new Logger(AdvanceProjetoStatusUseCase.name);

  constructor(
    @Inject(PROJETO_EDITORIAL_REPOSITORY)
    private readonly repository: ProjetoEditorialRepository,
    @Inject(PROJECT_EVENT_PUBLISHER)
    private readonly eventPublisher: IProjectEventPublisher,
  ) {}

  /**
   * Advances the status of a ProjetoEditorial.
   *
   * @param input - projetoId and targetStatus
   * @param user  - authenticated caller (empresaId scopes the repository)
   * @returns result with projetoId, newStatus and changed flag
   * @throws {NotFoundException} when project not found in this empresa
   * @throws {IllegalStatusTransitionError} when transition is not legal
   */
  async advanceTo(
    input: AdvanceProjetoStatusInput,
    user: UsuarioContext,
  ): Promise<AdvanceProjetoStatusResult> {
    const projeto = await this.findOrThrow(input.projetoId, user.empresaId);

    // Delegate to the VO — throws IllegalStatusTransitionError on illegal move.
    const { newStatus, changed } = ProjectStatusVO.advanceTo(
      projeto.status,
      input.targetStatus,
    );

    if (!changed) {
      // Idempotent no-op: nothing to persist, no event emitted.
      return { projetoId: projeto.id, newStatus, changed: false };
    }

    // Persist the status change (P3 will also append projeto_status_historico).
    await this.repository.updateStatus({
      id: projeto.id,
      newStatus,
      previousStatus: projeto.status,
      changedBy: user.id,
      empresaId: user.empresaId,
    });

    // Emit ProjectStatusChanged post-persist.
    const event = new ProjectStatusChangedEvent({
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      projetoId: projeto.id,
      editoraId: projeto.editoraId,
      statusDe: projeto.status,
      statusPara: newStatus,
      solicitadoPor: user.id,
    });
    this.eventPublisher.publish('ProjectStatusChanged', event);
    this.logger.log(
      `ProjetoEditorial ${projeto.id}: ${projeto.status} → ${newStatus}`,
    );

    return { projetoId: projeto.id, newStatus, changed: true };
  }

  private async findOrThrow(
    projetoId: string,
    empresaId: string,
  ): Promise<ProjetoEditorialData> {
    const projeto = await this.repository.findById(projetoId, empresaId);
    if (!projeto) {
      throw new NotFoundException(
        `ProjetoEditorial ${projetoId} not found in this empresa`,
      );
    }
    return projeto;
  }
}
