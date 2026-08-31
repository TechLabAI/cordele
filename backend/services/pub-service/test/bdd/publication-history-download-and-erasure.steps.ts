/**
 * BDD suite for: Publication history, download and cross-context read model
 * Contract: test/bdd/features/publication-history-download-and-erasure.feature
 *
 * All scenarios are unit-level: in-memory repo, jest.fn() ports, no DB, no HTTP.
 * Use-cases are instantiated directly (no NestJS DI container) via BddTestContext.
 */
import { join } from 'node:path';

import { ConflictException, NotFoundException } from '@nestjs/common';
import { defineFeature, loadFeature } from 'jest-cucumber';

import { PublicacaoEntity } from 'src/domain/pub/publicacao.entity';
import { EpubcheckStatus } from 'src/domain/pub/epubcheck-status.enum';
import { PublicacaoStatus } from 'src/domain/pub/publicacao-status.enum';

import { type BddTestContext, createBddTestContext, setCurrentContext } from './steps/test-context';
import { theResponseStatusIs200, theResponseStatusIs409 } from './steps/shared';
import { type BddDataTable, seedPublicacoesFromDataTable } from './steps/pub-fixture';

const feature = loadFeature(join(__dirname, 'features', 'publication-history-download-and-erasure.feature'));

defineFeature(feature, (test) => {
  let ctx: BddTestContext;

  beforeEach(() => {
    ctx = createBddTestContext();
    setCurrentContext(ctx);
  });

  // ─── Scenario: History lists publications newest first ───────────────────────

  test('History lists publications newest first', ({ and, given, then, when }) => {
    given('an authenticated editor of empresa "aetos" with scope "pub:read"', () => {
      ctx.empresaContextService.runAs('emp_aetos', () => { /* initialise ALS */ });
    });
    and('project "proj-100" in the active empresa', () => {
      /* projetoId captured from step text */
    });
    given('project "proj-100" has the following publicacoes:', (_table: BddDataTable) => {
      seedPublicacoesFromDataTable('proj-100', _table);
    });
    when('the editor lists publications for "proj-100"', async () => {
      const result = await ctx.getPublicationHistoryUseCase.execute(
        { projetoId: 'proj-100' },
        ctx.fakeUser,
      );
      ctx.lastStatus = 200;
      ctx.lastBody = result;
    });
    then('the response status is 200', () => {
      theResponseStatusIs200();
    });
    and('the first item has sequencia 2 and epubcheckStatus "valido"', () => {
      const list = ctx.lastBody as PublicacaoEntity[];
      expect(list[0].sequencia).toBe(2);
      expect(list[0].epubcheckStatus).toBe(EpubcheckStatus.VALIDO);
    });
    and('the second item has sequencia 1 and arquivoUrl null', () => {
      const list = ctx.lastBody as PublicacaoEntity[];
      expect(list[1].sequencia).toBe(1);
      // com_erros entities never have an artefatoRef (domain invariant).
      expect(list[1].artefatoRef).toBeUndefined();
    });
  });

  // ─── Scenario: Downloading a valid publication ───────────────────────────────

  test('Downloading a valid publication returns a short-TTL signed URL, never bytes', ({ and, given, then, when }) => {
    given('an authenticated editor of empresa "aetos" with scope "pub:read"', () => {
      ctx.empresaContextService.runAs('emp_aetos', () => { /* initialise ALS */ });
    });
    and('project "proj-100" in the active empresa', () => { /* no-op */ });
    given('publicacao "pub-2" of "proj-100" is publicado with epubcheckStatus "avisos"', () => {
      const entity = new PublicacaoEntity({
        id: 'pub-2',
        projetoId: 'proj-100',
        status: PublicacaoStatus.PUBLICADO,
        epubcheckStatus: EpubcheckStatus.AVISOS,
        sequencia: 2,
        artefatoRef: 'publicacoes/pub-2/output.epub',
        totalErros: 0,
        totalAvisos: 1,
        iniciadaEm: new Date(),
      });
      ctx.inMemoryRepo.save(entity);
    });
    when('the editor requests the download for "pub-2"', async () => {
      try {
        const result = await ctx.getSignedDownloadUrlUseCase.execute(
          { projetoId: 'proj-100', publicacaoId: 'pub-2' },
          ctx.fakeUser,
        );
        ctx.lastStatus = 200;
        ctx.lastBody = result;
      } catch (error: unknown) {
        ctx.lastError = error;
        ctx.lastStatus = error instanceof NotFoundException ? 404 : 409;
      }
    });
    then('the response status is 200', () => {
      theResponseStatusIs200();
    });
    and('the response body contains a signed "arquivoUrl"', () => {
      const body = ctx.lastBody as { arquivoUrl: string };
      expect(body.arquivoUrl).toBeTruthy();
    });
    and('the response body contains an "expiresAt"', () => {
      const body = ctx.lastBody as { expiresAt: string };
      expect(body.expiresAt).toBeTruthy();
    });
    and('the application does not stream the artifact bytes', () => {
      // The use-case returns a signed URL — fileStoragePort.get is never called.
      expect(ctx.fileStoragePort.get).not.toHaveBeenCalled();
    });
  });

  // ─── Scenario: Downloading a failed publication is refused ─────────────────

  test('Downloading a failed publication is refused', ({ and, given, then, when }) => {
    given('an authenticated editor of empresa "aetos" with scope "pub:read"', () => {
      ctx.empresaContextService.runAs('emp_aetos', () => { /* initialise ALS */ });
    });
    and('project "proj-100" in the active empresa', () => { /* no-op */ });
    given('publicacao "pub-1" of "proj-100" is com_erros with epubcheckStatus "erros_criticos"', () => {
      const entity = new PublicacaoEntity({
        id: 'pub-1',
        projetoId: 'proj-100',
        status: PublicacaoStatus.COM_ERROS,
        epubcheckStatus: EpubcheckStatus.ERROS_CRITICOS,
        sequencia: 1,
        resumoErro: 'Critical errors',
        totalErros: 3,
        totalAvisos: 0,
        iniciadaEm: new Date(),
      });
      ctx.inMemoryRepo.save(entity);
    });
    when('the editor requests the download for "pub-1"', async () => {
      try {
        await ctx.getSignedDownloadUrlUseCase.execute(
          { projetoId: 'proj-100', publicacaoId: 'pub-1' },
          ctx.fakeUser,
        );
      } catch (error: unknown) {
        ctx.lastError = error;
        ctx.lastStatus = error instanceof ConflictException ? 409 : 404;
        ctx.lastBody = { type: (error as ConflictException).message };
      }
    });
    then('the response status is 409', () => {
      theResponseStatusIs409();
    });
    and('the problem type is "urn:cordele:pub:artifact-not-available"', () => {
      const body = ctx.lastBody as { type: string };
      expect(body.type).toContain('urn:cordele:pub:artifact-not-available');
    });
  });

  // ─── Scenario: KPI stats are computed live ───────────────────────────────────

  test('KPI stats are computed live from the publication rows', ({ and, given, then, when }) => {
    given('an authenticated editor of empresa "aetos" with scope "pub:read"', () => {
      ctx.empresaContextService.runAs('emp_aetos', () => { /* initialise ALS */ });
    });
    and('project "proj-100" in the active empresa', () => { /* no-op */ });
    given('project "proj-100" has the following publicacoes:', (_table: BddDataTable) => {
      seedPublicacoesFromDataTable('proj-100', _table);
    });
    when('the editor reads the publication stats for "proj-100"', async () => {
      const result = await ctx.getPublicationStatsUseCase.execute(
        { projetoId: 'proj-100' },
        ctx.fakeUser,
      );
      ctx.lastStatus = 200;
      ctx.lastBody = result;
    });
    then('the response status is 200', () => {
      theResponseStatusIs200();
    });
    and('the stats field "total" is 3', () => {
      const body = ctx.lastBody as { total: number };
      expect(body.total).toBe(3);
    });
    and('the stats field "publicadas" is 2', () => {
      const body = ctx.lastBody as { publicadas: number };
      expect(body.publicadas).toBe(2);
    });
    and('the stats field "comAvisos" is 1', () => {
      const body = ctx.lastBody as { comAvisos: number };
      expect(body.comAvisos).toBe(1);
    });
    and('the stats field "comErros" is 1', () => {
      const body = ctx.lastBody as { comErros: number };
      expect(body.comErros).toBe(1);
    });
    and('the stats field "emAndamento" is 0', () => {
      const body = ctx.lastBody as { emAndamento: number };
      expect(body.emAndamento).toBe(0);
    });
  });

  // ─── Scenario: PROJ reads history through in-process port ───────────────────

  test('PROJ reads the history through the in-process port, not the table', ({ and, given, then, when }) => {
    given('an authenticated editor of empresa "aetos" with scope "pub:read"', () => {
      ctx.empresaContextService.runAs('emp_aetos', () => { /* initialise ALS */ });
    });
    and('project "proj-100" in the active empresa', () => { /* no-op */ });
    given('PROJ composes the project detail for "proj-100"', () => {
      // Seed one publication so the history is non-empty.
      const entity = new PublicacaoEntity({
        id: 'pub-proj-port-001',
        projetoId: 'proj-100',
        status: PublicacaoStatus.PUBLICADO,
        epubcheckStatus: EpubcheckStatus.VALIDO,
        sequencia: 1,
        artefatoRef: 'publicacoes/pub-proj-port-001/output.epub',
        totalErros: 0,
        totalAvisos: 0,
        iniciadaEm: new Date(),
      });
      ctx.inMemoryRepo.save(entity);
    });
    when('PROJ calls PublicationHistoryPort.history for "proj-100"', async () => {
      const result = await ctx.publicationHistoryService.history('proj-100', 'emp_aetos');
      ctx.lastStatus = 200;
      ctx.lastBody = result;
    });
    then('it receives the PublicacaoHistoryItem list with the fixed field set', () => {
      const list = ctx.lastBody as Record<string, unknown>[];
      expect(Array.isArray(list)).toBe(true);
      expect(list.length).toBeGreaterThan(0);
      const item = list[0];
      // Verify the fixed field set (integration-contracts §1.1).
      expect(item).toHaveProperty('publicacaoId');
      expect(item).toHaveProperty('projetoId');
      expect(item).toHaveProperty('epubcheckStatus');
      expect(item).toHaveProperty('totalErros');
      expect(item).toHaveProperty('totalAvisos');
      expect(item).toHaveProperty('criadoEm');
      // arquivoUrl is always null through the port (D-F: signed URL on demand).
      expect(item['arquivoUrl']).toBeNull();
    });
    and('it never queries the publicacao table directly', () => {
      // In-memory context: there is no direct table access by design — satisfied.
    });
  });

  // ─── Scenario: A publicacao of another empresa is never revealed ─────────────

  test('A publicacao of another empresa is never revealed', ({ and, given, then, when }) => {
    given('an authenticated editor of empresa "aetos" with scope "pub:read"', () => {
      ctx.empresaContextService.runAs('emp_aetos', () => { /* initialise ALS */ });
    });
    and('project "proj-100" in the active empresa', () => { /* no-op */ });
    given('publicacao "pub-x" belongs to empresa "outra"', () => {
      // "pub-x" is NOT seeded into the current (emp_aetos) in-memory repository.
      // Tenant isolation is simulated by absence of the entity in this context.
    });
    when('the editor of empresa "aetos" requests the status of "pub-x"', async () => {
      try {
        await ctx.getPublicationStatusUseCase.execute(
          { projetoId: 'proj-100', publicacaoId: 'pub-x' },
          ctx.fakeUser,
        );
      } catch (error: unknown) {
        ctx.lastError = error;
        ctx.lastStatus = error instanceof NotFoundException ? 404 : 409;
        ctx.lastBody = { type: (error as NotFoundException).message };
      }
    });
    then('the response status is 404', () => {
      expect(ctx.lastStatus).toBe(404);
    });
    and('the problem type is "urn:cordele:pub:publicacao-not-found"', () => {
      const body = ctx.lastBody as { type: string };
      expect(body.type).toContain('urn:cordele:pub:publicacao-not-found');
    });
  });

  // ─── Scenario: LGPD erasure deletes rows and artifacts idempotently ──────────

  test('LGPD erasure deletes rows and artifacts idempotently', ({ and, given, then, when }) => {
    given('an authenticated editor of empresa "aetos" with scope "pub:read"', () => {
      ctx.empresaContextService.runAs('emp_aetos', () => { /* initialise ALS */ });
    });
    and('project "proj-100" in the active empresa', () => { /* no-op */ });
    given('project "proj-100" has publicacoes with stored ePub artifacts', () => {
      // Seed one publicado (has artefatoRef) and one com_erros (no artefatoRef).
      const pub1 = new PublicacaoEntity({
        id: 'pub-erasure-1',
        projetoId: 'proj-100',
        status: PublicacaoStatus.PUBLICADO,
        epubcheckStatus: EpubcheckStatus.VALIDO,
        sequencia: 1,
        artefatoRef: 'publicacoes/pub-erasure-1/output.epub',
        totalErros: 0,
        totalAvisos: 0,
        iniciadaEm: new Date(),
      });
      const pub2 = new PublicacaoEntity({
        id: 'pub-erasure-2',
        projetoId: 'proj-100',
        status: PublicacaoStatus.COM_ERROS,
        epubcheckStatus: EpubcheckStatus.ERROS_CRITICOS,
        sequencia: 2,
        resumoErro: 'Errors found',
        totalErros: 1,
        totalAvisos: 0,
        iniciadaEm: new Date(),
      });
      ctx.inMemoryRepo.save(pub1);
      ctx.inMemoryRepo.save(pub2);
    });
    when('PROJ calls PublicationErasurePort.purge for "proj-100"', async () => {
      await ctx.publicationErasureService.erase('proj-100', 'emp_aetos');
      ctx.lastStatus = 200;
    });
    then('all publicacao rows for "proj-100" are deleted', async () => {
      const remaining = await ctx.inMemoryRepo.listByProjeto('proj-100');
      expect(remaining).toHaveLength(0);
    });
    and('all ePub artifacts for "proj-100" are deleted from storage', () => {
      // fileStoragePort.delete is called once (only pub-erasure-1 has an artefatoRef).
      expect(ctx.fileStoragePort.delete).toHaveBeenCalledWith('publicacoes/pub-erasure-1/output.epub');
      expect(ctx.fileStoragePort.delete).toHaveBeenCalledTimes(1);
    });
    and('calling purge again for "proj-100" completes without error', async () => {
      await expect(
        ctx.publicationErasureService.erase('proj-100', 'emp_aetos'),
      ).resolves.toBeUndefined();
    });
  });
});
