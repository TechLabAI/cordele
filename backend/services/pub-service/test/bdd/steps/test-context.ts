/**
 * BDD test context factory for the PUB module (P8 / PUB-019).
 *
 * Creates a fresh, isolated test context for every BDD scenario:
 *  - InMemoryPublicacaoRepository — replaces Prisma, no DB required.
 *  - jest.fn() mocks for all outbound ports.
 *  - Use-cases wired with direct constructor injection (no NestJS DI container).
 *  - Real EmpresaContextService for ALS propagation.
 *
 * RULE-01/02: this file is in test/ — it may import from infrastructure/ and
 * modules/ freely without violating the production boundary rules.
 */
import 'reflect-metadata';

import { type AuthenticatedUser } from 'src/domain/auth/authenticated-user';
import { type PublicacaoEntity } from 'src/domain/pub/publicacao.entity';
import { EmpresaContextService } from 'src/infrastructure/auth/empresa-context.service';
import { type AdvanceProjetoStatusPort } from 'src/modules/pub/ports/advance-projeto-status.port';
import { type CompositionLayoutPort } from 'src/modules/pub/ports/composition-layout.port';
import { type CompositionMetadataPort } from 'src/modules/pub/ports/composition-metadata.port';
import { type EpubValidationPort } from 'src/modules/pub/ports/epub-validation.port';
import { type EventPublisherPort } from 'src/modules/pub/ports/event-publisher.port';
import { type FileStoragePort } from 'src/modules/pub/ports/file-storage.port';
import { type ManuscriptContentPort } from 'src/modules/pub/ports/manuscript-content.port';
import { PublicationErasureService } from 'src/modules/pub/publication-erasure.service';
import { PublicationHistoryService } from 'src/modules/pub/publication-history.service';
import { GeneratePublicationUseCase } from 'src/modules/pub/use-cases/generate-publication.use-case';
import { GetPublicationHistoryUseCase } from 'src/modules/pub/use-cases/get-publication-history.use-case';
import { GetPublicationStatsUseCase } from 'src/modules/pub/use-cases/get-publication-stats.use-case';
import { GetPublicationStatusUseCase } from 'src/modules/pub/use-cases/get-publication-status.use-case';
import { GetSignedDownloadUrlUseCase } from 'src/modules/pub/use-cases/get-signed-download-url.use-case';
import { PublicationBuildJob } from 'src/modules/pub/use-cases/publication-build.job';

import { InMemoryPublicacaoRepository } from './in-memory-publicacao.repository';

/** Default fake user used across all BDD scenarios (empresa = emp_aetos). */
const FAKE_USER: AuthenticatedUser = {
  userId: 'bdd-user-001',
  username: 'bdd-editor',
  roles: ['pub-user'],
  scopes: ['pub:write', 'pub:read'],
  empresaId: 'emp_aetos',
};

export interface BddTestContext {
  /* Infrastructure */
  readonly inMemoryRepo: InMemoryPublicacaoRepository;
  readonly empresaContextService: EmpresaContextService;

  /* Mocked outbound ports */
  readonly manuscriptContentPort: jest.Mocked<ManuscriptContentPort>;
  readonly compositionMetadataPort: jest.Mocked<CompositionMetadataPort>;
  readonly compositionLayoutPort: jest.Mocked<CompositionLayoutPort>;
  readonly epubValidationPort: jest.Mocked<EpubValidationPort>;
  readonly fileStoragePort: jest.Mocked<FileStoragePort>;
  readonly advanceProjetoStatusPort: jest.Mocked<AdvanceProjetoStatusPort>;
  readonly eventPublisherPort: jest.Mocked<EventPublisherPort>;

  /* Use-cases (direct injection, no DI container) */
  readonly generatePublicationUseCase: GeneratePublicationUseCase;
  readonly getPublicationHistoryUseCase: GetPublicationHistoryUseCase;
  readonly getPublicationStatsUseCase: GetPublicationStatsUseCase;
  readonly getPublicationStatusUseCase: GetPublicationStatusUseCase;
  readonly getSignedDownloadUrlUseCase: GetSignedDownloadUrlUseCase;
  readonly buildJob: PublicationBuildJob;
  readonly publicationHistoryService: PublicationHistoryService;
  readonly publicationErasureService: PublicationErasureService;

  /* Per-scenario auth context */
  readonly fakeUser: AuthenticatedUser;

  /* Step output state — mutated by step implementations */
  lastStatus: number;
  lastBody: unknown;
  lastError: unknown;
}

/**
 * Creates a fresh, isolated BDD test context.
 *
 * Meant to be called inside `beforeEach` so each scenario starts clean.
 */
export function createBddTestContext(): BddTestContext {
  const inMemoryRepo = new InMemoryPublicacaoRepository();
  const empresaContextService = new EmpresaContextService();

  const manuscriptContentPort = {
    getContentTree: jest.fn(),
  } as unknown as jest.Mocked<ManuscriptContentPort>;

  const compositionMetadataPort = {
    get: jest.fn(),
  } as unknown as jest.Mocked<CompositionMetadataPort>;

  const compositionLayoutPort = {
    get: jest.fn(),
  } as unknown as jest.Mocked<CompositionLayoutPort>;

  const epubValidationPort = {
    validate: jest.fn(),
  } as unknown as jest.Mocked<EpubValidationPort>;

  const fileStoragePort = {
    put: jest.fn(),
    get: jest.fn(),
    delete: jest.fn(),
    signUrl: jest.fn(),
  } as unknown as jest.Mocked<FileStoragePort>;

  const advanceProjetoStatusPort = {
    advanceTo: jest.fn(),
  } as unknown as jest.Mocked<AdvanceProjetoStatusPort>;

  const eventPublisherPort = {
    emit: jest.fn(),
  } as unknown as jest.Mocked<EventPublisherPort>;

  // Sensible defaults so fire-and-forget build jobs don't throw unhandled rejections.
  compositionLayoutPort.get.mockResolvedValue(null);
  // ADR-004: put() now returns { url, bytesWritten }
  fileStoragePort.put.mockResolvedValue({ url: 'http://test-storage/output.epub', bytesWritten: 2048 });
  fileStoragePort.get.mockRejectedValue(new Error('get not configured'));
  fileStoragePort.delete.mockResolvedValue(undefined);
  fileStoragePort.signUrl.mockResolvedValue({
    url: 'http://signed-storage/output.epub?sig=bdd',
    expiresAt: new Date(Date.now() + 300_000).toISOString(),
  });
  advanceProjetoStatusPort.advanceTo.mockResolvedValue({
    projetoId: 'proj-100',
    newStatus: 'publicado',
    changed: true,
  });

  const buildJob = new PublicationBuildJob(
    inMemoryRepo,
    manuscriptContentPort,
    compositionMetadataPort,
    compositionLayoutPort,
    epubValidationPort,
    fileStoragePort,
    advanceProjetoStatusPort,
    eventPublisherPort,
  );

  const generatePublicationUseCase = new GeneratePublicationUseCase(
    inMemoryRepo,
    manuscriptContentPort,
    compositionMetadataPort,
    buildJob,
    empresaContextService,
  );

  const getPublicationHistoryUseCase = new GetPublicationHistoryUseCase(inMemoryRepo);
  const getPublicationStatsUseCase = new GetPublicationStatsUseCase(inMemoryRepo);
  const getPublicationStatusUseCase = new GetPublicationStatusUseCase(inMemoryRepo);
  const getSignedDownloadUrlUseCase = new GetSignedDownloadUrlUseCase(inMemoryRepo, fileStoragePort);

  const publicationHistoryService = new PublicationHistoryService(inMemoryRepo, fileStoragePort);
  const publicationErasureService = new PublicationErasureService(inMemoryRepo, fileStoragePort);

  return {
    inMemoryRepo,
    empresaContextService,
    manuscriptContentPort,
    compositionMetadataPort,
    compositionLayoutPort,
    epubValidationPort,
    fileStoragePort,
    advanceProjetoStatusPort,
    eventPublisherPort,
    generatePublicationUseCase,
    getPublicationHistoryUseCase,
    getPublicationStatsUseCase,
    getPublicationStatusUseCase,
    getSignedDownloadUrlUseCase,
    buildJob,
    publicationHistoryService,
    publicationErasureService,
    fakeUser: FAKE_USER,
    lastStatus: 0,
    lastBody: null,
    lastError: null,
  };
}

// ─── Module-level current-context accessors ───────────────────────────────────

let _current: BddTestContext | null = null;

export function setCurrentContext(ctx: BddTestContext): void {
  _current = ctx;
}

export function getCurrentContext(): BddTestContext {
  if (!_current) {
    throw new Error('BddTestContext not set — call setCurrentContext(ctx) in beforeEach first.');
  }
  return _current;
}

export { FAKE_USER };
export type { PublicacaoEntity };
