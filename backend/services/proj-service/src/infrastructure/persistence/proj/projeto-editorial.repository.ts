import { Inject, Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

import type {
  ProjetoEditorialRepositoryPort,
  ProjetoEditorialData,
  CreateProjetoEditorialInput,
  UpdateStatusInput,
  ProjetoEditorialFilter,
} from '../../../domain/proj/ports/outbound/projeto-editorial-repository.port';
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
   * Returns all ProjetoEditorial rows for the empresa, ordered by
   * atualizado_em DESC.
   */
  async findAll(
    empresaId: string,
    filter?: ProjetoEditorialFilter,
  ): Promise<ProjetoEditorialData[]> {
    const rows = await this.tenantFactory.withTenant(empresaId, async (tx) => {
      return tx.projetoEditorial.findMany({
        where: filter?.status ? { status: filter.status } : undefined,
        orderBy: { atualizadoEm: 'desc' },
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
