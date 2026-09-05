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

/**
 * Filter for findAll (keyset-paginated listing).
 *
 * `limit` is the number of rows to fetch (the use case passes limit+1 to
 * detect whether a next page exists — the adapter never needs to know this
 * convention).
 *
 * `cursor` is an opaque string produced by the use case from the last row of
 * the previous page: base64(JSON({atualizadoEm: ISO-8601, id: UUID})).
 * The adapter decodes it and applies the keyset WHERE clause:
 *   (atualizadoEm < cursor.atualizadoEm)
 *   OR (atualizadoEm = cursor.atualizadoEm AND id > cursor.id)
 * which, combined with ORDER BY atualizadoEm DESC, id ASC, yields the items
 * that come after the cursor row.
 */
export interface ProjetoEditorialFilter {
  readonly status?: ProjetoStatus;
  /** Number of rows to return. */
  readonly limit?: number;
  /** Opaque keyset cursor produced from the last row of the previous page. */
  readonly cursor?: string;
}

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
  /** Tenant-routing key (resolves the `emp_<slug>` schema, RULE-07). */
  readonly empresaId: string;
  /** Logical reference to the editora registry (`cordele_global`) — never used for schema routing. */
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

/**
 * Input for advanceStatusAtomic — locks the row, validates the transition and
 * writes the change (if any) in a single database transaction.
 */
export interface AdvanceStatusAtomicInput {
  readonly id: string;
  readonly targetStatus: ProjetoStatus;
  /** Requesting context ('imp' | 'pub' | 'comp' | 'editor' | 'system'). */
  readonly changedBy: string;
  readonly empresaId: string;
}

/**
 * Result of advanceStatusAtomic.
 * `null` is returned when the project does not exist in this empresa.
 */
export interface AdvanceStatusAtomicResult {
  readonly data: ProjetoEditorialData;
  readonly previousStatus: ProjetoStatus;
  readonly changed: boolean;
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
   * Returns all projects for the empresa ordered by atualizadoEm DESC.
   * Optional filter narrows by status; limit and cursor are reserved for POC
   * (accepted without enforcing pagination).
   */
  findAll(
    empresaId: string,
    filter?: ProjetoEditorialFilter,
  ): Promise<ProjetoEditorialData[]>;

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

  /**
   * Hard-deletes the ProjetoEditorial row (ON DELETE CASCADE removes history
   * rows). Used only by DeleteProjetoUseCase (P6 / PROJ-016) as the final
   * step of the LGPD erasure cascade, after all cross-context purges succeed.
   */
  delete(id: string, empresaId: string): Promise<void>;

  /**
   * Atomically: acquires a SELECT FOR UPDATE row lock on the projeto, re-reads
   * its current status under the lock, validates the requested transition via
   * ProjectStatusVO, and — only when the transition produces a real change —
   * writes both the status UPDATE and the projeto_status_historico INSERT inside
   * the same Prisma $transaction (lock held until commit).
   *
   * Eliminates the TOCTOU window that existed when findById and updateStatus
   * were called in separate transactions (PROJ-004 concurrent double-emit fix).
   * Returns null when the project does not exist in this empresa.
   * Throws IllegalStatusTransitionError for illegal moves.
   */
  advanceStatusAtomic(
    input: AdvanceStatusAtomicInput,
  ): Promise<AdvanceStatusAtomicResult | null>;
}

/** DI injection token for ProjetoEditorialRepository. */
export const ProjetoEditorialRepository = Symbol('ProjetoEditorialRepository');
