import { Inject, Injectable, Logger } from '@nestjs/common';
import { Readable } from 'node:stream';

import { EpubBuilder } from '../../../domain/pub/epub-builder';
import { EpubcheckStatus } from '../../../domain/pub/epubcheck-status.enum';
import { EpubcheckUnavailableError } from '../../../domain/pub/errors/epubcheck-unavailable.error';
import { PublicacaoEntity } from '../../../domain/pub/publicacao.entity';
import { ValidationSeverity } from '../../../domain/pub/validation-severity.enum';
import {
  ADVANCE_PROJETO_STATUS_PORT,
  COMPOSITION_LAYOUT_PORT,
  COMPOSITION_METADATA_PORT,
  EPUB_VALIDATION_PORT,
  EVENT_PUBLISHER_PORT,
  FILE_STORAGE_PORT,
  MANUSCRIPT_CONTENT_PORT,
  PUBLICACAO_REPOSITORY_PORT,
} from '../pub.tokens';
import { type AdvanceProjetoStatusPort, type ProjetoTargetStatus } from '../ports/advance-projeto-status.port';
import { type EventPublisherPort } from '../ports/event-publisher.port';
import { PublicationFailedEvent } from '../../../domain/pub/events/publication-failed.event';
import { PublicationSucceededEvent } from '../../../domain/pub/events/publication-succeeded.event';
import { type CompositionLayoutPort, type LayoutRead } from '../ports/composition-layout.port';
import { type CompositionMetadataPort, type MetadadosRead } from '../ports/composition-metadata.port';
import { type EpubValidationPort, type ValidationReport } from '../ports/epub-validation.port';
import { type FileStoragePort } from '../ports/file-storage.port';
import { type ManuscriptContentPort, type ManuscriptContentTree } from '../ports/manuscript-content.port';
import { type PublicacaoRepositoryPort } from '../ports/publicacao-repository.port';

export interface PublicationBuildJobInput {
  readonly publicacaoId: string;
  readonly projetoId: string;
  readonly empresaId: string;
  /**
   * Raw JWT bearer token propagated from the originating HTTP request (INT-PUB-001/003).
   *
   * Captured and passed explicitly by `GeneratePublicationUseCase` before the
   * fire-and-forget `Promise.resolve().then(...)` boundary — AsyncLocalStorage
   * is unavailable here. Optional so in-process callers (tests, BDD scenarios)
   * are unaffected; defaults to `''` in port calls.
   */
  readonly bearerToken?: string;
}

/**
 * PublicationBuildJob — the asynchronous in-process build (api-contract §7.2).
 *
 * Runs after `GeneratePublicationUseCase` enqueues it, outside the request
 * thread. Steps: assemble the OCF/ePub 3 package from the manuscript +
 * composition inputs, validate via `EpubValidationPort` (epubcheck is
 * authoritative for `publicado` vs `com_erros`, ADR-003), persist the
 * terminal outcome, then request the project status via
 * `AdvanceProjetoStatusPort` at most once (D-P) — a failure there never
 * discards the recorded build result (integration-contracts.md §2.4).
 *
 * The actual OCF/ePub 3 assembly (walking the content tree into XHTML +
 * spine + nav) is the `EpubBuilder` domain service, delivered in P4
 * (PUB-009). `assemble()` below is an orchestration-only placeholder that
 * keeps this job's shape (and its unit tests) stable across P2 → P4; P4
 * replaces its body with a call into the real domain service.
 *
 * RULE-04: this file is in modules/ and does NOT import from infrastructure/.
 */
@Injectable()
export class PublicationBuildJob {
  private readonly logger = new Logger(PublicationBuildJob.name);
  private readonly epubBuilder = new EpubBuilder();

  constructor(
    @Inject(PUBLICACAO_REPOSITORY_PORT)
    private readonly repository: PublicacaoRepositoryPort,
    @Inject(MANUSCRIPT_CONTENT_PORT)
    private readonly manuscriptContentPort: ManuscriptContentPort,
    @Inject(COMPOSITION_METADATA_PORT)
    private readonly compositionMetadataPort: CompositionMetadataPort,
    @Inject(COMPOSITION_LAYOUT_PORT)
    private readonly compositionLayoutPort: CompositionLayoutPort,
    @Inject(EPUB_VALIDATION_PORT)
    private readonly epubValidationPort: EpubValidationPort,
    @Inject(FILE_STORAGE_PORT)
    private readonly fileStoragePort: FileStoragePort,
    @Inject(ADVANCE_PROJETO_STATUS_PORT)
    private readonly advanceProjetoStatusPort: AdvanceProjetoStatusPort,
    @Inject(EVENT_PUBLISHER_PORT)
    private readonly eventEmitter: EventPublisherPort,
  ) {}

  async run(input: PublicationBuildJobInput): Promise<void> {
    const gerando = await this.repository.findById(input.projetoId, input.publicacaoId);
    if (!gerando) {
      this.logger.warn(`PublicationBuildJob: publicacao ${input.publicacaoId} not found — aborting`);
      return;
    }

    try {
      const bearerToken = input.bearerToken ?? '';
      const [contentTree, metadados, layout] = await Promise.all([
        this.manuscriptContentPort.getContentTree(input.projetoId, bearerToken),
        this.compositionMetadataPort.get(input.projetoId),
        this.compositionLayoutPort.get(input.projetoId),
      ]);

      const buildResult = await this.assemble(contentTree, metadados, layout);

      const validando = gerando.iniciarValidacao();
      await this.repository.save(validando);

      const report = await this.validateEpub(buildResult.epubBytes, validando, input);
      if (!report) return; // EpubcheckUnavailableError handled inside validateEpub

      const { publicacao: terminal, targetStatus } = await this.resolveOutcome(
        validando,
        report,
        buildResult,
        input,
      );
      // Persist the terminal outcome BEFORE dispatching any domain event (PUB-004).
      await this.repository.save(terminal);

      // Dispatch domain event after persistence — timing is contractual (PUB-004).
      this.dispatchOutcomeEvent(terminal, targetStatus, input, buildResult);

      await this.requestProjectStatus(input.projetoId, targetStatus, input.publicacaoId, bearerToken);
    } catch (error) {
      this.logger.error(`PublicationBuildJob failed for publicacao ${input.publicacaoId}`, error as Error);
    }
  }

  /**
   * Assembles the OCF/ePub 3 package using the `EpubBuilder` domain service
   * (PUB-009, P4).
   *
   * ADR-004: retorna o objeto `{ epubBytes, totalCapitulos, totalImagens }` em vez de
   * apenas o Buffer, para que `resolveOutcome` possa persistir os KPIs de resumo.
   *
   * Se a árvore de conteúdo ou os metadados estiverem ausentes, retorna um Buffer vazio
   * com contagens zeradas — o adaptador epubcheck rejeita e o resultado é `com_erros`.
   *
   * Images are loaded via `fileStoragePort.get()` as Readable streams,
   * converted to Buffers inline; failures per-image are silently absorbed
   * (the image is omitted from the OCF, not the whole build).
   */
  private async assemble(
    contentTree: ManuscriptContentTree | null,
    metadados: MetadadosRead | null,
    layout: LayoutRead | null,
  ): Promise<{ epubBytes: Buffer; totalCapitulos: number; totalImagens: number }> {
    if (!contentTree || !metadados) {
      return { epubBytes: Buffer.alloc(0), totalCapitulos: 0, totalImagens: 0 };
    }

    const loadImage = async (storageKey: string): Promise<Buffer | null> => {
      try {
        const stream = await this.fileStoragePort.get(storageKey);
        return await streamToBuffer(stream);
      } catch {
        this.logger.warn(`Image load failed for storageKey="${storageKey}" — omitting from OCF`);
        return null;
      }
    };

    return this.epubBuilder.build(contentTree, metadados, layout, loadImage);
  }

  private async resolveOutcome(
    validando: PublicacaoEntity,
    report: ValidationReport,
    buildResult: { epubBytes: Buffer; totalCapitulos: number; totalImagens: number },
    input: PublicationBuildJobInput,
  ): Promise<{ publicacao: PublicacaoEntity; targetStatus: ProjetoTargetStatus }> {
    const totalErros = report.messages.filter((m) => m.severity === ValidationSeverity.ERROR).length;
    const totalAvisos = report.messages.filter((m) => m.severity === ValidationSeverity.WARNING).length;
    const concluidaEm = new Date();

    if (report.verdict === EpubcheckStatus.ERROS_CRITICOS) {
      return {
        publicacao: validando.concluirComErros({
          resumoErro: this.summarize(report),
          totalErros,
          totalAvisos,
          concluidaEm,
        }),
        targetStatus: 'com_erros',
      };
    }

    const key = `publicacoes/${input.publicacaoId}/output.epub`;
    let storeResult: { url: string; bytesWritten: number };
    try {
      storeResult = await this.fileStoragePort.put(key, buildResult.epubBytes, 'application/epub+zip');
    } catch (error) {
      this.logger.error(`Artifact storage failed for publicacao ${input.publicacaoId}`, error as Error);
      return {
        publicacao: validando.concluirComErros({
          resumoErro: 'Falha ao armazenar o artefato .epub gerado.',
          totalErros,
          totalAvisos,
          concluidaEm,
        }),
        targetStatus: 'com_erros',
      };
    }

    return {
      publicacao: validando.concluirPublicado({
        artefatoRef: key,
        epubcheckStatus: report.verdict,
        totalErros,
        totalAvisos,
        concluidaEm,
        // ADR-004: KPIs de resumo do ePub gerado
        tamanhoBytes: storeResult.bytesWritten,
        totalCapitulos: buildResult.totalCapitulos,
        totalImagens: buildResult.totalImagens,
      }),
      targetStatus: 'publicado',
    };
  }

  /**
   * Calls `EpubValidationPort.validate` with explicit handling for
   * `EpubcheckUnavailableError` (ADR-003: never publish an unvalidated artifact).
   *
   * Returns `null` when epubcheck could not run and the outcome has already been
   * recorded as `com_erros` — the caller must return immediately.
   */
  private async validateEpub(
    epubBytes: Buffer,
    validando: PublicacaoEntity,
    input: PublicationBuildJobInput,
  ): Promise<ValidationReport | null> {
    try {
      return await this.epubValidationPort.validate(epubBytes);
    } catch (error) {
      if (error instanceof EpubcheckUnavailableError) {
        const reason = (error as EpubcheckUnavailableError).message;
        this.logger.error(
          `PublicationBuildJob: epubcheck unavailable for publicacao ${input.publicacaoId} — ${reason}`,
        );
        const comErros = validando.concluirComErros({
          resumoErro: reason,
          totalErros: 1,
          totalAvisos: 0,
          concluidaEm: new Date(),
        });
        // Persist failure BEFORE dispatching the domain event (PUB-004).
        await this.repository.save(comErros);
        this.dispatchOutcomeEvent(comErros, 'com_erros', input, { epubBytes: Buffer.alloc(0), totalCapitulos: 0, totalImagens: 0 });
        await this.requestProjectStatus(input.projetoId, 'com_erros', input.publicacaoId, input.bearerToken ?? '');
        return null;
      }
      throw error;
    }
  }

  /**
   * Dispatches the appropriate domain event after the terminal Publicacao
   * state has been **durably persisted** (PUB-004).
   *
   * Called as the LAST step before `requestProjectStatus` so the event is
   * never emitted before the database write commits. Best-effort: failures
   * in the event bus are logged and swallowed — they must not affect the
   * recorded build result (same resilience contract as `advanceTo`).
   */
  private dispatchOutcomeEvent(
    terminal: PublicacaoEntity,
    targetStatus: ProjetoTargetStatus,
    input: PublicationBuildJobInput,
    buildResult: { epubBytes: Buffer; totalCapitulos: number; totalImagens: number },
  ): void {
    try {
      if (targetStatus === 'publicado') {
        this.eventEmitter.emit(
          'publication.succeeded',
          new PublicationSucceededEvent({
            publicacaoId: input.publicacaoId,
            projetoId: input.projetoId,
            empresaId: input.empresaId,
            tamanhoBytes: terminal.tamanhoBytes ?? buildResult.epubBytes.byteLength,
            totalCapitulos: terminal.totalCapitulos ?? buildResult.totalCapitulos,
            totalImagens: terminal.totalImagens ?? buildResult.totalImagens,
          }),
        );
      } else {
        this.eventEmitter.emit(
          'publication.failed',
          new PublicationFailedEvent({
            publicacaoId: input.publicacaoId,
            projetoId: input.projetoId,
            empresaId: input.empresaId,
            reason: terminal.resumoErro ?? 'publication build failed',
          }),
        );
      }
    } catch (error) {
      this.logger.error(
        `domain event dispatch failed for publicacao ${input.publicacaoId}`,
        error as Error,
      );
    }
  }

  private summarize(report: ValidationReport): string {
    const firstError = report.messages.find((m) => m.severity === ValidationSeverity.ERROR);
    return firstError ? `${firstError.code}: ${firstError.message}` : 'epubcheck reported fatal errors.';
  }

  /** Called at most once per terminal outcome (D-P); never discards the recorded result. */
  private async requestProjectStatus(
    projetoId: string,
    targetStatus: ProjetoTargetStatus,
    publicacaoId: string,
    bearerToken: string,
  ): Promise<void> {
    try {
      await this.advanceProjetoStatusPort.advanceTo({ projetoId, targetStatus }, bearerToken);
    } catch (error) {
      this.logger.error(
        `advanceTo failed for publicacao ${publicacaoId} (urn:cordele:pub:status-advance-failed)`,
        error as Error,
      );
    }
  }
}

// ─── Module-level helpers ─────────────────────────────────────────────────────

/** Reads a Node.js Readable stream to a Buffer. */
async function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on('data', (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}
