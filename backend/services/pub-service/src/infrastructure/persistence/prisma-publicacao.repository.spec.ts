/**
 * PrismaPublicacaoRepository — testes de integração.
 *
 * Verifica:
 * 1. `save()` cria uma nova publicacao em status `gerando`.
 * 2. `save()` atualiza o status de uma publicacao em voo (gerando → validando).
 * 3. `findInFlight()` retorna somente a row com status gerando ou validando.
 * 4. `findInFlight()` retorna null quando não há build em voo (ou é terminal).
 * 5. `nextSequencia()` retorna 1 para o primeiro attempt; 2 para o segundo.
 * 6. `findById()` retorna null para id inexistente ou projetoId errado.
 * 7. `listByProjeto()` retorna todas as publicacoes em ordem decrescente de sequencia.
 *
 * Pré-condição: schema `emp_aetos` provisionado no PostgreSQL de teste com as
 * tabelas `publicacao` e `validation_message` (migration V0001 aplicada).
 *
 * Para rodar localmente:
 *   DATABASE_URL="postgresql://..." pnpm test src/infrastructure/persistence
 *
 * TODO[P3]: integrar com Testcontainers (PostgreSQL 16) quando o ambiente CI
 * estiver configurado. O módulo DatabaseModule e PrismaService são suficientes
 * para rodar em ambiente com DATABASE_URL válido.
 */

import { randomUUID } from 'node:crypto';

import { Test } from '@nestjs/testing';

import { PublicacaoEntity } from '../../domain/pub/publicacao.entity';
import { EpubcheckStatus } from '../../domain/pub/epubcheck-status.enum';
import { PublicacaoStatus } from '../../domain/pub/publicacao-status.enum';
import type { PublicacaoRepositoryPort } from '../../domain/pub/ports/publicacao-repository.port';
import { DatabaseModule } from './database.module';
import { PrismaService } from './prisma.service';
import { PrismaPublicacaoRepository } from './prisma-publicacao.repository';

/** Constrói uma PublicacaoEntity mínima válida no estado `gerando`. */
function buildPublicacao(overrides: Partial<Parameters<typeof PublicacaoEntity.iniciar>[0]> = {}): PublicacaoEntity {
  return PublicacaoEntity.iniciar({
    id: randomUUID(),
    projetoId: randomUUID(),
    sequencia: 1,
    iniciadaEm: new Date(),
    ...overrides,
  });
}

describe('PrismaPublicacaoRepository (integration)', () => {
  let repo: PublicacaoRepositoryPort;
  let prisma: PrismaService;
  const createdProjetoIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule],
      providers: [PrismaPublicacaoRepository],
    }).compile();

    repo = moduleRef.get(PrismaPublicacaoRepository);
    prisma = moduleRef.get(PrismaService);
  });

  afterAll(async () => {
    // `publicacao.projeto_id` FKs into `projeto_editorial` (PROJ context, same
    // schema); ON DELETE CASCADE takes the publicacao rows with it.
    if (createdProjetoIds.length > 0) {
      await prisma.$executeRaw`DELETE FROM projeto_editorial WHERE id = ANY(${createdProjetoIds}::uuid[])`;
    }
  });

  /** Cria o projeto_editorial pai exigido por `fk_publicacao_projeto` antes de salvar uma publicacao de teste. */
  async function seedProjetoEditorial(projetoId: string): Promise<void> {
    createdProjetoIds.push(projetoId);
    await prisma.$executeRaw`
      INSERT INTO projeto_editorial (id, editora_id, nome)
      VALUES (${projetoId}::uuid, ${randomUUID()}::uuid, 'PUB integration test fixture')
    `;
  }

  describe('nextSequencia()', () => {
    it('deve retornar 1 quando nenhuma publicacao existe para o projeto', async () => {
      const projetoId = randomUUID();
      const seq = await repo.nextSequencia(projetoId);
      expect(seq).toBe(1);
    });

    it('deve retornar 2 após o primeiro attempt', async () => {
      const projetoId = randomUUID();
      await seedProjetoEditorial(projetoId);
      const pub = buildPublicacao({ projetoId, sequencia: 1 });
      await repo.save(pub);

      const seq = await repo.nextSequencia(projetoId);
      expect(seq).toBe(2);
    });
  });

  describe('save()', () => {
    it('deve criar e retornar a publicacao com o id e status corretos', async () => {
      const pub = buildPublicacao();
      await seedProjetoEditorial(pub.projetoId);
      const saved = await repo.save(pub);

      expect(saved.id).toBe(pub.id);
      expect(saved.projetoId).toBe(pub.projetoId);
      expect(saved.status).toBe(PublicacaoStatus.GERANDO);
      expect(saved.epubcheckStatus).toBe(EpubcheckStatus.PENDENTE);
      expect(saved.sequencia).toBe(pub.sequencia);
    });

    it('deve atualizar o status gerando → validando ao salvar novamente', async () => {
      const gerando = buildPublicacao();
      await seedProjetoEditorial(gerando.projetoId);
      await repo.save(gerando);

      const validando = gerando.iniciarValidacao();
      const saved = await repo.save(validando);

      expect(saved.id).toBe(gerando.id);
      expect(saved.status).toBe(PublicacaoStatus.VALIDANDO);
    });
  });

  describe('findInFlight()', () => {
    it('deve retornar null quando não há build em voo', async () => {
      const projetoId = randomUUID();
      const result = await repo.findInFlight(projetoId);
      expect(result).toBeNull();
    });

    it('deve retornar a publicacao em gerando', async () => {
      const projetoId = randomUUID();
      await seedProjetoEditorial(projetoId);
      const pub = buildPublicacao({ projetoId });
      await repo.save(pub);

      const found = await repo.findInFlight(projetoId);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(pub.id);
      expect(found?.status).toBe(PublicacaoStatus.GERANDO);
    });

    it('deve retornar a publicacao em validando', async () => {
      const projetoId = randomUUID();
      await seedProjetoEditorial(projetoId);
      const gerando = buildPublicacao({ projetoId });
      await repo.save(gerando);
      const validando = gerando.iniciarValidacao();
      await repo.save(validando);

      const found = await repo.findInFlight(projetoId);
      expect(found?.status).toBe(PublicacaoStatus.VALIDANDO);
    });

    it('deve retornar null quando o único build está terminal (com_erros)', async () => {
      const projetoId = randomUUID();
      await seedProjetoEditorial(projetoId);
      const gerando = buildPublicacao({ projetoId });
      await repo.save(gerando);
      const validando = gerando.iniciarValidacao();
      await repo.save(validando);
      const comErros = validando.concluirComErros({
        resumoErro: 'Test error',
        totalErros: 1,
        totalAvisos: 0,
        concluidaEm: new Date(),
      });
      await repo.save(comErros);

      const found = await repo.findInFlight(projetoId);
      expect(found).toBeNull();
    });
  });

  describe('findById()', () => {
    it('deve retornar null para id inexistente', async () => {
      const result = await repo.findById(randomUUID(), randomUUID());
      expect(result).toBeNull();
    });

    it('deve retornar null quando o projetoId não corresponde (isolamento)', async () => {
      const pub = buildPublicacao();
      await seedProjetoEditorial(pub.projetoId);
      await repo.save(pub);

      const result = await repo.findById(randomUUID(), pub.id);
      expect(result).toBeNull();
    });

    it('deve retornar a publicacao pelo id e projetoId corretos', async () => {
      const pub = buildPublicacao();
      await seedProjetoEditorial(pub.projetoId);
      await repo.save(pub);

      const found = await repo.findById(pub.projetoId, pub.id);
      expect(found).not.toBeNull();
      expect(found?.id).toBe(pub.id);
    });
  });

  describe('listByProjeto()', () => {
    it('deve retornar lista vazia para projeto sem publicacoes', async () => {
      const result = await repo.listByProjeto(randomUUID());
      expect(result).toEqual([]);
    });

    it('deve retornar publicacoes em ordem decrescente de sequencia', async () => {
      const projetoId = randomUUID();
      await seedProjetoEditorial(projetoId);
      const pub1 = buildPublicacao({ projetoId, sequencia: 1 });
      const pub2 = buildPublicacao({ projetoId, sequencia: 2 });

      await repo.save(pub1);
      // Precisa que pub1 seja terminal para criar pub2 (D-R: só um in-flight).
      const validando1 = pub1.iniciarValidacao();
      await repo.save(validando1);
      const comErros1 = validando1.concluirComErros({
        resumoErro: 'first attempt failed',
        totalErros: 1,
        totalAvisos: 0,
        concluidaEm: new Date(),
      });
      await repo.save(comErros1);

      await repo.save(pub2);

      const list = await repo.listByProjeto(projetoId);
      expect(list.length).toBeGreaterThanOrEqual(2);
      // Newest attempt (sequencia=2) deve vir primeiro.
      expect(list[0].sequencia).toBeGreaterThan(list[1].sequencia);
    });
  });

  describe('findStaleInFlight()', () => {
    /** 2 horas atrás — bem além do limiar padrão de 60 min. */
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    /** 30 minutos atrás — abaixo do limiar padrão de 60 min. */
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    it('cenario 1: retorna publicacao em gerando com iniciadaEm > limiar (orfao antigo)', async () => {
      const projetoId = randomUUID();
      await seedProjetoEditorial(projetoId);
      const pub = buildPublicacao({ projetoId, iniciadaEm: twoHoursAgo });
      await repo.save(pub);

      const result = await repo.findStaleInFlight(60);

      const found = result.find((p) => p.id === pub.id);
      expect(found).toBeDefined();
      expect(found?.status).toBe(PublicacaoStatus.GERANDO);
    });

    it('cenario 2: exclui publicacao em gerando com iniciadaEm < limiar (recente)', async () => {
      const projetoId = randomUUID();
      await seedProjetoEditorial(projetoId);
      const pub = buildPublicacao({ projetoId, iniciadaEm: thirtyMinutesAgo });
      await repo.save(pub);

      const result = await repo.findStaleInFlight(60);

      const found = result.find((p) => p.id === pub.id);
      expect(found).toBeUndefined();
    });

    it('cenario 3: exclui publicacao terminal (com_erros) mesmo com iniciadaEm antigo', async () => {
      const projetoId = randomUUID();
      await seedProjetoEditorial(projetoId);
      // Cria em gerando com data antiga, avança para terminal.
      const gerando = buildPublicacao({ projetoId, iniciadaEm: twoHoursAgo });
      await repo.save(gerando);
      const validando = gerando.iniciarValidacao();
      await repo.save(validando);
      const comErros = validando.concluirComErros({
        resumoErro: 'stale-test terminal fixture',
        totalErros: 1,
        totalAvisos: 0,
        concluidaEm: new Date(),
      });
      await repo.save(comErros);

      const result = await repo.findStaleInFlight(60);

      const found = result.find((p) => p.id === gerando.id);
      expect(found).toBeUndefined();
    });

    it('cenario 4: retorna lista vazia quando nao ha publicacoes orfas', async () => {
      // Usa um projetoId exclusivo que nunca teve publicacoes para isolar
      // o cenario de outros testes que criaram registros acima.
      const projetoId = randomUUID();
      // Nao chamar seedProjetoEditorial nem repo.save — projeto sem publicacoes.
      const allStale = await repo.findStaleInFlight(60);
      const forThisProject = allStale.filter((p) => p.projetoId === projetoId);
      expect(forThisProject).toEqual([]);
    });
  });
});
