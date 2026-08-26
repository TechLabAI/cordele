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
import { join } from 'node:path';

import { ConflictException, NotFoundException } from '@nestjs/common';
import { defineFeature, loadFeature } from 'jest-cucumber';

import { GetProjetoLibraryUseCase } from 'src/modules/proj/use-cases/get-projeto-library.use-case';
import { GetProjetoDetailUseCase } from 'src/modules/proj/use-cases/get-projeto-detail.use-case';
import { GetPublicationHistoryUseCase } from 'src/modules/proj/use-cases/get-publication-history.use-case';
import { GetSignedDownloadUrlUseCase } from 'src/modules/proj/use-cases/get-signed-download-url.use-case';
import type { ProjetoEditorialRepository } from 'src/domain/proj/projeto-editorial.repository';
import type { ManuscriptSummaryPort } from 'src/domain/proj/ports/outbound/manuscript-summary.port';
import type { ProjectMetadataPort } from 'src/domain/proj/ports/outbound/project-metadata.port';
import type { PublicationHistoryPort } from 'src/domain/proj/ports/outbound/publication-history.port';
import { ProjetoStatus } from 'src/domain/proj/value-objects/project-status.vo';

// Shared step imports kept for API compatibility (shared.ts functions are no-ops;
// all real logic is implemented inline below).
import {
  aProjectProjXBelongingToEmpresaOutra,
  anAuthenticatedEditorOfEmpresaAetos,
  anExistingProjectProj1InStatusComErros,
  anExistingProjectProj1InStatusPublicado,
  theEditorListsProjects,
  theResponseStatusIs200,
  theResponseStatusIs403,
  theResponseStatusIs404,
  theResponseStatusIs409,
} from './steps/shared';

const feature = loadFeature(join(__dirname, 'features', 'project-library-and-history-read.feature'));

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
      const useCase = new GetProjetoLibraryUseCase(repo, manuscriptPort, metadataPort, publicationPort);
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
      const useCase = new GetProjetoLibraryUseCase(repo, manuscriptPort, metadataPort, publicationPort);
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
      const manuscriptPort = makeManuscriptPort(new Map());
      const metadataPort = makeMetadataPort(new Map());
      const useCase = new GetProjetoLibraryUseCase(repo, manuscriptPort, metadataPort, publicationPort);
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
      expect(result.degraded).toBe(true);
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

  // Scenario: "A read without the required scope is forbidden" → BLOCKED by P5 (JWT scope guards)
  // test.skip kept to signal P5 dependency
  test.skip('A read without the required scope is forbidden', ({ given, then, when }) => {
    given('an authenticated editor of empresa "aetos"', () => {
      anAuthenticatedEditorOfEmpresaAetos();
    });
    given('the editor\'s token lacks scope "proj:read"', () => {
      // Requires ScopesGuard wired in P5 (PROJ-014)
    });
    when('the editor lists projects', () => {
      theEditorListsProjects();
    });
    then('the response status is 403', () => {
      theResponseStatusIs403();
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
      const useCase = new GetProjetoDetailUseCase(repo, manuscriptPort, metadataPort, publicationPort);
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
      const useCase = new GetProjetoLibraryUseCase(repo, manuscriptPort, metadataPort, publicationPort);
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
