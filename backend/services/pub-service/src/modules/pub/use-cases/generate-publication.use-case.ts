import { randomUUID } from 'node:crypto';
import { ConflictException, ForbiddenException, Inject, Injectable, Logger, UnprocessableEntityException } from '@nestjs/common';

import { PublicacaoEntity } from '../../../domain/pub/publicacao.entity';
import { type AuthenticatedUser } from '../../../domain/auth/authenticated-user';
import {
  COMPOSITION_METADATA_PORT,
  EMPRESA_CONTEXT_RUNNER_PORT,
  MANUSCRIPT_CONTENT_PORT,
  PUBLICACAO_REPOSITORY_PORT,
} from '../pub.tokens';
import { type CompositionMetadataPort } from '../ports/composition-metadata.port';
import { type EmpresaContextRunnerPort } from '../ports/empresa-context-runner.port';
import { type ManuscriptContentPort } from '../ports/manuscript-content.port';
import { type PublicacaoRepositoryPort } from '../ports/publicacao-repository.port';
import { PublicationBuildJob } from './publication-build.job';

export interface GeneratePublicationInput {
  readonly projetoId: string;
  /**
   * Raw JWT bearer token from the originating HTTP request.
   *
   * Captured by the controller via `@Headers('authorization')` and stripped of
   * the `Bearer ` prefix before being placed here. Propagated explicitly into
   * `PublicationBuildJobInput` so the fire-and-forget async job (running outside
   * the request scope, after `Promise.resolve().then(...)`) can pass it to the
   * outbound HTTP adapters for IMP and PROJ (INT-PUB-001, INT-PUB-003).
   *
   * Optional: defaults to `''` so in-process callers (tests, BDD) are unaffected.
   */
  readonly bearerToken?: string;
}

export interface GeneratePublicationResult {
  readonly publicacao: PublicacaoEntity;
  /** `false` when an in-flight build already existed (D-R idempotent no-op). */
  readonly isNew: boolean;
}

/**
 * GeneratePublicationUseCase — trigger an ePub 3 export (api-contract §4.1).
 *
 * Synchronous pre-flight (§7.1) + idempotent trigger (D-R): if a build is
 * already `gerando`/`validando` for the project, returns it without
 * starting a second job. Otherwise validates manuscript presence and
 * required metadata, creates the `Publicacao` in `gerando` and enqueues
 * `PublicationBuildJob` without blocking the request thread (§4 restrição:
 * `Promise.resolve().then(...)`).
 *
 * RULE-04: this file is in modules/ and does NOT import from infrastructure/
 * beyond the auth guard's `AuthenticatedUser` type.
 * RULE-07: requires the empresa context (via AuthenticatedUser) before
 * touching the repository.
 */
@Injectable()
export class GeneratePublicationUseCase {
  private readonly logger = new Logger(GeneratePublicationUseCase.name);

  constructor(
    @Inject(PUBLICACAO_REPOSITORY_PORT)
    private readonly repository: PublicacaoRepositoryPort,
    @Inject(MANUSCRIPT_CONTENT_PORT)
    private readonly manuscriptContentPort: ManuscriptContentPort,
    @Inject(COMPOSITION_METADATA_PORT)
    private readonly compositionMetadataPort: CompositionMetadataPort,
    private readonly buildJob: PublicationBuildJob,
    @Inject(EMPRESA_CONTEXT_RUNNER_PORT)
    private readonly empresaContextRunner: EmpresaContextRunnerPort,
  ) {}

  async execute(
    input: GeneratePublicationInput,
    user: AuthenticatedUser,
  ): Promise<GeneratePublicationResult> {
    if (!user?.empresaId) {
      throw new ForbiddenException('Token carries no empresa claim');
    }

    const inFlight = await this.repository.findInFlight(input.projetoId);
    if (inFlight) {
      return { publicacao: inFlight, isNew: false };
    }

    const contentTree = await this.manuscriptContentPort.getContentTree(
      input.projetoId,
      input.bearerToken ?? '',
    );
    if (!contentTree) {
      throw new ConflictException('urn:cordele:pub:manuscript-missing');
    }

    const metadados = await this.compositionMetadataPort.get(input.projetoId);
    if (!metadados?.titulo || !metadados.autor || !metadados.idioma) {
      throw new UnprocessableEntityException('urn:cordele:pub:metadata-incomplete');
    }

    const sequencia = await this.repository.nextSequencia(input.projetoId);
    const publicacao = PublicacaoEntity.iniciar({
      id: randomUUID(),
      projetoId: input.projetoId,
      sequencia,
      iniciadaEm: new Date(),
    });
    const saved = await this.repository.save(publicacao);

    // Fire-and-forget: never block the request thread (Restrições arquiteturais §4).
    //
    // INT-PUB-006: capture empresaId BEFORE leaving the synchronous callstack.
    // AsyncLocalStorage loses context after Promise.resolve() yields — wrapping
    // buildJob.run inside empresaContextRunner.runAs restores it explicitly so
    // all sub-operations inside the job (repository saves, port calls) see the
    // correct Empresa schema. Two concurrent jobs for different empresas each
    // get an isolated AsyncLocalStorage entry (no shared state).
    //
    // INT-PUB-001/003: capture bearerToken BEFORE yielding for the same reason —
    // the request context (headers) is gone after the first await outside this
    // callstack. Passing it explicitly through PublicationBuildJobInput lets the
    // async job propagate it to the IMP and PROJ HTTP adapters.
    const empresaId = user.empresaId;
    const bearerToken = input.bearerToken ?? '';
    Promise.resolve()
      .then(() =>
        this.empresaContextRunner.runAs(empresaId, () =>
          this.buildJob.run({
            publicacaoId: saved.id,
            projetoId: input.projetoId,
            empresaId,
            bearerToken,
          }),
        ),
      )
      .catch((error: unknown) => {
        this.logger.error(`PublicationBuildJob dispatch failed for ${saved.id}`, error as Error);
      });

    return { publicacao: saved, isNew: true };
  }
}
