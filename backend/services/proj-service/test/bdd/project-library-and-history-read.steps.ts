/**
 * BDD suite for: Project library and publication history read views
 * Contract: test/bdd/features/project-library-and-history-read.feature
 *
 * P4 implementation: scenarios that verify cross-context read composition,
 * degraded fallback, download URL guarding (409), ordering, and 404 isolation.
 *
 * Each scenario is implemented as a use-case unit test (no HTTP server, no JWT).
 * The "response status" terminology is interpreted as:
 *   - 200: the use case returned successfully
 *   - 404: the use case threw NotFoundException
 *   - 409: the use case threw ConflictException
 *
 * Scenarios blocked until later priorities:
 *  - "A read without the required scope is forbidden" (403) → P5 (JWT scope guards)
 *
 * Invariant tested: 3 port calls exactly per library request (SPEC-10 clause 3).
 */

// ── Env vars required by ConfigModule (set before any Nest import) ────────────
// The scope-guard scenario (scenario 8/12) creates a NestJS TestingModule that
// imports ProjModule, which in turn uses ConfigModule to resolve JWT env vars.
process.env['NODE_ENV'] = 'test';
process.env['JWT_ISSUER_URI'] = 'http://test-issuer/realms/test';
process.env['JWT_AUDIENCE'] = 'proj-service-test';
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/cordele_test';

import { join } from 'node:path';

import {
  ConflictException,
  ExecutionContext,
  ForbiddenException,
  Global,
  INestApplication,
  Logger,
  Module,
  NotFoundException,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { defineFeature, loadFeature } from 'jest-cucumber';
import request from 'supertest';

import { GetProjetoLibraryUseCase } from 'src/modules/proj/use-cases/get-projeto-library.use-case';
import { GetProjetoDetailUseCase } from 'src/modules/proj/use-cases/get-projeto-detail.use-case';
import { GetPublicationHistoryUseCase } from 'src/modules/proj/use-cases/get-publication-history.use-case';
import { GetSignedDownloadUrlUseCase } from 'src/modules/proj/use-cases/get-signed-download-url.use-case';
import type { ProjetoEditorialRepository } from 'src/domain/proj/projeto-editorial.repository';
import type { ManuscriptSummaryPort } from 'src/domain/proj/ports/outbound/manuscript-summary.port';
import type { ProjectMetadataPort } from 'src/domain/proj/ports/outbound/project-metadata.port';
import type { PublicationHistoryPort } from 'src/domain/proj/ports/outbound/publication-history.port';
import { ProjetoStatus } from 'src/domain/proj/value-objects/project-status.vo';
import {
  COMPOSITION_ERASURE_PORT,
  MANUSCRIPT_ERASURE_PORT,
  MANUSCRIPT_SUMMARY_PORT,
  PROJECT_METADATA_PORT,
  PROJETO_EDITORIAL_REPOSITORY,
  PUBLICATION_ERASURE_PORT,
  PUBLICATION_HISTORY_PORT,
} from 'src/modules/proj/proj.tokens';
import { ProjModule } from 'src/modules/proj/proj.module';
import { REQUIRED_SCOPES_KEY } from 'src/modules/proj/decorators/require-scope.decorator';

// These were originally imported from ./steps/shared, but that file was
// redesigned (P8) to hold only pure, stateless helpers shared across suites —
// it no longer exports these no-op placeholders. All real assertions in this
// file are implemented inline in each step body (see file header comment
// above), so these remain true no-ops kept only for structural parity with
// the Gherkin given/when/then wiring below.
function aProjectProjXBelongingToEmpresaOutra(): void {}
function anAuthenticatedEditorOfEmpresaAetos(): void {}
function anExistingProjectProj1InStatusComErros(): void {}
function anExistingProjectProj1InStatusPublicado(): void {}
function theEditorListsProjects(): void {}
function theResponseStatusIs200(): void {}
function theResponseStatusIs403(): void {}
function theResponseStatusIs404(): void {}
function theResponseStatusIs409(): void {}

const feature = loadFeature(join(__dirname, 'features', 'project-library-and-history-read.feature'));

// ---------------------------------------------------------------------------
// Fake @Global() module used by the scope-guard BDD scenario (13/13).
// Provides the tokens that ProjModule expects globally from AppModule's
// PersistenceModule, ReadPortsModule and ErasurePortsModule in production.
// Stubs are never called — the request is blocked at the guard (403).
// Must be declared at file scope so TypeScript class decorators work correctly.
// ---------------------------------------------------------------------------

@Global()
@Module({
  providers: [
    { provide: PROJETO_EDITORIAL_REPOSITORY, useValue: {} },
    { provide: MANUSCRIPT_SUMMARY_PORT, useValue: { summaries: async () => new Map() } },
    { provide: PROJECT_METADATA_PORT, useValue: { metadata: async () => new Map() } },
    {
      provide: PUBLICATION_HISTORY_PORT,
      useValue: {
        latest: async () => new Map(),
        history: async () => [],
        signedDownloadUrl: async () => ({ arquivoUrl: '', expiresAt: '' }),
      },
    },
    { provide: PUBLICATION_ERASURE_PORT, useValue: { erase: async () => undefined } },
    { provide: COMPOSITION_ERASURE_PORT, useValue: { erase: async () => undefined } },
    { provide: MANUSCRIPT_ERASURE_PORT, useValue: { erase: async () => undefined } },
  ],
  exports: [
    PROJETO_EDITORIAL_REPOSITORY,
    MANUSCRIPT_SUMMARY_PORT,
    PROJECT_METADATA_PORT,
    PUBLICATION_HISTORY_PORT,
    PUBLICATION_ERASURE_PORT,
    COMPOSITION_ERASURE_PORT,
    MANUSCRIPT_ERASURE_PORT,
  ],
})
class ScopeGuardBddFakeInfraModule { /* NestJS module — all configuration in @Module() decorator above */ }

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const EMPRESA_ID = 'emp-aetos';
const NOW = new Date('2026-08-25T10:00:00Z');

function makeProject(
  id: string,
  status: ProjetoStatus = ProjetoStatus.rascunho,
  ultimaAtividadeEm?: Date,
) {
  return {
    id,
    nome: `Projeto ${id}`,
    descricao: null,
    editoraId: EMPRESA_ID,
    status,
    criadoEm: NOW,
    atualizadoEm: ultimaAtividadeEm ?? NOW,
  };
}

function makeRepository(
  projects: ReturnType<typeof makeProject>[],
): jest.Mocked<ProjetoEditorialRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn((id: string) => {
      const p = projects.find((proj) => proj.id === id);
      return Promise.resolve(p ?? null);
    }),
    findAll: jest.fn(() => Promise.resolve(projects)),
    updateStatus: jest.fn(),
    existsByIdAndEmpresa: jest.fn(),
  } as unknown as jest.Mocked<ProjetoEditorialRepository>;
}

function makeManuscriptPort(
  summaryMap: Map<string, { totalCapitulos: number; totalImagens: number }> = new Map(),
): jest.Mocked<ManuscriptSummaryPort> {
  return { summaries: jest.fn().mockResolvedValue(summaryMap) };
}

function makeMetadataPort(
  metaMap: Map<string, { autor: string | null }> = new Map(),
): jest.Mocked<ProjectMetadataPort> {
  return { metadata: jest.fn().mockResolvedValue(metaMap) };
}

function makePublicationPort(options?: {
  latestMap?: Map<string, { publicacaoId: string; epubcheckStatus: string }>;
  historyRecords?: any[];
  signedUrl?: { arquivoUrl: string; expiresAt: string };
  latestThrows?: boolean;
}): jest.Mocked<PublicationHistoryPort> {
  const port = {
    latest: jest.fn(),
    history: jest.fn(),
    signedDownloadUrl: jest.fn(),
  } as jest.Mocked<PublicationHistoryPort>;

  if (options?.latestThrows) {
    port.latest.mockRejectedValue(new Error('PUB unavailable'));
  } else {
    port.latest.mockResolvedValue(options?.latestMap ?? new Map());
  }
  port.history.mockResolvedValue(options?.historyRecords ?? []);
  if (options?.signedUrl) {
    port.signedDownloadUrl.mockResolvedValue(options.signedUrl);
  }

  return port;
}

// ---------------------------------------------------------------------------
// Feature definition
// ---------------------------------------------------------------------------

defineFeature(feature, (test) => {
  test('The library lists projects with composed cards', ({ and, given, then, when }) => {
    let repo: jest.Mocked<ProjetoEditorialRepository>;
    let manuscriptPort: jest.Mocked<ManuscriptSummaryPort>;
    let metadataPort: jest.Mocked<ProjectMetadataPort>;
    let publicationPort: jest.Mocked<PublicationHistoryPort>;
    let result: any;
    const PROJECT_ID = 'proj-1';

    given('an authenticated editor of empresa "aetos"', () => {
      anAuthenticatedEditorOfEmpresaAetos();
      repo = makeRepository([makeProject(PROJECT_ID, ProjetoStatus.publicado)]);
    });

    given('an existing project "proj-1" in status "publicado"', () => {
      anExistingProjectProj1InStatusPublicado();
      // project already set up above
    });

    and('project "proj-1" has a latest manuscript with 18 chapters and 3 images', () => {
      manuscriptPort = makeManuscriptPort(
        new Map([[PROJECT_ID, { totalCapitulos: 18, totalImagens: 3 }]]),
      );
    });

    and('project "proj-1" has a latest publication with epubcheck "avisos"', () => {
      publicationPort = makePublicationPort({
        latestMap: new Map([[PROJECT_ID, { publicacaoId: 'pub-1', epubcheckStatus: 'avisos' }]]),
      });
    });

    and('project "proj-1" has composed metadata with author "Eliana Moraes"', () => {
      metadataPort = makeMetadataPort(new Map([[PROJECT_ID, { autor: 'Eliana Moraes' }]]));
    });

    when('the editor lists projects', async () => {
      theEditorListsProjects();
      const useCase = new GetProjetoLibraryUseCase(repo, manuscriptPort, metadataPort, publicationPort, false, false, false);
      result = await useCase.execute({ empresaId: EMPRESA_ID });
    });

    then('the response status is 200', () => {
      theResponseStatusIs200();
      expect(result).toBeDefined();
      expect(result.cards).toBeDefined();
    });

    and('a card for "proj-1" shows totalCapitulos 18 and totalImagens 3', () => {
      const card = result.cards.find((c: any) => c.id === PROJECT_ID);
      expect(card).toBeDefined();
      expect(card.totalCapitulos).toBe(18);
      expect(card.totalImagens).toBe(3);
    });

    and('the card for "proj-1" shows ultimoEpubcheckStatus "avisos" and autor "Eliana Moraes"', () => {
      const card = result.cards.find((c: any) => c.id === PROJECT_ID);
      expect(card.ultimoEpubcheckStatus).toBe('avisos');
      expect(card.autor).toBe('Eliana Moraes');
    });
  });

  test('A draft project with no manuscript shows zero counts and a draft badge', ({ and, given, then, when }) => {
    let repo: jest.Mocked<ProjetoEditorialRepository>;
    let result: any;
    const PROJECT_ID = 'proj-2';

    given('an authenticated editor of empresa "aetos"', () => {
      anAuthenticatedEditorOfEmpresaAetos();
    });

    given('an existing project "proj-2" in status "rascunho"', () => {
      repo = makeRepository([makeProject(PROJECT_ID, ProjetoStatus.rascunho)]);
    });

    and('project "proj-2" has no manuscript', () => {
      // Empty Map from manuscript port — no entry for proj-2
    });

    when('the editor lists projects', async () => {
      theEditorListsProjects();
      const manuscriptPort = makeManuscriptPort(new Map());
      const metadataPort = makeMetadataPort(new Map());
      const publicationPort = makePublicationPort({ latestMap: new Map() });
      const useCase = new GetProjetoLibraryUseCase(repo, manuscriptPort, metadataPort, publicationPort, false, false, false);
      result = await useCase.execute({ empresaId: EMPRESA_ID });
    });

    then('a card for "proj-2" shows totalCapitulos 0 and totalImagens 0', () => {
      const card = result.cards.find((c: any) => c.id === PROJECT_ID);
      expect(card).toBeDefined();
      expect(card.totalCapitulos).toBe(0);
      expect(card.totalImagens).toBe(0);
    });

    and('the card for "proj-2" shows status "rascunho"', () => {
      const card = result.cards.find((c: any) => c.id === PROJECT_ID);
      expect(card.status).toBe(ProjetoStatus.rascunho);
    });
  });

  test('The library degrades when a cross-context port is unavailable', ({ and, given, then, when }) => {
    let repo: jest.Mocked<ProjetoEditorialRepository>;
    let publicationPort: jest.Mocked<PublicationHistoryPort>;
    let result: any;
    let warnSpy: jest.SpyInstance;
    const PROJECT_ID = 'proj-1';

    given('an authenticated editor of empresa "aetos"', () => {
      anAuthenticatedEditorOfEmpresaAetos();
    });

    given('an existing project "proj-1" in status "publicado"', () => {
      anExistingProjectProj1InStatusPublicado();
      repo = makeRepository([makeProject(PROJECT_ID, ProjetoStatus.publicado)]);
    });

    and('the publication read port is unavailable', () => {
      publicationPort = makePublicationPort({ latestThrows: true });
    });

    when('the editor lists projects', async () => {
      theEditorListsProjects();
      // Spy on Logger.prototype.warn BEFORE invoking the use case so the
      // degraded:true port=PublicationHistoryPort message is captured.
      // (SPEC-07 / P8 criterion 2: spy de logger captura WARN degraded:true)
      warnSpy = jest.spyOn(Logger.prototype, 'warn');
      const manuscriptPort = makeManuscriptPort(new Map());
      const metadataPort = makeMetadataPort(new Map());
      const useCase = new GetProjetoLibraryUseCase(repo, manuscriptPort, metadataPort, publicationPort, false, false, false);
      result = await useCase.execute({ empresaId: EMPRESA_ID });
    });

    then('the response status is 200', () => {
      theResponseStatusIs200();
      // use case returned without throwing — equivalent to 200
      expect(result).toBeDefined();
    });

    and('the card for "proj-1" shows ultimoEpubcheckStatus null', () => {
      const card = result.cards.find((c: any) => c.id === PROJECT_ID);
      expect(card.ultimoEpubcheckStatus).toBeNull();
    });

    and('the response is marked degraded', () => {
      try {
        expect(result.degraded).toBe(true);
        // Verify the logger emitted WARN degraded:true port=PublicationHistoryPort
        // (SPEC-07 / P8 criterion 2). The production use case calls logger.warn()
        // inside callPort() when the port rejects.
        const warnMessages: string[] = warnSpy.mock.calls.map((args) => String(args[0]));
        const degradedWarn = warnMessages.find(
          (msg) => msg.includes('degraded:true') && msg.includes('port=PublicationHistoryPort'),
        );
        expect(degradedWarn).toBeDefined();
      } finally {
        warnSpy.mockRestore();
      }
    });
  });

  test('Publication history is returned newest first', ({ and, given, then, when }) => {
    let repo: jest.Mocked<ProjetoEditorialRepository>;
    let result: any;
    const PROJECT_ID = 'proj-1';

    given('an authenticated editor of empresa "aetos"', () => {
      anAuthenticatedEditorOfEmpresaAetos();
    });

    given('an existing project "proj-1" in status "com_erros"', () => {
      anExistingProjectProj1InStatusComErros();
      repo = makeRepository([makeProject(PROJECT_ID, ProjetoStatus.com_erros)]);
    });

    and('project "proj-1" has publications:', (_table: any) => {
      // Table data comes in but we pre-configure the mock below
    });

    when('the editor reads the publication history of "proj-1"', async () => {
      const publicationPort = makePublicationPort({
        historyRecords: [
          // Returned newest-first by PUB (port contract)
          {
            publicacaoId: 'pub-2',
            projetoId: PROJECT_ID,
            epubcheckStatus: 'avisos',
            totalErros: 0,
            totalAvisos: 2,
            criadoEm: '2026-06-19T16:30:00Z',
          },
          {
            publicacaoId: 'pub-1',
            projetoId: PROJECT_ID,
            epubcheckStatus: 'erros_criticos',
            totalErros: 3,
            totalAvisos: 0,
            criadoEm: '2026-06-14T09:15:00Z',
          },
        ],
      });
      const useCase = new GetPublicationHistoryUseCase(repo, publicationPort);
      result = await useCase.execute({ projetoId: PROJECT_ID, empresaId: EMPRESA_ID });
    });

    then('the response status is 200', () => {
      theResponseStatusIs200();
      expect(result).toBeDefined();
    });

    and('the publications are ordered by criadoEm descending', () => {
      expect(result).toHaveLength(2);
      expect(result[0].publicacaoId).toBe('pub-2');
      expect(result[1].publicacaoId).toBe('pub-1');
    });
  });

  test('A valid publication yields a signed download URL, never a byte stream', ({ and, given, then, when }) => {
    let repo: jest.Mocked<ProjetoEditorialRepository>;
    let result: any;
    const PROJECT_ID = 'proj-1';
    const PUB_ID = 'pub-1';

    given('an authenticated editor of empresa "aetos"', () => {
      anAuthenticatedEditorOfEmpresaAetos();
    });

    given('an existing project "proj-1" with a publication "pub-1" whose epubcheck is "avisos"', () => {
      repo = makeRepository([makeProject(PROJECT_ID, ProjetoStatus.publicado)]);
    });

    when('the editor requests the download URL for publication "pub-1"', async () => {
      const publicationPort = makePublicationPort({
        historyRecords: [
          {
            publicacaoId: PUB_ID,
            projetoId: PROJECT_ID,
            epubcheckStatus: 'avisos',
            totalErros: 0,
            totalAvisos: 2,
            criadoEm: NOW.toISOString(),
          },
        ],
        signedUrl: {
          arquivoUrl: 'https://storage.example.com/romance.epub?sig=abc',
          expiresAt: '2026-08-25T15:00:00Z',
        },
      });
      const useCase = new GetSignedDownloadUrlUseCase(repo, publicationPort);
      result = await useCase.execute({ projetoId: PROJECT_ID, publicacaoId: PUB_ID, empresaId: EMPRESA_ID });
    });

    then('the response status is 200', () => {
      theResponseStatusIs200();
      expect(result).toBeDefined();
    });

    and('a short-TTL signed arquivoUrl is returned', () => {
      expect(result.arquivoUrl).toBe('https://storage.example.com/romance.epub?sig=abc');
      expect(result.expiresAt).toBeDefined();
    });

    and('the bytes are not proxied through the service', () => {
      // By design: the use case returns a URL, never byte streams. The SPA opens the URL.
      // The signed URL points to external storage — no streaming in this service.
      expect(result.arquivoUrl).toMatch(/^https:\/\//);
    });
  });

  test('A critically-errored publication is not downloadable', ({ given, then, when }) => {
    let repo: jest.Mocked<ProjetoEditorialRepository>;
    let error: unknown;
    const PROJECT_ID = 'proj-1';
    const PUB_ID = 'pub-0';

    given('an authenticated editor of empresa "aetos"', () => {
      anAuthenticatedEditorOfEmpresaAetos();
    });

    given('an existing project "proj-1" with a publication "pub-0" whose epubcheck is "erros_criticos"', () => {
      repo = makeRepository([makeProject(PROJECT_ID, ProjetoStatus.com_erros)]);
    });

    when('the editor requests the download URL for publication "pub-0"', async () => {
      const publicationPort = makePublicationPort({
        historyRecords: [
          {
            publicacaoId: PUB_ID,
            projetoId: PROJECT_ID,
            epubcheckStatus: 'erros_criticos',
            totalErros: 3,
            totalAvisos: 0,
            criadoEm: NOW.toISOString(),
          },
        ],
      });
      const useCase = new GetSignedDownloadUrlUseCase(repo, publicationPort);
      try {
        await useCase.execute({ projetoId: PROJECT_ID, publicacaoId: PUB_ID, empresaId: EMPRESA_ID });
      } catch (e) {
        error = e;
      }
    });

    then('the response status is 409', () => {
      theResponseStatusIs409();
      expect(error).toBeInstanceOf(ConflictException);
    });
  });

  test('A project of another empresa is not found', ({ given, then, when }) => {
    let repo: jest.Mocked<ProjetoEditorialRepository>;
    let error: unknown;

    given('an authenticated editor of empresa "aetos"', () => {
      anAuthenticatedEditorOfEmpresaAetos();
    });

    given('a project "proj-x" belonging to empresa "outra"', () => {
      aProjectProjXBelongingToEmpresaOutra();
      // Repository returns null for cross-tenant projects (schema isolation)
      repo = makeRepository([]);
    });

    when('the editor reads project "proj-x"', async () => {
      const useCase = new GetProjetoDetailUseCase(
        repo,
        makeManuscriptPort(),
        makeMetadataPort(),
        makePublicationPort(),
        false, false, false,
      );
      const result = await useCase.execute({ projetoId: 'proj-x', empresaId: EMPRESA_ID });
      // null result → 404 at controller
      if (result === null) {
        error = new NotFoundException('proj-x');
      }
    });

    then('the response status is 404', () => {
      theResponseStatusIs404();
      expect(error).toBeInstanceOf(NotFoundException);
    });
  });

  // Scenario 13/13: scope guard enforcement (P5 dependency now fulfilled — PROJ-014).
  // Unlike the other 12 scenarios (which call use cases directly), this one boots a
  // mini INestApplication because @RequiredScopes enforcement lives in the HTTP pipeline
  // (JwtAuthGuard / guard stub with Reflector), not in the use case layer.
  // The app uses ScopeGuardBddFakeInfraModule (fake @Global()) + ProjModule only —
  // AppModule is intentionally excluded to avoid the APP_GUARD wiring issue documented
  // in the PROJ plan (overrideGuard() + APP_GUARD conflict).
  test('A read without the required scope is forbidden', ({ given, then, when }) => {
    let scopeTestStatus: number;

    given('an authenticated editor of empresa "aetos"', () => {
      anAuthenticatedEditorOfEmpresaAetos();
    });

    given('the editor\'s token lacks scope "proj:read"', () => {
      // The guard stub configured in the `when` step injects a user whose
      // scopes array does not contain 'proj:read' — enforced via Reflector.
    });

    when('the editor lists projects', async () => {
      theEditorListsProjects();

      // Principal that carries proj:write but NOT proj:read.
      const userWithoutReadScope = {
        userId: '00000000-0000-0000-0000-000000000099',
        username: 'scope-test-editor',
        roles: ['proj-user'],
        scopes: ['proj:write'],
        empresaId: EMPRESA_ID,
      };

      // Reflector is wired after compile(); guard reads it lazily at request time.
      let scopeTestReflector: Reflector | null = null;

      // Guard stub mirrors JwtAuthGuard.enforceScopes without real JWT infrastructure.
      const scopeGuardStub = {
        canActivate: (context: ExecutionContext): boolean => {
          const req = context.switchToHttp().getRequest<Record<string, unknown>>();
          req['user'] = userWithoutReadScope;

          if (scopeTestReflector) {
            const required = scopeTestReflector.getAllAndOverride<string[] | undefined>(
              REQUIRED_SCOPES_KEY,
              [context.getHandler(), context.getClass()],
            );
            if (required && required.length > 0) {
              const hasScope = required.some((s) =>
                userWithoutReadScope.scopes.includes(s),
              );
              if (!hasScope) {
                throw new ForbiddenException(
                  `Insufficient scope. Required one of: ${required.join(', ')}`,
                );
              }
            }
          }

          return true;
        },
      };

      const moduleRef = await Test.createTestingModule({
        imports: [ScopeGuardBddFakeInfraModule, ProjModule],
      }).compile();

      const app: INestApplication = moduleRef.createNestApplication();
      app.setGlobalPrefix('api');
      app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true,
          forbidNonWhitelisted: true,
          transform: true,
          transformOptions: { enableImplicitConversion: true },
        }),
      );
      // useGlobalGuards bypasses the APP_GUARD / overrideGuard conflict.
      app.useGlobalGuards(scopeGuardStub as Parameters<typeof app.useGlobalGuards>[0]);
      await app.init();

      // Wire Reflector so the guard stub can read @RequiredScopes metadata.
      scopeTestReflector = moduleRef.get(Reflector);

      const response = await request(app.getHttpServer()).get('/api/v1/proj/projetos');
      scopeTestStatus = response.status;

      await app.close();
    });

    then('the response status is 403', () => {
      theResponseStatusIs403();
      expect(scopeTestStatus).toBe(403);
    });
  });

  test('The library is ordered by ultimaAtividadeEm descending', ({ given, then, when }) => {
    let repo: jest.Mocked<ProjetoEditorialRepository>;
    let result: any;

    given('an authenticated editor of empresa "aetos"', () => {
      anAuthenticatedEditorOfEmpresaAetos();
    });

    given('two projects "proj-early" (ultimaAtividadeEm 2026-08-01) and "proj-late" (ultimaAtividadeEm 2026-08-25)', () => {
      // Repository returns projects in descending order (atualizadoEm DESC)
      repo = makeRepository([
        makeProject('proj-late', ProjetoStatus.publicado, new Date('2026-08-25T00:00:00Z')),
        makeProject('proj-early', ProjetoStatus.publicado, new Date('2026-08-01T00:00:00Z')),
      ]);
    });

    when('the editor lists projects', async () => {
      theEditorListsProjects();
      const useCase = new GetProjetoLibraryUseCase(
        repo,
        makeManuscriptPort(),
        makeMetadataPort(),
        makePublicationPort(),
        false, false, false,
      );
      result = await useCase.execute({ empresaId: EMPRESA_ID });
    });

    then('"proj-late" appears before "proj-early" in the response', () => {
      expect(result.cards).toHaveLength(2);
      expect(result.cards[0].id).toBe('proj-late');
      expect(result.cards[1].id).toBe('proj-early');
    });
  });

  test('Project detail composes all cross-context fields in one response', ({ and, given, then, when }) => {
    let repo: jest.Mocked<ProjetoEditorialRepository>;
    let result: any;
    const PROJECT_ID = 'proj-1';

    given('an authenticated editor of empresa "aetos"', () => {
      anAuthenticatedEditorOfEmpresaAetos();
    });

    given('an existing project "proj-1" in status "publicado"', () => {
      anExistingProjectProj1InStatusPublicado();
      repo = makeRepository([makeProject(PROJECT_ID, ProjetoStatus.publicado)]);
    });

    and('project "proj-1" has a manuscript summary with 12 chapters', () => {
      // configured on manuscriptPort below
    });

    and('project "proj-1" has composed metadata with author "Ana Lima"', () => {
      // configured on metadataPort below
    });

    and('project "proj-1" has one publication with epubcheckStatus "valido"', () => {
      // configured on publicationPort below
    });

    when('the editor reads the detail of project "proj-1"', async () => {
      const manuscriptPort = makeManuscriptPort(
        new Map([[PROJECT_ID, { totalCapitulos: 12, totalImagens: 0 }]]),
      );
      const metadataPort = makeMetadataPort(
        new Map([[PROJECT_ID, { autor: 'Ana Lima' }]]),
      );
      const publicationPort = makePublicationPort({
        historyRecords: [
          {
            publicacaoId: 'pub-1',
            projetoId: PROJECT_ID,
            epubcheckStatus: 'valido',
            totalErros: 0,
            totalAvisos: 0,
            criadoEm: NOW.toISOString(),
          },
        ],
      });
      const useCase = new GetProjetoDetailUseCase(repo, manuscriptPort, metadataPort, publicationPort, false, false, false);
      result = await useCase.execute({ projetoId: PROJECT_ID, empresaId: EMPRESA_ID });
    });

    then('the response status is 200', () => {
      theResponseStatusIs200();
      expect(result).not.toBeNull();
    });

    and('the response includes fields status, manuscriptSummary, metadata, and publicationHistory', () => {
      expect(result.status).toBeDefined();
      expect(result.manuscriptSummary).toBeDefined();
      expect(result.metadata).toBeDefined();
      expect(result.publicationHistory).toBeDefined();
    });

    and('manuscriptSummary.totalCapitulos is 12', () => {
      expect((result.manuscriptSummary as any).totalCapitulos).toBe(12);
    });

    and('metadata.autor is "Ana Lima"', () => {
      expect((result.metadata as any).autor).toBe('Ana Lima');
    });

    and('publicationHistory contains one entry with epubcheckStatus "valido"', () => {
      expect((result.publicationHistory as any[]).length).toBe(1);
      expect((result.publicationHistory as any[])[0].epubcheckStatus).toBe('valido');
    });
  });

  test('A publication in pending status is not downloadable', ({ given, then, when }) => {
    let repo: jest.Mocked<ProjetoEditorialRepository>;
    let error: unknown;
    const PROJECT_ID = 'proj-1';
    const PUB_ID = 'pub-pending';

    given('an authenticated editor of empresa "aetos"', () => {
      anAuthenticatedEditorOfEmpresaAetos();
    });

    given('an existing project "proj-1" with a publication "pub-pending" whose epubcheck is "pendente"', () => {
      repo = makeRepository([makeProject(PROJECT_ID, ProjetoStatus.publicado)]);
    });

    when('the editor requests the download URL for publication "pub-pending"', async () => {
      const publicationPort = makePublicationPort({
        historyRecords: [
          {
            publicacaoId: PUB_ID,
            projetoId: PROJECT_ID,
            epubcheckStatus: 'pendente',
            totalErros: 0,
            totalAvisos: 0,
            criadoEm: NOW.toISOString(),
          },
        ],
      });
      const useCase = new GetSignedDownloadUrlUseCase(repo, publicationPort);
      try {
        await useCase.execute({ projetoId: PROJECT_ID, publicacaoId: PUB_ID, empresaId: EMPRESA_ID });
      } catch (e) {
        error = e;
      }
    });

    then('the response status is 409', () => {
      theResponseStatusIs409();
      expect(error).toBeInstanceOf(ConflictException);
    });
  });

  test('The library batch-fetches cross-context fields without N+1 calls', ({ and, given, then, when }) => {
    let repo: jest.Mocked<ProjetoEditorialRepository>;
    let manuscriptPort: jest.Mocked<ManuscriptSummaryPort>;
    let publicationPort: jest.Mocked<PublicationHistoryPort>;
    const PROJECT_IDS = ['id-1', 'id-2', 'id-3', 'id-4', 'id-5'];

    given('an authenticated editor of empresa "aetos"', () => {
      anAuthenticatedEditorOfEmpresaAetos();
    });

    given('5 projects belonging to empresa "aetos" in status "publicado"', () => {
      const projects = PROJECT_IDS.map((id) => makeProject(id, ProjetoStatus.publicado));
      repo = makeRepository(projects);
    });

    when('the editor lists projects', async () => {
      theEditorListsProjects();
      manuscriptPort = makeManuscriptPort(new Map());
      const metadataPort = makeMetadataPort(new Map());
      publicationPort = makePublicationPort({ latestMap: new Map() });
      const useCase = new GetProjetoLibraryUseCase(repo, manuscriptPort, metadataPort, publicationPort, false, false, false);
      await useCase.execute({ empresaId: EMPRESA_ID });
    });

    then('the manuscript summary port was called exactly once with all 5 project IDs', () => {
      expect(manuscriptPort.summaries).toHaveBeenCalledTimes(1);
      const callArgs = manuscriptPort.summaries.mock.calls[0][0] as string[];
      expect(callArgs).toHaveLength(5);
      for (const id of PROJECT_IDS) {
        expect(callArgs).toContain(id);
      }
    });

    and('the publication read port was called exactly once with all 5 project IDs', () => {
      expect(publicationPort.latest).toHaveBeenCalledTimes(1);
      const callArgs = publicationPort.latest.mock.calls[0][0] as string[];
      expect(callArgs).toHaveLength(5);
    });
  });
});
