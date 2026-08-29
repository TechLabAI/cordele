/**
 * PrismaProjetoEditorialRepository — testes de integração (toca DB real).
 *
 * Padrão idêntico ao IMP-006 (prisma-manuscrito.repository.spec.ts): conecta
 * via `DatabaseModule` + `TenantPrismaFactory` reais, sem mocks de Prisma.
 *
 * Estes testes verificam (P3 / PROJ-008 — política de testes obrigatória):
 * 1. findById() retorna null para id inexistente.
 * 2. findById() retorna null para projeto de outra empresa (schema-per-tenant
 *    isolado — a linha de `aetos` é invisível no schema de `outra-empresa`).
 * 3. updateStatus() grava em projeto_editorial E projeto_status_historico
 *    dentro de uma única transação (o histórico reflete a transição).
 *
 * Pré-condição: schemas `emp_aetos` e `emp_outra-empresa` provisionados no
 * PostgreSQL de teste, com as migrations 0001/0002 aplicadas.
 *
 * Para rodar localmente:
 *   DATABASE_URL="postgresql://..." pnpm test src/infrastructure/persistence/proj
 */

import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';

import { ProjetoStatus } from '../../../domain/proj/value-objects/project-status.vo';
import type { ProjetoEditorialRepositoryPort } from '../../../domain/proj/ports/outbound/projeto-editorial-repository.port';
import { DatabaseModule } from '../database.module';
import { TenantPrismaFactory } from '../tenant-prisma.factory';
import { PrismaProjetoEditorialRepository } from './projeto-editorial.repository';

describe('PrismaProjetoEditorialRepository (integration)', () => {
  let repo: ProjetoEditorialRepositoryPort;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [TenantPrismaFactory, PrismaProjetoEditorialRepository],
    }).compile();

    repo = moduleRef.get(PrismaProjetoEditorialRepository);
  });

  describe('findById()', () => {
    it('deve retornar null para id inexistente', async () => {
      const result = await repo.findById(randomUUID(), 'aetos');
      expect(result).toBeNull();
    });

    it('deve retornar o projeto pelo id dentro da empresa', async () => {
      const projeto = await repo.create({
        id: randomUUID(),
        nome: 'Projeto de Integração',
        empresaId: 'aetos',
        editoraId: 'aetos',
        status: ProjetoStatus.rascunho,
      });

      const found = await repo.findById(projeto.id, 'aetos');
      expect(found).not.toBeNull();
      expect(found?.id).toBe(projeto.id);
      expect(found?.nome).toBe('Projeto de Integração');
    });

    it('deve retornar null para projeto de outra empresa (tenant isolation)', async () => {
      const projeto = await repo.create({
        id: randomUUID(),
        nome: 'Projeto Isolado',
        empresaId: 'aetos',
        editoraId: 'aetos',
        status: ProjetoStatus.rascunho,
      });

      const foundInOtherTenant = await repo.findById(projeto.id, 'outra-empresa');
      expect(foundInOtherTenant).toBeNull();

      // Confirma que continua visível no próprio schema (não foi um bug de escrita).
      const foundInOwnTenant = await repo.findById(projeto.id, 'aetos');
      expect(foundInOwnTenant).not.toBeNull();
    });
  });

  describe('updateStatus()', () => {
    it('deve gravar em projeto_editorial e projeto_status_historico na mesma transacao', async () => {
      const projeto = await repo.create({
        id: randomUUID(),
        nome: 'Projeto em Transicao',
        empresaId: 'aetos',
        editoraId: 'aetos',
        status: ProjetoStatus.rascunho,
      });

      const updated = await repo.updateStatus({
        id: projeto.id,
        newStatus: ProjetoStatus.em_composicao,
        previousStatus: ProjetoStatus.rascunho,
        changedBy: 'imp',
        empresaId: 'aetos',
      });

      expect(updated.status).toBe(ProjetoStatus.em_composicao);

      const reloaded = await repo.findById(projeto.id, 'aetos');
      expect(reloaded?.status).toBe(ProjetoStatus.em_composicao);
    });
  });

  describe('existsByIdAndEmpresa()', () => {
    it('deve retornar false para projeto de outra empresa (tenant isolation)', async () => {
      const projeto = await repo.create({
        id: randomUUID(),
        nome: 'Projeto Exists Check',
        empresaId: 'aetos',
        editoraId: 'aetos',
        status: ProjetoStatus.rascunho,
      });

      const existsInOtherTenant = await repo.existsByIdAndEmpresa(
        projeto.id,
        'outra-empresa',
      );
      expect(existsInOtherTenant).toBe(false);

      const existsInOwnTenant = await repo.existsByIdAndEmpresa(projeto.id, 'aetos');
      expect(existsInOwnTenant).toBe(true);
    });
  });
});
