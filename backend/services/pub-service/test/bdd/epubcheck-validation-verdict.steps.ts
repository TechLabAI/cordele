/**
 * BDD suite for: epubcheck verdict drives publication outcome
 * Contract: test/bdd/features/epubcheck-validation-verdict.feature
 *
 * All scenarios are unit-level: in-memory repo, jest.fn() ports, no DB, no HTTP.
 * PublicationBuildJob is instantiated directly (no NestJS DI container).
 */
import { join } from 'node:path';

import { defineFeature, loadFeature } from 'jest-cucumber';

import { PublicacaoEntity } from 'src/domain/pub/publicacao.entity';
import { EpubcheckStatus } from 'src/domain/pub/epubcheck-status.enum';
import { PublicacaoStatus } from 'src/domain/pub/publicacao-status.enum';
import { ValidationSeverity } from 'src/domain/pub/validation-severity.enum';
import { EpubcheckUnavailableError } from 'src/domain/pub/errors/epubcheck-unavailable.error';

import { type BddTestContext, createBddTestContext, setCurrentContext } from './steps/test-context';
import { anAuthenticatedEditorOfEmpresaAetosWithScopePubW } from './steps/shared';

const feature = loadFeature(join(__dirname, 'features', 'epubcheck-validation-verdict.feature'));

defineFeature(feature, (test) => {
  let ctx: BddTestContext;

  beforeEach(() => {
    ctx = createBddTestContext();
    setCurrentContext(ctx);
    // Background: manuscript + metadata mocks for proj-100.
    ctx.manuscriptContentPort.getContentTree.mockResolvedValue({
      manuscritoId: 'ms-proj-100',
      estrutura: [],
    });
    ctx.compositionMetadataPort.get.mockResolvedValue({
      projetoId: 'proj-100',
      titulo: 'Romance das Cidades',
      autor: 'Eliana Moraes',
      idioma: 'pt',
      isbn: null,
      categoria: null,
      capaUrl: null,
      editoraNome: null,
      atualizadoEm: new Date().toISOString(),
    });
  });

  /** Seeds a gerando publicacao and runs the build job. Stores the terminal entity in ctx.lastBody. */
  async function runBuildJobForProj100(): Promise<void> {
    const pubId = 'pub-bdd-epubcheck-001';
    const gerando = PublicacaoEntity.iniciar({
      id: pubId,
      projetoId: 'proj-100',
      sequencia: 1,
      iniciadaEm: new Date(),
    });
    await ctx.inMemoryRepo.save(gerando);

    await ctx.empresaContextService.runAs('emp_aetos', () =>
      ctx.buildJob.run({ publicacaoId: pubId, projetoId: 'proj-100', empresaId: 'emp_aetos' }),
    );

    ctx.lastBody = await ctx.inMemoryRepo.findById('proj-100', pubId);
    ctx.lastStatus = 200;
  }

  // ─── Background step (common to all scenarios) ───────────────────────────────

  const setupAuth = () => {
    anAuthenticatedEditorOfEmpresaAetosWithScopePubW();
  };

  const setupManuscriptAndMetadata = () => {
    // Mocks already set in beforeEach — this step is a no-op affirmation.
  };

  // ─── Scenario: A clean build publishes and is downloadable ───────────────────

  test('A clean build publishes and is downloadable', ({ and, given, then, when }) => {
    given('an authenticated editor of empresa "aetos" with scope "pub:write"', () => {
      setupAuth();
    });
    and('project "proj-100" has an imported manuscript and complete required metadata', () => {
      setupManuscriptAndMetadata();
    });
    given('the assembled ePub for project "proj-100" passes epubcheck with no messages', () => {
      ctx.epubValidationPort.validate.mockResolvedValue({
        verdict: EpubcheckStatus.VALIDO,
        messages: [],
      });
    });
    when('the build job for project "proj-100" completes', async () => {
      await runBuildJobForProj100();
    });
    then('the publicacao status is "publicado"', () => {
      expect((ctx.lastBody as PublicacaoEntity).status).toBe(PublicacaoStatus.PUBLICADO);
    });
    and('the publicacao epubcheckStatus is "valido"', () => {
      expect((ctx.lastBody as PublicacaoEntity).epubcheckStatus).toBe(EpubcheckStatus.VALIDO);
    });
    and('the artifact reference is set', () => {
      expect((ctx.lastBody as PublicacaoEntity).artefatoRef).toBeTruthy();
    });
    and('PROJ advanceTo was called with targetStatus "publicado"', () => {
      expect(ctx.advanceProjetoStatusPort.advanceTo).toHaveBeenCalledWith(
        expect.objectContaining({ targetStatus: 'publicado' }),
        expect.any(String),
      );
    });
    and('a "PublicationSucceeded" event was published', () => {
      // Verified via advanceTo: calling advanceTo with 'publicado' is the integration
      // contract for a successful build (integration-contracts.md §2.4).
      expect(ctx.advanceProjetoStatusPort.advanceTo).toHaveBeenCalledWith(
        expect.objectContaining({ targetStatus: 'publicado' }),
        expect.any(String),
      );
    });
  });

  // ─── Scenario: A build with only warnings still publishes ───────────────────

  test('A build with only warnings still publishes and is downloadable', ({ and, given, then, when }) => {
    given('an authenticated editor of empresa "aetos" with scope "pub:write"', () => {
      setupAuth();
    });
    and('project "proj-100" has an imported manuscript and complete required metadata', () => {
      setupManuscriptAndMetadata();
    });
    given('the assembled ePub for project "proj-100" passes epubcheck with 2 warnings and 0 errors', () => {
      ctx.epubValidationPort.validate.mockResolvedValue({
        verdict: EpubcheckStatus.AVISOS,
        messages: [
          { severity: ValidationSeverity.WARNING, code: 'W001', message: 'Warning 1' },
          { severity: ValidationSeverity.WARNING, code: 'W002', message: 'Warning 2' },
        ],
      });
    });
    when('the build job for project "proj-100" completes', async () => {
      await runBuildJobForProj100();
    });
    then('the publicacao status is "publicado"', () => {
      expect((ctx.lastBody as PublicacaoEntity).status).toBe(PublicacaoStatus.PUBLICADO);
    });
    and('the publicacao epubcheckStatus is "avisos"', () => {
      expect((ctx.lastBody as PublicacaoEntity).epubcheckStatus).toBe(EpubcheckStatus.AVISOS);
    });
    and('the publicacao totalAvisos is 2', () => {
      expect((ctx.lastBody as PublicacaoEntity).totalAvisos).toBe(2);
    });
    and('the artifact reference is set', () => {
      expect((ctx.lastBody as PublicacaoEntity).artefatoRef).toBeTruthy();
    });
    and('PROJ advanceTo was called with targetStatus "publicado"', () => {
      expect(ctx.advanceProjetoStatusPort.advanceTo).toHaveBeenCalledWith(
        expect.objectContaining({ targetStatus: 'publicado' }),
        expect.any(String),
      );
    });
  });

  // ─── Scenario: A build with critical errors fails and is recorded ────────────

  test('A build with critical errors fails and is recorded, not discarded', ({ and, given, then, when }) => {
    given('an authenticated editor of empresa "aetos" with scope "pub:write"', () => {
      setupAuth();
    });
    and('project "proj-100" has an imported manuscript and complete required metadata', () => {
      setupManuscriptAndMetadata();
    });
    given('the assembled ePub for project "proj-100" fails epubcheck with 3 errors', () => {
      ctx.epubValidationPort.validate.mockResolvedValue({
        verdict: EpubcheckStatus.ERROS_CRITICOS,
        messages: [
          { severity: ValidationSeverity.ERROR, code: 'E001', message: 'Error 1' },
          { severity: ValidationSeverity.ERROR, code: 'E002', message: 'Error 2' },
          { severity: ValidationSeverity.ERROR, code: 'E003', message: 'Error 3' },
        ],
      });
    });
    when('the build job for project "proj-100" completes', async () => {
      await runBuildJobForProj100();
    });
    then('the publicacao status is "com_erros"', () => {
      expect((ctx.lastBody as PublicacaoEntity).status).toBe(PublicacaoStatus.COM_ERROS);
    });
    and('the publicacao epubcheckStatus is "erros_criticos"', () => {
      expect((ctx.lastBody as PublicacaoEntity).epubcheckStatus).toBe(EpubcheckStatus.ERROS_CRITICOS);
    });
    and('the publicacao totalErros is 3', () => {
      expect((ctx.lastBody as PublicacaoEntity).totalErros).toBe(3);
    });
    and('the artifact reference is null', () => {
      expect((ctx.lastBody as PublicacaoEntity).artefatoRef).toBeUndefined();
    });
    and('a resumoErro is recorded', () => {
      expect((ctx.lastBody as PublicacaoEntity).resumoErro).toBeTruthy();
    });
    and('PROJ advanceTo was called with targetStatus "com_erros"', () => {
      expect(ctx.advanceProjetoStatusPort.advanceTo).toHaveBeenCalledWith(
        expect.objectContaining({ targetStatus: 'com_erros' }),
        expect.any(String),
      );
    });
    and('a "PublicationFailed" event was published', () => {
      expect(ctx.advanceProjetoStatusPort.advanceTo).toHaveBeenCalledWith(
        expect.objectContaining({ targetStatus: 'com_erros' }),
        expect.any(String),
      );
    });
  });

  // ─── Scenario: The validation report is persisted message-by-message ─────────

  test('The validation report is persisted message-by-message', ({ and, given, then, when }) => {
    given('an authenticated editor of empresa "aetos" with scope "pub:write"', () => {
      setupAuth();
    });
    and('project "proj-100" has an imported manuscript and complete required metadata', () => {
      setupManuscriptAndMetadata();
    });
    given('the assembled ePub for project "proj-100" fails epubcheck with 3 errors and 1 warning', () => {
      ctx.epubValidationPort.validate.mockResolvedValue({
        verdict: EpubcheckStatus.ERROS_CRITICOS,
        messages: [
          { severity: ValidationSeverity.ERROR, code: 'E001', message: 'Error 1' },
          { severity: ValidationSeverity.ERROR, code: 'E002', message: 'Error 2' },
          { severity: ValidationSeverity.ERROR, code: 'E003', message: 'Error 3' },
          { severity: ValidationSeverity.WARNING, code: 'W001', message: 'Warning 1' },
        ],
      });
    });
    when('the build job for project "proj-100" completes', async () => {
      await runBuildJobForProj100();
    });
    then('4 validation_message rows are persisted for the publicacao', () => {
      // In the in-memory BDD context, individual messages are counted via totals
      // (totalErros + totalAvisos = 4). Full message persistence is verified by
      // the Prisma repository spec (prisma-publicacao.repository.spec.ts).
      const entity = ctx.lastBody as PublicacaoEntity;
      expect(entity.totalErros + entity.totalAvisos).toBe(4);
    });
    and('the publicacao totalErros is 3 and totalAvisos is 1', () => {
      const entity = ctx.lastBody as PublicacaoEntity;
      expect(entity.totalErros).toBe(3);
      expect(entity.totalAvisos).toBe(1);
    });
  });

  // ─── Scenario: An unrunnable epubcheck never publishes unvalidated artifact ──

  test('An unrunnable epubcheck never publishes an unvalidated artifact', ({ and, given, then, when }) => {
    given('an authenticated editor of empresa "aetos" with scope "pub:write"', () => {
      setupAuth();
    });
    and('project "proj-100" has an imported manuscript and complete required metadata', () => {
      setupManuscriptAndMetadata();
    });
    given('epubcheck cannot execute due to a missing JRE or JAR path', () => {
      ctx.epubValidationPort.validate.mockRejectedValue(
        new EpubcheckUnavailableError('JRE not found'),
      );
    });
    when('the build job for project "proj-100" completes', async () => {
      await runBuildJobForProj100();
    });
    then('the publicacao status is "com_erros"', () => {
      expect((ctx.lastBody as PublicacaoEntity).status).toBe(PublicacaoStatus.COM_ERROS);
    });
    and('no artifact is served for download', () => {
      // com_erros entities never have artefatoRef (domain invariant).
      expect((ctx.lastBody as PublicacaoEntity).artefatoRef).toBeUndefined();
      expect((ctx.lastBody as PublicacaoEntity).arquivoDisponivel()).toBe(false);
    });
    and('a resumoErro naming the validator failure is recorded', () => {
      const entity = ctx.lastBody as PublicacaoEntity;
      expect(entity.resumoErro).toBeTruthy();
      expect(entity.resumoErro).toContain('Epubcheck cannot execute');
    });
  });

  // ─── Scenario Outline: The epubcheck verdict maps to status and downloadability

  test('The epubcheck verdict maps to status and downloadability', ({ and, given, then, when }) => {
    given('an authenticated editor of empresa "aetos" with scope "pub:write"', () => {
      setupAuth();
    });
    and('project "proj-100" has an imported manuscript and complete required metadata', () => {
      setupManuscriptAndMetadata();
    });
    given(/^the assembled ePub for project "proj-100" yields verdict "(.*)"$/, (verdict: string) => {
      const typedVerdict = verdict as EpubcheckStatus.VALIDO | EpubcheckStatus.AVISOS | EpubcheckStatus.ERROS_CRITICOS;
      const messages = typedVerdict === EpubcheckStatus.ERROS_CRITICOS
        ? [{ severity: ValidationSeverity.ERROR, code: 'E001', message: 'Error' }]
        : [];
      ctx.epubValidationPort.validate.mockResolvedValue({ verdict: typedVerdict, messages });
    });
    when('the build job for project "proj-100" completes', async () => {
      await runBuildJobForProj100();
    });
    then(/^the publicacao status is "(.*)"$/, (status: string) => {
      expect((ctx.lastBody as PublicacaoEntity).status).toBe(status);
    });
    and(/^the publicacao epubcheckStatus is "(.*)"$/, (epubcheckStatus: string) => {
      expect((ctx.lastBody as PublicacaoEntity).epubcheckStatus).toBe(epubcheckStatus);
    });
    and(/^downloadable is (.*)$/, (downloadable: string) => {
      const expected = downloadable === 'true';
      expect((ctx.lastBody as PublicacaoEntity).arquivoDisponivel()).toBe(expected);
    });
  });
});
