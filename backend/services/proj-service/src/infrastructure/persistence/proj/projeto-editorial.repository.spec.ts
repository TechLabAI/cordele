/**
 * PrismaProjetoEditorialRepository — unit tests with Prisma mock.
 *
 * These tests verify:
 * 1. create() persists ProjetoEditorial and inserts initial history row in a
 *    single transaction.
 * 2. findById() returns null for an unknown id.
 * 3. findById() returns the project when found in the empresa's schema.
 * 4. findById() returns null for a project belonging to a different empresa
 *    (tenant isolation — withTenant called with the correct empresaId).
 * 5. updateStatus() writes to BOTH projeto_editorial and
 *    projeto_status_historico in a single transaction.
 * 6. findAll() delegates ordering to the adapter (orderBy: atualizadoEm desc).
 * 7. delete() removes the row from the tenant's schema.
 * 8. existsByIdAndEmpresa() returns false for unknown id.
 *
 * TenantPrismaFactory is mocked at unit-test level: withTenant(empresaId, fn)
 * passes a fake transaction proxy to fn, verifying that the adapter always
 * calls withTenant with the correct empresaId (key for tenant isolation).
 */

import { PrismaProjetoEditorialRepository } from './projeto-editorial.repository';
import { TenantPrismaFactory } from '../tenant-prisma.factory';
import { ProjetoStatus } from '../../../domain/proj/value-objects/project-status.vo';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal mock Prisma transaction proxy. */
function makeTx(overrides: {
  projetoEditorial?: Partial<{
    create: jest.Mock;
    findUnique: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  }>;
  projetoStatusHistorico?: Partial<{ create: jest.Mock }>;
}) {
  return {
    projetoEditorial: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      ...overrides.projetoEditorial,
    },
    projetoStatusHistorico: {
      create: jest.fn(),
      ...overrides.projetoStatusHistorico,
    },
  } as unknown as Parameters<Parameters<TenantPrismaFactory['withTenant']>[1]>[0];
}

/** Minimal ProjetoEditorial row as Prisma would return it. */
function makeRow(partial: Partial<{
  id: string;
  editoraId: string;
  nome: string;
  status: string;
  descricao: string | null;
  criadoEm: Date;
  atualizadoEm: Date;
}> = {}) {
  return {
    id: partial.id ?? 'uuid-projeto-001',
    editoraId: partial.editoraId ?? 'uuid-editora-aetos',
    nome: partial.nome ?? 'Projeto de Teste',
    status: partial.status ?? ProjetoStatus.rascunho,
    descricao: partial.descricao ?? null,
    criadoEm: partial.criadoEm ?? new Date('2026-01-01T00:00:00Z'),
    atualizadoEm: partial.atualizadoEm ?? new Date('2026-01-01T00:00:00Z'),
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('PrismaProjetoEditorialRepository', () => {
  let repo: PrismaProjetoEditorialRepository;
  let mockTenantFactory: jest.Mocked<Pick<TenantPrismaFactory, 'withTenant'>>;

  beforeEach(() => {
    mockTenantFactory = {
      withTenant: jest.fn(),
    };
    repo = new PrismaProjetoEditorialRepository(
      mockTenantFactory as unknown as TenantPrismaFactory,
    );
  });

  // -------------------------------------------------------------------------
  // create()
  // -------------------------------------------------------------------------
  describe('create()', () => {
    it('deve persistir ProjetoEditorial e inserir historico inicial na mesma transacao', async () => {
      const projetoCreate = jest.fn().mockResolvedValue(makeRow());
      const historicoCreate = jest.fn().mockResolvedValue({});
      const tx = makeTx({
        projetoEditorial: { create: projetoCreate },
        projetoStatusHistorico: { create: historicoCreate },
      });

      mockTenantFactory.withTenant.mockImplementation(
        async (_empresaId, fn) => fn(tx),
      );

      const result = await repo.create({
        id: 'uuid-projeto-001',
        nome: 'Projeto de Teste',
        descricao: undefined,
        empresaId: 'aetos',
        editoraId: 'uuid-editora-aetos',
        status: ProjetoStatus.rascunho,
      });

      expect(projetoCreate).toHaveBeenCalledTimes(1);
      expect(historicoCreate).toHaveBeenCalledTimes(1);

      // History row must have status_de = null and status_para = rascunho
      const histArg = historicoCreate.mock.calls[0][0] as { data: { statusDe: unknown; statusPara: string } };
      expect(histArg.data.statusDe).toBeNull();
      expect(histArg.data.statusPara).toBe(ProjetoStatus.rascunho);

      // Result matches what the DB row contains
      expect(result.id).toBe('uuid-projeto-001');
      expect(result.status).toBe(ProjetoStatus.rascunho);
    });

    it('deve chamar withTenant com o empresaId correto (nao o editoraId)', async () => {
      const tx = makeTx({
        projetoEditorial: { create: jest.fn().mockResolvedValue(makeRow()) },
        projetoStatusHistorico: { create: jest.fn().mockResolvedValue({}) },
      });
      mockTenantFactory.withTenant.mockImplementation(async (_e, fn) => fn(tx));

      await repo.create({
        id: 'uuid-1',
        nome: 'Projeto X',
        empresaId: 'emp-slug-aetos',
        editoraId: 'uuid-editora-aetos',
        status: ProjetoStatus.rascunho,
      });

      expect(mockTenantFactory.withTenant).toHaveBeenCalledWith(
        'emp-slug-aetos',
        expect.any(Function),
      );
    });
  });

  // -------------------------------------------------------------------------
  // findById()
  // -------------------------------------------------------------------------
  describe('findById()', () => {
    it('deve retornar null quando id nao encontrado na empresa', async () => {
      const tx = makeTx({
        projetoEditorial: { findUnique: jest.fn().mockResolvedValue(null) },
      });
      mockTenantFactory.withTenant.mockImplementation(async (_e, fn) => fn(tx));

      const result = await repo.findById('id-inexistente', 'aetos');

      expect(result).toBeNull();
    });

    it('deve retornar os dados do projeto quando encontrado', async () => {
      const row = makeRow({ id: 'uuid-abc', nome: 'Meu Livro' });
      const tx = makeTx({
        projetoEditorial: { findUnique: jest.fn().mockResolvedValue(row) },
      });
      mockTenantFactory.withTenant.mockImplementation(async (_e, fn) => fn(tx));

      const result = await repo.findById('uuid-abc', 'aetos');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('uuid-abc');
      expect(result?.nome).toBe('Meu Livro');
    });

    it('deve retornar null para projeto de outra empresa (tenant isolation)', async () => {
      // Empresa B's schema does not contain empresa A's row:
      // withTenant('empresa-b', ...) sets search_path to emp_empresa-b.
      // The mock simulates that findUnique returns null (row not in that schema).
      const tx = makeTx({
        projetoEditorial: { findUnique: jest.fn().mockResolvedValue(null) },
      });
      mockTenantFactory.withTenant.mockImplementation(async (_e, fn) => fn(tx));

      const result = await repo.findById('uuid-empresa-a-projeto', 'empresa-b');

      // Must return null
      expect(result).toBeNull();
      // Critically: withTenant must be called with empresa-b, NOT empresa-a
      expect(mockTenantFactory.withTenant).toHaveBeenCalledWith(
        'empresa-b',
        expect.any(Function),
      );
    });
  });

  // -------------------------------------------------------------------------
  // findAll()
  // -------------------------------------------------------------------------
  describe('findAll()', () => {
    it('deve retornar lista de projetos ordenados por atualizadoEm DESC', async () => {
      const rows = [
        makeRow({ id: 'p2', atualizadoEm: new Date('2026-02-01') }),
        makeRow({ id: 'p1', atualizadoEm: new Date('2026-01-01') }),
      ];
      const findMany = jest.fn().mockResolvedValue(rows);
      const tx = makeTx({ projetoEditorial: { findMany } });
      mockTenantFactory.withTenant.mockImplementation(async (_e, fn) => fn(tx));

      const result = await repo.findAll('aetos');

      expect(result).toHaveLength(2);
      // Ordering is delegated to Prisma — verify it was requested
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { atualizadoEm: 'desc' } }),
      );
    });

    it('deve filtrar por status quando informado', async () => {
      const findMany = jest.fn().mockResolvedValue([]);
      const tx = makeTx({ projetoEditorial: { findMany } });
      mockTenantFactory.withTenant.mockImplementation(async (_e, fn) => fn(tx));

      await repo.findAll('aetos', { status: ProjetoStatus.em_composicao });

      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: ProjetoStatus.em_composicao },
        }),
      );
    });
  });

  // -------------------------------------------------------------------------
  // updateStatus()
  // -------------------------------------------------------------------------
  describe('updateStatus()', () => {
    it('deve gravar nas duas tabelas em uma unica transacao', async () => {
      const projetoUpdate = jest.fn().mockResolvedValue(
        makeRow({ status: ProjetoStatus.em_composicao }),
      );
      const historicoCreate = jest.fn().mockResolvedValue({});
      const tx = makeTx({
        projetoEditorial: { update: projetoUpdate },
        projetoStatusHistorico: { create: historicoCreate },
      });
      mockTenantFactory.withTenant.mockImplementation(async (_e, fn) => fn(tx));

      const result = await repo.updateStatus({
        id: 'uuid-projeto-001',
        newStatus: ProjetoStatus.em_composicao,
        previousStatus: ProjetoStatus.rascunho,
        changedBy: 'imp',
        empresaId: 'aetos',
      });

      // Both writes must happen exactly once
      expect(projetoUpdate).toHaveBeenCalledTimes(1);
      expect(historicoCreate).toHaveBeenCalledTimes(1);

      // History row must record the transition correctly
      const histArg = historicoCreate.mock.calls[0][0] as {
        data: { statusDe: string; statusPara: string; solicitadoPor: string };
      };
      expect(histArg.data.statusDe).toBe(ProjetoStatus.rascunho);
      expect(histArg.data.statusPara).toBe(ProjetoStatus.em_composicao);
      expect(histArg.data.solicitadoPor).toBe('imp');

      // Return value reflects the new status
      expect(result.status).toBe(ProjetoStatus.em_composicao);
    });

    it('deve chamar withTenant com o empresaId correto', async () => {
      const tx = makeTx({
        projetoEditorial: {
          update: jest.fn().mockResolvedValue(makeRow({ status: 'publicado' })),
        },
        projetoStatusHistorico: { create: jest.fn().mockResolvedValue({}) },
      });
      mockTenantFactory.withTenant.mockImplementation(async (_e, fn) => fn(tx));

      await repo.updateStatus({
        id: 'uuid-1',
        newStatus: ProjetoStatus.publicado,
        previousStatus: ProjetoStatus.em_composicao,
        changedBy: 'pub',
        empresaId: 'slug-empresa-x',
      });

      expect(mockTenantFactory.withTenant).toHaveBeenCalledWith(
        'slug-empresa-x',
        expect.any(Function),
      );
    });
  });

  // -------------------------------------------------------------------------
  // delete()
  // -------------------------------------------------------------------------
  describe('delete()', () => {
    it('deve invocar delete do Prisma dentro do tenant correto', async () => {
      const projetoDelete = jest.fn().mockResolvedValue({});
      const tx = makeTx({ projetoEditorial: { delete: projetoDelete } });
      mockTenantFactory.withTenant.mockImplementation(async (_e, fn) => fn(tx));

      await repo.delete('uuid-to-delete', 'aetos');

      expect(mockTenantFactory.withTenant).toHaveBeenCalledWith(
        'aetos',
        expect.any(Function),
      );
      expect(projetoDelete).toHaveBeenCalledWith({ where: { id: 'uuid-to-delete' } });
    });
  });

  // -------------------------------------------------------------------------
  // existsByIdAndEmpresa()
  // -------------------------------------------------------------------------
  describe('existsByIdAndEmpresa()', () => {
    it('deve retornar false para id inexistente', async () => {
      const tx = makeTx({
        projetoEditorial: { findUnique: jest.fn().mockResolvedValue(null) },
      });
      mockTenantFactory.withTenant.mockImplementation(async (_e, fn) => fn(tx));

      const result = await repo.existsByIdAndEmpresa('id-nao-existe', 'aetos');

      expect(result).toBe(false);
    });

    it('deve retornar true quando projeto existe na empresa', async () => {
      const tx = makeTx({
        projetoEditorial: {
          findUnique: jest.fn().mockResolvedValue({ id: 'uuid-1' }),
        },
      });
      mockTenantFactory.withTenant.mockImplementation(async (_e, fn) => fn(tx));

      const result = await repo.existsByIdAndEmpresa('uuid-1', 'aetos');

      expect(result).toBe(true);
    });

    it('deve retornar false para projeto de outra empresa (tenant isolation)', async () => {
      // Checking empresa-b for empresa-a's ID → empresa-b's schema has no such row
      const tx = makeTx({
        projetoEditorial: { findUnique: jest.fn().mockResolvedValue(null) },
      });
      mockTenantFactory.withTenant.mockImplementation(async (_e, fn) => fn(tx));

      const result = await repo.existsByIdAndEmpresa('uuid-empresa-a', 'empresa-b');

      expect(result).toBe(false);
      expect(mockTenantFactory.withTenant).toHaveBeenCalledWith(
        'empresa-b',
        expect.any(Function),
      );
    });
  });
});
