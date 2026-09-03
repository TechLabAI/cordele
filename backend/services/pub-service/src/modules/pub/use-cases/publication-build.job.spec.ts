/**
 * Unit spec for PublicationBuildJob (PUB-004).
 *
 * All outbound ports mocked with jest.fn(). Covers the golden path
 * (gerando -> validando -> publicado, with warnings still publishing per
 * D-Q), the com_erros path, the storage-failure fallback, and that
 * advanceTo is requested exactly once and never discards the build result
 * when it fails.
 */

import { EpubcheckStatus } from '../../../domain/pub/epubcheck-status.enum';
import { PublicationFailedEvent } from '../../../domain/pub/events/publication-failed.event';
import { PublicationSucceededEvent } from '../../../domain/pub/events/publication-succeeded.event';
import { PublicacaoEntity } from '../../../domain/pub/publicacao.entity';
import { PublicacaoStatus } from '../../../domain/pub/publicacao-status.enum';
import { ValidationSeverity } from '../../../domain/pub/validation-severity.enum';
import { type AdvanceProjetoStatusPort } from '../ports/advance-projeto-status.port';
import { type CompositionLayoutPort } from '../ports/composition-layout.port';
import { type CompositionMetadataPort } from '../ports/composition-metadata.port';
import { type EpubValidationPort } from '../ports/epub-validation.port';
import { type EventPublisherPort } from '../ports/event-publisher.port';
import { type FileStoragePort } from '../ports/file-storage.port';
import { type ManuscriptContentPort } from '../ports/manuscript-content.port';
import { type PublicacaoRepositoryPort } from '../ports/publicacao-repository.port';
import { PublicationBuildJob } from './publication-build.job';

const PROJETO_ID = '11111111-1111-1111-1111-111111111111';
const PUBLICACAO_ID = '22222222-2222-2222-2222-222222222222';

const makeGerando = (): PublicacaoEntity =>
  PublicacaoEntity.iniciar({
    id: PUBLICACAO_ID,
    projetoId: PROJETO_ID,
    sequencia: 1,
    iniciadaEm: new Date('2026-08-19T16:30:00Z'),
  });

describe('PublicationBuildJob', () => {
  let repository: jest.Mocked<PublicacaoRepositoryPort>;
  let manuscriptContentPort: jest.Mocked<ManuscriptContentPort>;
  let compositionMetadataPort: jest.Mocked<CompositionMetadataPort>;
  let compositionLayoutPort: jest.Mocked<CompositionLayoutPort>;
  let epubValidationPort: jest.Mocked<EpubValidationPort>;
  let fileStoragePort: jest.Mocked<FileStoragePort>;
  let advanceProjetoStatusPort: jest.Mocked<AdvanceProjetoStatusPort>;
  let eventEmitter: jest.Mocked<EventPublisherPort>;
  let job: PublicationBuildJob;

  beforeEach(() => {
    repository = {
      findInFlight: jest.fn(),
      nextSequencia: jest.fn(),
      save: jest.fn().mockImplementation((p) => Promise.resolve(p)),
      findById: jest.fn().mockResolvedValue(makeGerando()),
      listByProjeto: jest.fn(),
      findLatestByProjetoIds: jest.fn(),
      findByPublicacaoId: jest.fn(),
      deleteAllByProjeto: jest.fn(),
      findStaleInFlight: jest.fn(),
    };
    manuscriptContentPort = {
      getContentTree: jest.fn().mockResolvedValue({ manuscritoId: 'manuscrito-1', estrutura: [] }),
    };
    compositionMetadataPort = {
      get: jest.fn().mockResolvedValue({
        projetoId: PROJETO_ID,
        titulo: 'Romance',
        autor: 'Autora',
        isbn: null,
        idioma: 'pt',
        categoria: null,
        capaUrl: null,
        editoraNome: null,
        atualizadoEm: new Date().toISOString(),
      }),
    };
    compositionLayoutPort = { get: jest.fn().mockResolvedValue(null) };
    epubValidationPort = { validate: jest.fn() };
    fileStoragePort = {
      // ADR-004: put() retorna { url, bytesWritten }
      put: jest.fn().mockResolvedValue({ url: 'stub://output.epub', bytesWritten: 1024 }),
      get: jest.fn(),
      delete: jest.fn(),
      signUrl: jest.fn(),
    };
    advanceProjetoStatusPort = {
      advanceTo: jest.fn().mockResolvedValue({ projetoId: PROJETO_ID, newStatus: 'publicado', changed: true }),
    };
    eventEmitter = { emit: jest.fn().mockReturnValue(true) };

    job = new PublicationBuildJob(
      repository,
      manuscriptContentPort,
      compositionMetadataPort,
      compositionLayoutPort,
      epubValidationPort,
      fileStoragePort,
      advanceProjetoStatusPort,
      eventEmitter,
    );
  });

  it('publishes with warnings only — status=publicado, epubcheckStatus=avisos (D-Q)', async () => {
    epubValidationPort.validate.mockResolvedValue({
      verdict: EpubcheckStatus.AVISOS,
      messages: [{ severity: ValidationSeverity.WARNING, code: 'W-001', message: 'minor issue' }],
    });

    await job.run({ publicacaoId: PUBLICACAO_ID, projetoId: PROJETO_ID, empresaId: 'empresa-aetos' });

    expect(fileStoragePort.put).toHaveBeenCalledTimes(1);
    expect(advanceProjetoStatusPort.advanceTo).toHaveBeenCalledWith(
      { projetoId: PROJETO_ID, targetStatus: 'publicado' },
      expect.any(String),
    );

    const savedCalls = repository.save.mock.calls.map(([p]) => p as PublicacaoEntity);
    const terminal = savedCalls[savedCalls.length - 1];
    expect(terminal.status).toBe(PublicacaoStatus.PUBLICADO);
    expect(terminal.epubcheckStatus).toBe(EpubcheckStatus.AVISOS);
    expect(terminal.arquivoDisponivel()).toBe(true);
  });

  it('rejects with com_erros on a fatal epubcheck verdict — no artifact stored', async () => {
    epubValidationPort.validate.mockResolvedValue({
      verdict: EpubcheckStatus.ERROS_CRITICOS,
      messages: [{ severity: ValidationSeverity.ERROR, code: 'RSC-005', message: 'invalid OPF reference' }],
    });

    await job.run({ publicacaoId: PUBLICACAO_ID, projetoId: PROJETO_ID, empresaId: 'empresa-aetos' });

    expect(fileStoragePort.put).not.toHaveBeenCalled();
    expect(advanceProjetoStatusPort.advanceTo).toHaveBeenCalledWith(
      { projetoId: PROJETO_ID, targetStatus: 'com_erros' },
      expect.any(String),
    );

    const savedCalls = repository.save.mock.calls.map(([p]) => p as PublicacaoEntity);
    const terminal = savedCalls[savedCalls.length - 1];
    expect(terminal.status).toBe(PublicacaoStatus.COM_ERROS);
    expect(terminal.epubcheckStatus).toBe(EpubcheckStatus.ERROS_CRITICOS);
    expect(terminal.resumoErro).toContain('RSC-005');
  });

  it('falls back to com_erros when artifact storage fails after a valid build', async () => {
    epubValidationPort.validate.mockResolvedValue({ verdict: EpubcheckStatus.VALIDO, messages: [] });
    fileStoragePort.put.mockRejectedValue(new Error('disk full'));

    await job.run({ publicacaoId: PUBLICACAO_ID, projetoId: PROJETO_ID, empresaId: 'empresa-aetos' });

    const savedCalls = repository.save.mock.calls.map(([p]) => p as PublicacaoEntity);
    const terminal = savedCalls[savedCalls.length - 1];
    expect(terminal.status).toBe(PublicacaoStatus.COM_ERROS);
    expect(terminal.artefatoRef).toBeUndefined();
    expect(advanceProjetoStatusPort.advanceTo).toHaveBeenCalledWith(
      { projetoId: PROJETO_ID, targetStatus: 'com_erros' },
      expect.any(String),
    );
  });

  it('still persists the build outcome when advanceTo fails (integration-contracts §2.4 fallback)', async () => {
    epubValidationPort.validate.mockResolvedValue({ verdict: EpubcheckStatus.VALIDO, messages: [] });
    advanceProjetoStatusPort.advanceTo.mockRejectedValue(new Error('PROJ unavailable'));

    await job.run({ publicacaoId: PUBLICACAO_ID, projetoId: PROJETO_ID, empresaId: 'empresa-aetos' });

    const savedCalls = repository.save.mock.calls.map(([p]) => p as PublicacaoEntity);
    const terminal = savedCalls[savedCalls.length - 1];
    expect(terminal.status).toBe(PublicacaoStatus.PUBLICADO);
    expect(advanceProjetoStatusPort.advanceTo).toHaveBeenCalledTimes(1);
  });

  it('does nothing when the publicacao cannot be found', async () => {
    repository.findById.mockResolvedValue(null);

    await job.run({ publicacaoId: 'missing', projetoId: PROJETO_ID, empresaId: 'empresa-aetos' });

    expect(epubValidationPort.validate).not.toHaveBeenCalled();
    expect(repository.save).not.toHaveBeenCalled();
  });

  describe('PUB-004: domain events dispatched AFTER persistence (timing contract)', () => {
    it('emits publication.succeeded with correct payload after repository.save on happy path', async () => {
      epubValidationPort.validate.mockResolvedValue({ verdict: EpubcheckStatus.VALIDO, messages: [] });
      fileStoragePort.put.mockResolvedValue({ url: 'stub://output.epub', bytesWritten: 2048 });

      // Track call order: save must come before emit
      const callOrder: string[] = [];
      repository.save.mockImplementation((p) => {
        callOrder.push('save');
        return Promise.resolve(p);
      });
      eventEmitter.emit.mockImplementation(() => {
        callOrder.push('emit');
        return true;
      });

      await job.run({ publicacaoId: PUBLICACAO_ID, projetoId: PROJETO_ID, empresaId: 'empresa-aetos' });

      // emit called exactly once with the succeeded event
      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'publication.succeeded',
        expect.any(PublicationSucceededEvent),
      );

      // Verify payload fields
      const [, payload] = eventEmitter.emit.mock.calls[0] as [string, PublicationSucceededEvent];
      expect(payload.publicacaoId).toBe(PUBLICACAO_ID);
      expect(payload.projetoId).toBe(PROJETO_ID);
      expect(payload.empresaId).toBe('empresa-aetos');
      expect(payload.tamanhoBytes).toBe(2048);

      // Timing: last save must precede the emit (save appears before emit in callOrder)
      const lastSaveIdx = callOrder.lastIndexOf('save');
      const emitIdx = callOrder.indexOf('emit');
      expect(lastSaveIdx).toBeGreaterThanOrEqual(0);
      expect(emitIdx).toBeGreaterThan(lastSaveIdx);
    });

    it('emits publication.failed with correct payload after repository.save on com_erros path', async () => {
      epubValidationPort.validate.mockResolvedValue({
        verdict: EpubcheckStatus.ERROS_CRITICOS,
        messages: [{ severity: ValidationSeverity.ERROR, code: 'RSC-005', message: 'invalid OPF ref' }],
      });

      // Track call order
      const callOrder: string[] = [];
      repository.save.mockImplementation((p) => {
        callOrder.push('save');
        return Promise.resolve(p);
      });
      eventEmitter.emit.mockImplementation(() => {
        callOrder.push('emit');
        return true;
      });

      await job.run({ publicacaoId: PUBLICACAO_ID, projetoId: PROJETO_ID, empresaId: 'empresa-aetos' });

      expect(eventEmitter.emit).toHaveBeenCalledTimes(1);
      expect(eventEmitter.emit).toHaveBeenCalledWith(
        'publication.failed',
        expect.any(PublicationFailedEvent),
      );

      const [, payload] = eventEmitter.emit.mock.calls[0] as [string, PublicationFailedEvent];
      expect(payload.publicacaoId).toBe(PUBLICACAO_ID);
      expect(payload.projetoId).toBe(PROJETO_ID);
      expect(payload.empresaId).toBe('empresa-aetos');
      expect(payload.reason).toContain('RSC-005');

      // Timing: save before emit
      const lastSaveIdx = callOrder.lastIndexOf('save');
      const emitIdx = callOrder.indexOf('emit');
      expect(lastSaveIdx).toBeGreaterThanOrEqual(0);
      expect(emitIdx).toBeGreaterThan(lastSaveIdx);
    });

    it('does not emit any event when publicacao is not found', async () => {
      repository.findById.mockResolvedValue(null);

      await job.run({ publicacaoId: 'missing', projetoId: PROJETO_ID, empresaId: 'empresa-aetos' });

      expect(eventEmitter.emit).not.toHaveBeenCalled();
    });
  });

  describe('ADR-004: campos KPI de resumo persistidos na publicação (tamanhoBytes, totalCapitulos, totalImagens)', () => {
    it('persiste tamanhoBytes, totalCapitulos e totalImagens no aggregate publicado', async () => {
      epubValidationPort.validate.mockResolvedValue({ verdict: EpubcheckStatus.VALIDO, messages: [] });
      // bytesWritten retornado pelo put() simulado
      fileStoragePort.put.mockResolvedValue({ url: 'stub://output.epub', bytesWritten: 4096 });

      await job.run({ publicacaoId: PUBLICACAO_ID, projetoId: PROJETO_ID, empresaId: 'empresa-aetos' });

      const savedCalls = repository.save.mock.calls.map(([p]) => p as PublicacaoEntity);
      const terminal = savedCalls[savedCalls.length - 1];
      expect(terminal.status).toBe(PublicacaoStatus.PUBLICADO);
      // tamanhoBytes vem de fileStoragePort.put().bytesWritten
      expect(terminal.tamanhoBytes).toBe(4096);
      // totalCapitulos e totalImagens vêm do EpubBuilder — com o mock de manuscriptContentPort
      // retornando { manuscritoId: ..., estrutura: [] }, o builder insere 0 capítulos/imagens
      expect(typeof terminal.totalCapitulos).toBe('number');
      expect(typeof terminal.totalImagens).toBe('number');
    });

    it('não persiste KPIs de resumo em publicação com_erros', async () => {
      epubValidationPort.validate.mockResolvedValue({
        verdict: EpubcheckStatus.ERROS_CRITICOS,
        messages: [{ severity: ValidationSeverity.ERROR, code: 'RSC-005', message: 'invalid ref' }],
      });

      await job.run({ publicacaoId: PUBLICACAO_ID, projetoId: PROJETO_ID, empresaId: 'empresa-aetos' });

      const savedCalls = repository.save.mock.calls.map(([p]) => p as PublicacaoEntity);
      const terminal = savedCalls[savedCalls.length - 1];
      expect(terminal.status).toBe(PublicacaoStatus.COM_ERROS);
      // KPIs ausentes em build com erros (undefined — não definidos em concluirComErros)
      expect(terminal.tamanhoBytes).toBeUndefined();
      expect(terminal.totalCapitulos).toBeUndefined();
      expect(terminal.totalImagens).toBeUndefined();
    });
  });
});
