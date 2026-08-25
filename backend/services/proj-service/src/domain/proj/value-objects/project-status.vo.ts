/**
 * ProjetoStatus value object — the sole authority on legal status transitions
 * for a ProjetoEditorial (ADR-002 / api-contract §7).
 *
 * Pure domain code: zero @nestjs/* and zero @prisma/client imports (RULE-01 / RULE-02).
 * The controller and application service NEVER re-encode transition rules; they
 * delegate entirely to this VO.
 *
 * Legal-transition table (api-contract §7):
 *
 *   advanceTo:
 *     rascunho      → em_composicao   (IMP confirms structure)
 *     em_composicao → publicado        (PUB export valid / with warnings)
 *     em_composicao → com_erros        (PUB export failed epubcheck)
 *     publicado     → com_erros        (a later PUB export failed)
 *     com_erros     → publicado        (a later PUB export succeeded)
 *
 *   reopen (backward edge — only the editor):
 *     publicado  → em_composicao
 *     com_erros  → em_composicao
 */

import { IllegalStatusTransitionError } from '../errors/illegal-status-transition.error';

/** Fixed status set for ProjetoEditorial (doc 06 A6). */
export enum ProjetoStatus {
  rascunho = 'rascunho',
  em_composicao = 'em_composicao',
  publicado = 'publicado',
  com_erros = 'com_erros',
}

/** Return type for forward and backward transitions. */
export interface TransitionResult {
  readonly newStatus: ProjetoStatus;
  /** `false` when the aggregate was already at the target status (idempotent no-op). */
  readonly changed: boolean;
}

/**
 * Static value object encoding the complete status-machine for ProjetoEditorial.
 */
export class ProjectStatusVO {
  /**
   * Forward (monotonic) transition, used by IMP and PUB.
   *
   * Idempotent: `advanceTo(X, X)` returns `{ newStatus: X, changed: false }` for
   * any status that is a valid target without throwing. The IMP confirm-estrutura
   * flow in particular relies on `advanceTo(em_composicao, em_composicao)` being
   * a safe no-op (SPEC-02 / SPEC-05).
   *
   * @throws IllegalStatusTransitionError when the transition is not in the legal table.
   */
  static advanceTo(
    current: ProjetoStatus,
    target: ProjetoStatus,
  ): TransitionResult {
    // Idempotent no-op: already at target.
    if (current === target) {
      return { newStatus: current, changed: false };
    }

    // Validate that the target is reachable from current via the advanceTo table.
    if (!ProjectStatusVO.isLegalAdvance(current, target)) {
      throw new IllegalStatusTransitionError(
        current,
        target,
        `The transition ${current} → ${target} is not permitted by the legal-transition table.`,
      );
    }

    return { newStatus: target, changed: true };
  }

  /**
   * Backward edge — re-opens a published or erred project for a new revision.
   * Only the editor may call this; IMP and PUB must use `advanceTo`.
   *
   * Idempotent: if already `em_composicao` returns `changed=false`.
   *
   * @throws IllegalStatusTransitionError when current is `rascunho`.
   */
  static reopen(current: ProjetoStatus): TransitionResult {
    if (current === ProjetoStatus.em_composicao) {
      // Already in the target state — idempotent no-op.
      return { newStatus: ProjetoStatus.em_composicao, changed: false };
    }

    if (
      current === ProjetoStatus.publicado ||
      current === ProjetoStatus.com_erros
    ) {
      return { newStatus: ProjetoStatus.em_composicao, changed: true };
    }

    // rascunho cannot be reopened — it was never closed.
    throw new IllegalStatusTransitionError(
      current,
      ProjetoStatus.em_composicao,
      `Cannot reopen a project in status '${current}'. Only publicado or com_erros projects can be reopened.`,
    );
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Encodes the 5 legal forward transitions from api-contract §7.
   */
  private static isLegalAdvance(
    from: ProjetoStatus,
    to: ProjetoStatus,
  ): boolean {
    const legalAdvances: Partial<Record<ProjetoStatus, ProjetoStatus[]>> = {
      [ProjetoStatus.rascunho]: [ProjetoStatus.em_composicao],
      [ProjetoStatus.em_composicao]: [
        ProjetoStatus.publicado,
        ProjetoStatus.com_erros,
      ],
      [ProjetoStatus.publicado]: [ProjetoStatus.com_erros],
      [ProjetoStatus.com_erros]: [ProjetoStatus.publicado],
    };

    return legalAdvances[from]?.includes(to) ?? false;
  }
}
