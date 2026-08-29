/**
 * Outbound port: ProjetoEditorialRepositoryPort
 *
 * Pure domain interface for ProjetoEditorial persistence.
 *
 * RULE-01: zero @prisma/client imports.
 * RULE-02: zero @nestjs/* imports.
 * RULE-07: every operation requires empresaId to enforce tenant isolation.
 *
 * The Prisma adapter (PrismaProjetoEditorialRepository) implementing this port
 * lives in src/infrastructure/persistence/proj/ and is bound via P3 (PROJ-008).
 *
 * Method signatures pass empresaId explicitly so:
 *  - P2 use cases (which receive it from UsuarioContext) can call without a
 *    populated AsyncLocalStorage (P5 will wire that middleware).
 *  - The adapter passes it to TenantPrismaFactory.withTenant() to select the
 *    correct Postgres schema — never a hard-coded schema name (RULE-07).
 */

import type { ProjetoStatus } from '../../value-objects/project-status.vo';

// ---------------------------------------------------------------------------
// Data shapes (pure value objects — no Prisma, no Nest)
// ---------------------------------------------------------------------------

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

/**
 * Input for the updateStatus operation.
 * The adapter persists to projeto_editorial AND appends a
 * projeto_status_historico row inside a single Prisma $transaction.
 */
export interface UpdateStatusInput {
  readonly id: string;
  readonly newStatus: ProjetoStatus;
  readonly previousStatus: ProjetoStatus;
  /** Requesting context: 'imp' | 'pub' | 'comp' | 'editor' | 'system'. */
  readonly changedBy: string;
  readonly empresaId: string;
}

/** Filter for findAll (cursored listing). */
export interface ProjetoEditorialFilter {
  readonly status?: ProjetoStatus;
  readonly limit?: number;
}

// ---------------------------------------------------------------------------
// Port interface
// ---------------------------------------------------------------------------

export interface ProjetoEditorialRepositoryPort {
  /**
   * Persists a new ProjetoEditorial row and inserts the initial
   * projeto_status_historico entry (status_de = null → rascunho) in a
   * single $transaction.
   */
  create(input: CreateProjetoEditorialInput): Promise<ProjetoEditorialData>;

  /**
   * Returns null when id does not exist OR belongs to a different empresa
   * (schema isolation ensures cross-tenant data is never visible).
   */
  findById(id: string, empresaId: string): Promise<ProjetoEditorialData | null>;

  /**
   * Returns all ProjetoEditorial rows for the empresa, ordered by
   * atualizado_em DESC (index idx_projeto_editorial_atualizado_em).
   */
  findAll(
    empresaId: string,
    filter?: ProjetoEditorialFilter,
  ): Promise<ProjetoEditorialData[]>;

  /**
   * Applies a status change in a single $transaction that also appends a
   * projeto_status_historico row. Never called for idempotent no-ops
   * (the use case guards that before calling here).
   */
  updateStatus(input: UpdateStatusInput): Promise<ProjetoEditorialData>;

  /**
   * Hard-deletes a ProjetoEditorial and, via ON DELETE CASCADE in the DB,
   * removes all its projeto_status_historico rows.
   * Used exclusively by the LGPD erasure use case (P6 / PROJ-015).
   */
  delete(id: string, empresaId: string): Promise<void>;

  /**
   * Returns false when id does not exist OR belongs to a different empresa.
   * Used by ProjetoEditorialLookup (cross-context tenancy gate, PROJ-006).
   */
  existsByIdAndEmpresa(id: string, empresaId: string): Promise<boolean>;
}

/** DI injection token for ProjetoEditorialRepositoryPort. */
export const ProjetoEditorialRepositoryPort = Symbol(
  'ProjetoEditorialRepositoryPort',
);
