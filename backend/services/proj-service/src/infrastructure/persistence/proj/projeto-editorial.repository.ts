import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import type {
  ProjetoEditorialRepositoryPort,
  ProjetoEditorialData,
  CreateProjetoEditorialInput,
  UpdateStatusInput,
  ProjetoEditorialFilter,
  AdvanceStatusAtomicInput,
  AdvanceStatusAtomicResult,
} from '../../../domain/proj/ports/outbound/projeto-editorial-repository.port';
import { ProjectStatusVO } from '../../../domain/proj/value-objects/project-status.vo';
import type { ProjetoStatus } from '../../../domain/proj/value-objects/project-status.vo';
import { TenantPrismaFactory } from '../tenant-prisma.factory';

// ---------------------------------------------------------------------------
// Mapper helpers (kept inline — the model is simple enough)
// ---------------------------------------------------------------------------

type PrismaProjetoRow = {
  id: string;
  editoraId: string;
  nome: string;
  status: string;
  descricao: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
};

function toData(row: PrismaProjetoRow, _empresaId: string): ProjetoEditorialData {
  return {
    id: row.id,
    nome: row.nome,
    descricao: row.descricao,
    editoraId: row.editoraId,
    // Cast: the DB CHECK constraint guarantees the value is a valid ProjetoStatus.
    status: row.status as ProjetoEditorialData['status'],
    criadoEm: row.criadoEm,
    atualizadoEm: row.atualizadoEm,
  };
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

/**
 * PrismaProjetoEditorialRepository — adapter de persistência para ProjetoEditorial.
 *
 * Implements ProjetoEditorialRepositoryPort using Prisma + schema-per-tenant.
 *
 * RULE-01: zero @prisma/client in domain.
 * RULE-05: infrastructure does not import modules/.
 * RULE-07: every operation resolves the tenant schema via TenantPrismaFactory.withTenant()
 *   which executes `SET LOCAL search_path TO emp_{slug}, public` inside the
 *   transaction. Cross-tenant isolation is physical: empresa A's schema never
 *   contains empresa B's rows.
 *
 * updateStatus writes to BOTH projeto_editorial and projeto_status_historico
 * inside the same Prisma $transaction (fulfilled by TenantPrismaFactory.withTenant).
 */
@Injectable()
export class PrismaProjetoEditorialRepository
  implements ProjetoEditorialRepositoryPort
{
  private readonly logger = new Logger(PrismaProjetoEditorialRepository.name);

  constructor(
    @Inject(TenantPrismaFactory)
    private readonly tenantFactory: TenantPrismaFactory,
  ) {}

  /**
   * Persists a new ProjetoEditorial and appends the initial
   * projeto_status_historico row (status_de = null → rascunho) in a
   * single $transaction.
   */
  async create(
    input: CreateProjetoEditorialInput,
  ): Promise<ProjetoEditorialData> {
    this.logger.log(
      `Creating ProjetoEditorial ${input.id} for empresa ${input.empresaId}`,
    );

    return this.tenantFactory.withTenant(input.empresaId, async (tx) => {
      const row = await tx.projetoEditorial.create({
        data: {
          id: input.id,
          editoraId: input.editoraId,
          nome: input.nome,
          status: input.status,
          descricao: input.descricao ?? null,
          criadoEm: new Date(),
          atualizadoEm: new Date(),
        },
      });

      // Append the creation entry to the audit history (status_de = null means "created").
      await tx.projetoStatusHistorico.create({
        data: {
          id: randomUUID(),
          projetoId: row.id,
          statusDe: null,
          statusPara: input.status,
          solicitadoPor: 'system',
          criadoEm: new Date(),
        },
      });

      this.logger.log(`ProjetoEditorial ${row.id} created`);
      return toData(row, input.editoraId);
    });
  }

  /**
   * Returns null when id does not exist OR belongs to a different empresa.
   * Tenant schema isolation guarantees cross-tenant data is never accessible:
   * withTenant sets search_path to emp_{empresaId}, so a row created in
   * emp_aetos is invisible when querying inside emp_outra.
   */
  async findById(
    id: string,
    empresaId: string,
  ): Promise<ProjetoEditorialData | null> {
    const row = await this.tenantFactory.withTenant(empresaId, async (tx) => {
      return tx.projetoEditorial.findUnique({ where: { id } });
    });

    if (!row) return null;
    return toData(row, empresaId);
  }

  /**
   * Returns ProjetoEditorial rows for the empresa ordered by
   * atualizadoEm DESC, id ASC (stable ordering required for keyset pagination).
   *
   * When filter.cursor is present the method decodes the opaque cursor string
   * (base64 JSON carrying {atualizadoEm: ISO-8601, id: UUID}) and applies the
   * keyset WHERE clause:
   *   (atualizadoEm < cursor.atualizadoEm)
   *   OR (atualizadoEm = cursor.atualizadoEm AND id > cursor.id)
   * so that the query returns items starting AFTER the cursor row.
   *
   * Cursor decoding errors (invalid base64 / bad JSON / missing fields) throw an
   * Error — the caller (use case or controller) is responsible for catching this
   * and returning HTTP 400 to the client.
   *
   * RULE-08: no $queryRaw — keyset pagination is expressed via Prisma where clauses.
   */
  async findAll(
    empresaId: string,
    filter?: ProjetoEditorialFilter,
  ): Promise<ProjetoEditorialData[]> {
    // Decode the cursor if present.
    let cursorWhere: object | undefined;
    if (filter?.cursor) {
      const raw = JSON.parse(
        Buffer.from(filter.cursor, 'base64').toString('utf-8'),
      ) as { atualizadoEm?: unknown; id?: unknown };
      if (typeof raw.atualizadoEm !== 'string' || typeof raw.id !== 'string') {
        throw new Error('Invalid pagination cursor: missing atualizadoEm or id');
      }
      const cursorDate = new Date(raw.atualizadoEm);
      cursorWhere = {
        OR: [
          { atualizadoEm: { lt: cursorDate } },
          { atualizadoEm: { equals: cursorDate }, id: { gt: raw.id } },
        ],
      };
    }

    const statusWhere = filter?.status ? { status: filter.status } : {};

    const rows = await this.tenantFactory.withTenant(empresaId, async (tx) => {
      return tx.projetoEditorial.findMany({
        where: cursorWhere
          ? { AND: [statusWhere, cursorWhere] }
          : Object.keys(statusWhere).length > 0
            ? statusWhere
            : undefined,
        orderBy: [{ atualizadoEm: 'desc' }, { id: 'asc' }],
        take: filter?.limit,
      });
    });

    return rows.map((r) => toData(r, empresaId));
  }

  /**
   * Applies a status change in a single $transaction:
   * 1. UPDATE projeto_editorial SET status = newStatus, atualizado_em = now()
   * 2. INSERT INTO projeto_status_historico (...)
   *
   * The Prisma $transaction inside TenantPrismaFactory.withTenant guarantees
   * atomicity: both writes succeed or both roll back.
   */
  async updateStatus(
    input: UpdateStatusInput,
  ): Promise<ProjetoEditorialData> {
    this.logger.log(
      `updateStatus ProjetoEditorial ${input.id}: ${input.previousStatus} → ${input.newStatus}`,
    );

    return this.tenantFactory.withTenant(input.empresaId, async (tx) => {
      const updated = await tx.projetoEditorial.update({
        where: { id: input.id },
        data: {
          status: input.newStatus,
          atualizadoEm: new Date(),
        },
      });

      await tx.projetoStatusHistorico.create({
        data: {
          id: randomUUID(),
          projetoId: input.id,
          statusDe: input.previousStatus,
          statusPara: input.newStatus,
          solicitadoPor: input.changedBy,
          criadoEm: new Date(),
        },
      });

      return toData(updated, input.empresaId);
    });
  }

  /**
   * Atomically advances the status of a ProjetoEditorial — PROJ-004 TOCTOU fix.
   *
   * Within a single Prisma $transaction (via TenantPrismaFactory.withTenant):
   *   1. SELECT ... FOR UPDATE acquires a row-level lock BEFORE reading status.
   *      Concurrent advanceTo calls for the same projetoId serialize here.
   *   2. ProjectStatusVO.advanceTo validates the transition UNDER the lock
   *      (if the first caller already committed, the second sees the new status
   *      and returns changed=false — idempotent no-op, no double-emit).
   *   3. Only on a real change: UPDATE projeto_editorial + INSERT historico
   *      in the same transaction. Lock released on commit.
   *
   * RULE-08: $queryRaw is used here (a repository method) — not in modules/.
   * Infrastructure importing domain (ProjectStatusVO) is the correct direction.
   */
  async advanceStatusAtomic(
    input: AdvanceStatusAtomicInput,
  ): Promise<AdvanceStatusAtomicResult | null> {
    this.logger.log(
      `advanceStatusAtomic ProjetoEditorial ${input.id} → ${input.targetStatus}`,
    );

    return this.tenantFactory.withTenant(input.empresaId, async (tx) => {
      // Step 1: acquire row-level lock before reading current status.
      // Prisma parameterises ${input.id} as $1; ::uuid cast handles UUID column type.
      // The schema is already resolved by TenantPrismaFactory (datasourceUrl with
      // ?schema=emp_<slug>), so table names are unqualified — no empresaId interpolation.
      const rows = await tx.$queryRaw<PrismaProjetoRow[]>`
        SELECT id,
               editora_id    AS "editoraId",
               nome,
               status,
               descricao,
               criado_em     AS "criadoEm",
               atualizado_em AS "atualizadoEm"
        FROM   projeto_editorial
        WHERE  id = ${input.id}::uuid
        FOR UPDATE
      `;

      if (rows.length === 0) {
        return null;
      }

      const locked = rows[0];
      const currentStatus = locked.status as ProjetoStatus;

      // Step 2: validate transition UNDER the lock.
      // Throws IllegalStatusTransitionError for illegal moves (same as before).
      const { newStatus, changed } = ProjectStatusVO.advanceTo(
        currentStatus,
        input.targetStatus,
      );

      if (!changed) {
        // Idempotent no-op: the second concurrent caller lands here because the
        // first already committed the status change before this lock was acquired.
        return {
          data: toData(locked, input.empresaId),
          previousStatus: currentStatus,
          changed: false,
        };
      }

      // Step 3: apply writes WITHIN the same transaction (lock still held).
      const updated = await tx.projetoEditorial.update({
        where: { id: input.id },
        data: { status: newStatus, atualizadoEm: new Date() },
      });

      await tx.projetoStatusHistorico.create({
        data: {
          id: randomUUID(),
          projetoId: input.id,
          statusDe: currentStatus,
          statusPara: newStatus,
          solicitadoPor: input.changedBy,
          criadoEm: new Date(),
        },
      });

      return {
        data: toData(updated, input.empresaId),
        previousStatus: currentStatus,
        changed: true,
      };
    });
  }

  /**
   * Hard-deletes a ProjetoEditorial; ON DELETE CASCADE removes history rows.
   * Used only by the LGPD erasure use case (P6 / PROJ-015).
   */
  async delete(id: string, empresaId: string): Promise<void> {
    await this.tenantFactory.withTenant(empresaId, async (tx) => {
      await tx.projetoEditorial.delete({ where: { id } });
    });
    this.logger.log(`ProjetoEditorial ${id} deleted (LGPD erasure)`);
  }

  /**
   * Returns false when id does not exist OR belongs to a different empresa.
   * Used by ProjetoEditorialLookup (cross-context tenancy gate).
   */
  async existsByIdAndEmpresa(
    id: string,
    empresaId: string,
  ): Promise<boolean> {
    const row = await this.tenantFactory.withTenant(empresaId, async (tx) => {
      return tx.projetoEditorial.findUnique({
        where: { id },
        select: { id: true },
      });
    });
    return row !== null;
  }
}
