/**
 * ReopenProjectForRevisionUseCase — the sole deliberate backward edge.
 *
 * Triggered by the editor via `POST /api/proj/projetos/{projetoId}/reopen`
 * (T08 "Ajustar metadados/layout" button). Only the editor may call this;
 * IMP and PUB must use AdvanceProjetoStatusUseCase (ADR-002 / D-D).
 *
 * Business rules (api-contract §4.7 / §7 / SPEC-02):
 *   - Delegates to ProjectStatusVO.reopen for validation.
 *   - publicado|com_erros → em_composicao: persists + emits ProjectStatusChanged.
 *   - Already em_composicao: returns { changed: false } (idempotent no-op).
 *   - rascunho: throws IllegalStatusTransitionError (→ 409 over REST).
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

export interface ReopenProjectResult {
  readonly projetoId: string;
  readonly newStatus: ProjetoStatus;
  readonly changed: boolean;
}

@Injectable()
export class ReopenProjectForRevisionUseCase {
  private readonly logger = new Logger(ReopenProjectForRevisionUseCase.name);

  constructor(
    @Inject(PROJETO_EDITORIAL_REPOSITORY)
    private readonly repository: ProjetoEditorialRepository,
    @Inject(PROJECT_EVENT_PUBLISHER)
    private readonly eventPublisher: IProjectEventPublisher,
  ) {}

  /**
   * Reopens a project for a new editorial revision.
   *
   * @param projetoId - target project
   * @param user      - authenticated caller; empresaId scopes the repository;
   *                    solicitadoPor is set to 'editor' in the status history
   * @returns result with projetoId, newStatus and changed flag
   * @throws {NotFoundException} when project not found in this empresa
   * @throws {IllegalStatusTransitionError} when current status is rascunho
   */
  async reopen(projetoId: string, user: UsuarioContext): Promise<ReopenProjectResult> {
    const projeto = await this.findOrThrow(projetoId, user.empresaId);

    // Delegate to VO — throws IllegalStatusTransitionError for rascunho.
    const { newStatus, changed } = ProjectStatusVO.reopen(projeto.status);

    if (!changed) {
      // Already em_composicao — idempotent no-op, no event emitted.
      return { projetoId: projeto.id, newStatus, changed: false };
    }

    // Persist the status change (P3 will also append projeto_status_historico
    // with solicitado_por=editor).
    await this.repository.updateStatus({
      id: projeto.id,
      newStatus,
      previousStatus: projeto.status,
      changedBy: 'editor',
      empresaId: user.empresaId,
    });

    // Emit ProjectStatusChanged post-persist (solicitadoPor=editor per SPEC-02).
    const event = new ProjectStatusChangedEvent({
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      projetoId: projeto.id,
      editoraId: projeto.editoraId,
      statusDe: projeto.status,
      statusPara: newStatus,
      solicitadoPor: 'editor',
    });
    this.eventPublisher.publish('ProjectStatusChanged', event);
    this.logger.log(
      `ProjetoEditorial ${projeto.id}: reopened ${projeto.status} → ${newStatus}`,
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
