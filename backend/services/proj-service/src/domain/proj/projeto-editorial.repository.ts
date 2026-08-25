/**
 * Outbound port for ProjetoEditorial persistence.
 *
 * Pure domain interface — zero @nestjs/* and zero @prisma/client imports
 * (RULE-01 / RULE-02). The Prisma adapter implementing this interface is bound
 * in P3 (PROJ-007 / PROJ-008). P2 use cases receive the mock in unit tests.
 *
 * Every operation is scoped by empresaId — no cross-empresa read path exists by
 * design (ADR-003).
 */

import { ProjetoStatus } from './value-objects/project-status.vo';

/** Read model returned by all repository operations. */
export interface ProjetoEditorialData {
  readonly id: string;
  readonly nome: string;
  readonly descricao?: string | null;
  readonly editoraId: string;
  readonly status: ProjetoStatus;
  readonly criadoEm: Date;
  readonly atualizadoEm: Date;
}

/** Input for creating a new project row. */
export interface CreateProjetoEditorialInput {
  readonly id: string;
  readonly nome: string;
  readonly descricao?: string;
  readonly editoraId: string;
  readonly status: ProjetoStatus;
}

/** Input for the updateStatus operation (P3 will persist to projeto_status_historico too). */
export interface UpdateStatusInput {
  readonly id: string;
  readonly newStatus: ProjetoStatus;
  readonly previousStatus: ProjetoStatus;
  readonly changedBy: string;
  readonly empresaId: string;
}

export interface ProjetoEditorialRepository {
  /**
   * Persists a new ProjetoEditorial row (and its initial status-history entry
   * in P3, where the Prisma adapter runs both writes in a $transaction).
   */
  create(input: CreateProjetoEditorialInput): Promise<ProjetoEditorialData>;

  /** Returns null when id does not exist OR belongs to a different empresa. */
  findById(id: string, empresaId: string): Promise<ProjetoEditorialData | null>;

  /**
   * Applies a status change in a single $transaction (P3) that also appends
   * a projeto_status_historico row.
   */
  updateStatus(input: UpdateStatusInput): Promise<ProjetoEditorialData>;

  /**
   * Returns false when id does not exist OR belongs to a different empresa.
   * Used by ProjetoEditorialLookup (cross-tenant safety gate).
   */
  existsByIdAndEmpresa(id: string, empresaId: string): Promise<boolean>;
}

/** DI injection token for ProjetoEditorialRepository. */
export const ProjetoEditorialRepository = Symbol('ProjetoEditorialRepository');
