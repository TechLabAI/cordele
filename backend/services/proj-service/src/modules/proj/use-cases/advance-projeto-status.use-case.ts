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

import { type ProjetoStatus } from '../../../domain/proj/value-objects/project-status.vo';
import { ProjectStatusChangedEvent } from '../../../domain/proj/events/project-status-changed.event';
import {
  type ProjetoEditorialRepository,
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
   * PROJ-004 TOCTOU fix: delegates to repository.advanceStatusAtomic which
   * acquires a SELECT FOR UPDATE lock, re-validates the transition under the
   * lock, and writes the change in a single transaction. Concurrent calls for
   * the same projetoId serialize at the DB row lock — at most one commits
   * changed=true; subsequent ones see the already-advanced status and return
   * changed=false (idempotent no-op) without emitting an event.
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
    // Derive the requesting context from the target status.
    // advance-status is called by IMP (→ em_composicao) or PUB (→ publicado / com_erros).
    // The DB constraint chk_psh_solicitante allows only: imp | pub | comp | editor | system.
    const solicitadoPor: string =
      input.targetStatus === 'em_composicao' ? 'imp' : 'pub';

    // Single atomic operation: SELECT FOR UPDATE → validate → write (or no-op).
    const result = await this.repository.advanceStatusAtomic({
      id: input.projetoId,
      targetStatus: input.targetStatus,
      changedBy: solicitadoPor,
      empresaId: user.empresaId,
    });

    if (result === null) {
      throw new NotFoundException(
        `ProjetoEditorial ${input.projetoId} not found in this empresa`,
      );
    }

    if (!result.changed) {
      // Idempotent no-op: nothing persisted, no event emitted.
      return { projetoId: result.data.id, newStatus: result.data.status, changed: false };
    }

    // Emit ProjectStatusChanged post-persist (application service responsibility).
    const event = new ProjectStatusChangedEvent({
      eventId: randomUUID(),
      occurredAt: new Date().toISOString(),
      projetoId: result.data.id,
      editoraId: result.data.editoraId,
      statusDe: result.previousStatus,
      statusPara: result.data.status,
      solicitadoPor,
    });
    this.eventPublisher.publish('ProjectStatusChanged', event);
    this.logger.log(
      `ProjetoEditorial ${result.data.id}: ${result.previousStatus} → ${result.data.status}`,
    );

    return { projetoId: result.data.id, newStatus: result.data.status, changed: true };
  }
}
